import json
import logging
from io import BytesIO
from threading import Lock
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import UUID, uuid4
from datetime import date, datetime, timezone

from src.config import settings
from src.investment_policy.models import InvestmentPolicyRead, InvestmentPolicyUpsert
from src.investment_workspace.models import (
    InvestmentDecisionCreate,
    InvestmentDecisionRead,
    InvestmentThesisRead,
    InvestmentThesisUpsert,
)
from src.saas.models import (
    AlertCreate,
    AlertUpdate,
    AlertEventCreate,
    AlertEventRead,
    AlertRead,
    AuthenticatedUser,
    BacktestRunCreate,
    BacktestRunRead,
    BacktestTradeCreate,
    BacktestTradeRead,
    ClassificationSource,
    HoldingCreate,
    HoldingClassificationUpdate,
    HoldingRead,
    HoldingUpdate,
    JournalEntryCreate,
    JournalEntryRead,
    PortfolioBookEventRead,
    PortfolioCreate,
    PortfolioRead,
    Plan,
    NotificationChannelCreate,
    NotificationChannelRead,
    NewsDigestDeliveryRead,
    NewsDigestPreferenceRead,
    NewsDigestPreferenceUpsert,
    QuantValidationRunCreate,
    QuantValidationRunRead,
    RecurringBuyCreate,
    RecurringBuyRead,
    RecurringBuyUpdate,
    ReplaySessionCreate,
    ReplaySessionRead,
    ReplaySessionUpdate,
    RiskSnapshotCreate,
    RiskSnapshotRead,
    StrategyExportCreate,
    StrategyExportRead,
    StrategyCreate,
    StrategyRead,
    SubscriptionRead,
    WatchlistAssetCreate,
    WatchlistAssetRead,
    WatchlistCreate,
    WatchlistRead,
)


logger = logging.getLogger(__name__)


class SupabaseSchemaUnavailableError(RuntimeError):
    """Raised when PostgREST cannot find a required table or column."""

    def __init__(self, table: str) -> None:
        self.table = table
        super().__init__(f"Supabase schema is unavailable for {table}")


class UserScopedStore:
    """Local user-scoped store used until Supabase data access is wired.

    The API keeps user ownership checks here as well as in Supabase RLS. This
    lets tests verify scoping without relying only on frontend checks or RLS.
    """

    def __init__(self) -> None:
        self._lock = Lock()
        self._portfolios: dict[UUID, PortfolioRead] = {}
        self._investment_policies: dict[UUID, InvestmentPolicyRead] = {}
        self._investment_theses: dict[UUID, InvestmentThesisRead] = {}
        self._investment_decisions: dict[UUID, InvestmentDecisionRead] = {}
        self._holdings: dict[UUID, list[HoldingRead]] = {}
        self._portfolio_book_events: dict[UUID, list[PortfolioBookEventRead]] = {}
        self._recurring_buys: dict[UUID, list[RecurringBuyRead]] = {}
        self._watchlists: dict[UUID, WatchlistRead] = {}
        self._watchlist_assets: dict[UUID, list[WatchlistAssetRead]] = {}
        self._subscriptions: dict[UUID, SubscriptionRead] = {}
        self._strategies: dict[UUID, StrategyRead] = {}
        self._backtest_runs: dict[UUID, BacktestRunRead] = {}
        self._backtest_trades: dict[UUID, list[BacktestTradeRead]] = {}
        self._replay_sessions: dict[UUID, ReplaySessionRead] = {}
        self._notification_channels: dict[UUID, NotificationChannelRead] = {}
        self._notification_secrets: dict[UUID, dict[str, Any]] = {}
        self._alerts: dict[UUID, AlertRead] = {}
        self._alert_events: dict[UUID, AlertEventRead] = {}
        self._news_digest_preferences: dict[UUID, NewsDigestPreferenceRead] = {}
        self._news_digest_deliveries: dict[tuple[UUID, str], NewsDigestDeliveryRead] = {}
        self._risk_snapshots: dict[UUID, RiskSnapshotRead] = {}
        self._journal_entries: dict[UUID, JournalEntryRead] = {}
        self._quant_validation_runs: dict[UUID, QuantValidationRunRead] = {}
        self._strategy_exports: dict[UUID, StrategyExportRead] = {}

    def reset(self) -> None:
        with self._lock:
            self._portfolios.clear()
            self._investment_policies.clear()
            self._investment_theses.clear()
            self._investment_decisions.clear()
            self._holdings.clear()
            self._portfolio_book_events.clear()
            self._recurring_buys.clear()
            self._watchlists.clear()
            self._watchlist_assets.clear()
            self._subscriptions.clear()
            self._strategies.clear()
            self._backtest_runs.clear()
            self._backtest_trades.clear()
            self._replay_sessions.clear()
            self._notification_channels.clear()
            self._notification_secrets.clear()
            self._alerts.clear()
            self._alert_events.clear()
            self._news_digest_preferences.clear()
            self._news_digest_deliveries.clear()
            self._risk_snapshots.clear()
            self._journal_entries.clear()
            self._quant_validation_runs.clear()
            self._strategy_exports.clear()

    def get_subscription(self, user_id: UUID) -> SubscriptionRead:
        with self._lock:
            return self._subscriptions.get(user_id) or SubscriptionRead(user_id=user_id)

    def get_user_plan(self, user_id: UUID) -> Plan | None:
        subscription = self.get_subscription(user_id)
        return subscription.plan if subscription.status in {"active", "trialing"} else Plan.FREE

    def upsert_subscription(
        self,
        user_id: UUID,
        *,
        stripe_customer_id: str | None = None,
        stripe_subscription_id: str | None = None,
        plan: Plan = Plan.FREE,
        status: str = "inactive",
        current_period_end: datetime | None = None,
    ) -> SubscriptionRead:
        with self._lock:
            existing = self._subscriptions.get(user_id)
            subscription = SubscriptionRead(
                id=existing.id if existing else uuid4(),
                user_id=user_id,
                stripe_customer_id=stripe_customer_id or existing.stripe_customer_id if existing else stripe_customer_id,
                stripe_subscription_id=stripe_subscription_id or existing.stripe_subscription_id if existing else stripe_subscription_id,
                plan=plan,
                status=status,
                current_period_end=current_period_end,
                created_at=existing.created_at if existing else datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            self._subscriptions[user_id] = subscription
            return subscription

    def find_subscription_by_customer(self, stripe_customer_id: str) -> SubscriptionRead | None:
        with self._lock:
            return next((sub for sub in self._subscriptions.values() if sub.stripe_customer_id == stripe_customer_id), None)

    def find_subscription_by_stripe_subscription(self, stripe_subscription_id: str) -> SubscriptionRead | None:
        with self._lock:
            return next((sub for sub in self._subscriptions.values() if sub.stripe_subscription_id == stripe_subscription_id), None)

    def list_portfolios(self, user_id: UUID) -> list[PortfolioRead]:
        with self._lock:
            return [portfolio for portfolio in self._portfolios.values() if portfolio.user_id == user_id]

    def get_investment_policy(self, user_id: UUID) -> InvestmentPolicyRead | None:
        with self._lock:
            return self._investment_policies.get(user_id)

    def upsert_investment_policy(
        self,
        user_id: UUID,
        payload: InvestmentPolicyUpsert,
    ) -> InvestmentPolicyRead:
        now = datetime.now(timezone.utc)
        with self._lock:
            existing = self._investment_policies.get(user_id)
            policy = InvestmentPolicyRead(
                id=existing.id if existing else uuid4(),
                user_id=user_id,
                created_at=existing.created_at if existing else now,
                updated_at=now,
                **payload.model_dump(),
            )
            self._investment_policies[user_id] = policy
            return policy

    def list_investment_theses(
        self,
        user_id: UUID,
        portfolio_id: UUID | None = None,
    ) -> list[InvestmentThesisRead]:
        with self._lock:
            rows = [
                thesis for thesis in self._investment_theses.values()
                if thesis.user_id == user_id and (portfolio_id is None or thesis.portfolio_id == portfolio_id)
            ]
            return sorted(rows, key=lambda row: row.updated_at, reverse=True)

    def upsert_investment_thesis(
        self,
        user_id: UUID,
        holding: HoldingRead,
        payload: InvestmentThesisUpsert,
    ) -> InvestmentThesisRead:
        now = datetime.now(timezone.utc)
        with self._lock:
            existing = self._investment_theses.get(holding.id)
            thesis = InvestmentThesisRead(
                id=existing.id if existing else uuid4(),
                user_id=user_id,
                portfolio_id=holding.portfolio_id,
                holding_id=holding.id,
                symbol=holding.symbol,
                created_at=existing.created_at if existing else now,
                updated_at=now,
                **payload.model_dump(),
            )
            self._investment_theses[holding.id] = thesis
            return thesis

    def list_investment_decisions(
        self,
        user_id: UUID,
        portfolio_id: UUID | None = None,
        limit: int = 50,
    ) -> list[InvestmentDecisionRead]:
        with self._lock:
            rows = [
                decision for decision in self._investment_decisions.values()
                if decision.user_id == user_id and (portfolio_id is None or decision.portfolio_id == portfolio_id)
            ]
            return sorted(rows, key=lambda row: row.created_at, reverse=True)[:limit]

    def create_investment_decision(
        self,
        user_id: UUID,
        holding: HoldingRead,
        payload: InvestmentDecisionCreate,
    ) -> InvestmentDecisionRead:
        decision = InvestmentDecisionRead(
            user_id=user_id,
            portfolio_id=holding.portfolio_id,
            holding_id=holding.id,
            symbol=holding.symbol,
            action=payload.action,
            rationale=payload.rationale,
            policy_exception=payload.policy_exception,
        )
        with self._lock:
            self._investment_decisions[decision.id] = decision
        return decision

    def create_portfolio(self, user_id: UUID, payload: PortfolioCreate) -> PortfolioRead:
        portfolio = PortfolioRead(
            id=uuid4(),
            user_id=user_id,
            name=payload.name,
            base_currency=payload.base_currency.upper(),
        )
        with self._lock:
            self._portfolios[portfolio.id] = portfolio
        return portfolio

    def get_portfolio(self, user_id: UUID, portfolio_id: UUID) -> PortfolioRead | None:
        with self._lock:
            portfolio = self._portfolios.get(portfolio_id)
            if portfolio is None or portfolio.user_id != user_id:
                return None
            return portfolio

    def get_holding_by_id(self, user_id: UUID, holding_id: UUID) -> HoldingRead | None:
        with self._lock:
            for portfolio_id, holdings in self._holdings.items():
                portfolio = self._portfolios.get(portfolio_id)
                if portfolio is None or portfolio.user_id != user_id:
                    continue
                holding = next((item for item in holdings if item.id == holding_id), None)
                if holding is not None:
                    return holding
        return None

    def delete_portfolio(self, user_id: UUID, portfolio_id: UUID) -> bool:
        with self._lock:
            portfolio = self._portfolios.get(portfolio_id)
            if portfolio is None or portfolio.user_id != user_id:
                return False
            del self._portfolios[portfolio_id]
            self._holdings.pop(portfolio_id, None)
            self._portfolio_book_events.pop(portfolio_id, None)
            self._recurring_buys.pop(portfolio_id, None)
            self._investment_theses = {
                holding_id: thesis for holding_id, thesis in self._investment_theses.items()
                if thesis.portfolio_id != portfolio_id
            }
            self._investment_decisions = {
                decision_id: decision for decision_id, decision in self._investment_decisions.items()
                if decision.portfolio_id != portfolio_id
            }
            return True

    def add_holding(self, user_id: UUID, portfolio_id: UUID, payload: HoldingCreate) -> HoldingRead | None:
        portfolio = self.get_portfolio(user_id, portfolio_id)
        if portfolio is None:
            return None

        holding = HoldingRead(
            id=uuid4(),
            portfolio_id=portfolio_id,
            symbol=payload.symbol.upper(),
            asset_type=payload.asset_type,
            quantity=payload.quantity,
            average_cost=payload.average_cost,
            cost_currency=(payload.cost_currency or portfolio.base_currency).upper(),
        )
        with self._lock:
            self._holdings.setdefault(portfolio_id, []).append(holding)
        return holding

    def update_holding(self, user_id: UUID, portfolio_id: UUID, holding_id: UUID, payload: HoldingUpdate) -> HoldingRead | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        with self._lock:
            holdings = self._holdings.get(portfolio_id, [])
            for i, h in enumerate(holdings):
                if h.id == holding_id:
                    updated = h.model_copy(update={k: v for k, v in payload.model_dump(exclude_none=True).items()})
                    holdings[i] = updated
                    return updated
        return None

    def list_holdings(self, user_id: UUID, portfolio_id: UUID) -> list[HoldingRead] | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        with self._lock:
            return list(self._holdings.get(portfolio_id, []))

    def classify_holding(
        self,
        user_id: UUID,
        portfolio_id: UUID,
        holding_id: UUID,
        payload: HoldingClassificationUpdate,
    ) -> HoldingRead | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        with self._lock:
            holdings = self._holdings.get(portfolio_id, [])
            for index, holding in enumerate(holdings):
                if holding.id != holding_id:
                    continue
                if holding.book_type == payload.book_type:
                    return holding
                classified_at = datetime.now(timezone.utc)
                updated = holding.model_copy(update={
                    "book_type": payload.book_type,
                    "classification_source": ClassificationSource.USER,
                    "classified_at": classified_at,
                    "classified_by": user_id,
                })
                holdings[index] = updated
                self._portfolio_book_events.setdefault(portfolio_id, []).insert(0, PortfolioBookEventRead(
                    user_id=user_id,
                    portfolio_id=portfolio_id,
                    holding_id=holding.id,
                    symbol=holding.symbol,
                    previous_book_type=holding.book_type,
                    new_book_type=payload.book_type,
                    classification_source=ClassificationSource.USER,
                    actor_id=user_id,
                    created_at=classified_at,
                ))
                return updated
        return None

    def list_portfolio_book_events(
        self,
        user_id: UUID,
        portfolio_id: UUID,
    ) -> list[PortfolioBookEventRead] | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        with self._lock:
            return list(self._portfolio_book_events.get(portfolio_id, []))

    def delete_holding(self, user_id: UUID, portfolio_id: UUID, holding_id: UUID) -> bool:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return False
        with self._lock:
            before = self._holdings.get(portfolio_id, [])
            after = [h for h in before if h.id != holding_id]
            if len(after) == len(before):
                return False
            self._holdings[portfolio_id] = after
            return True

    def _sync_holding_for_recurring_buy(
        self,
        portfolio: PortfolioRead,
        recurring: RecurringBuyRead,
    ) -> HoldingRead:
        holdings = self._holdings.setdefault(portfolio.id, [])
        target_index = next(
            (
                i
                for i, holding in enumerate(holdings)
                if holding.id == recurring.linked_holding_id
                or (recurring.linked_holding_id is None and holding.symbol.upper() == recurring.symbol.upper())
            ),
            None,
        )
        holding = HoldingRead(
            id=holdings[target_index].id if target_index is not None else uuid4(),
            portfolio_id=portfolio.id,
            symbol=recurring.symbol.upper(),
            asset_type="equity",
            quantity=recurring.filled_quantity,
            average_cost=recurring.fill_price,
            cost_currency=recurring.fill_currency or portfolio.base_currency,
            created_at=holdings[target_index].created_at if target_index is not None else datetime.now(timezone.utc),
        )
        if target_index is None:
            holdings.append(holding)
        else:
            holdings[target_index] = holding
        return holding

    def list_recurring_buys(self, user_id: UUID, portfolio_id: UUID) -> list[RecurringBuyRead] | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        with self._lock:
            return list(self._recurring_buys.get(portfolio_id, []))

    def add_recurring_buy(self, user_id: UUID, portfolio_id: UUID, payload: RecurringBuyCreate) -> RecurringBuyRead | None:
        portfolio = self.get_portfolio(user_id, portfolio_id)
        if portfolio is None:
            return None

        recurring = RecurringBuyRead(
            id=uuid4(),
            portfolio_id=portfolio_id,
            symbol=payload.symbol,
            account=payload.account,
            status=payload.status,
            purchase_mode=payload.purchase_mode,
            entered_amount=payload.entered_amount,
            entered_currency=payload.entered_currency,
            filled_quantity=payload.filled_quantity,
            fill_price=payload.fill_price,
            fill_currency=payload.fill_currency,
            exchange_rate=payload.exchange_rate,
            recurrence_frequency=payload.recurrence_frequency,
            schedule_time=payload.schedule_time,
            schedule_day_of_week=payload.schedule_day_of_week,
            schedule_day_of_month=payload.schedule_day_of_month,
            schedule_month=payload.schedule_month,
            executed_at=payload.executed_at,
        )
        with self._lock:
            holding = self._sync_holding_for_recurring_buy(portfolio, recurring)
            recurring = recurring.model_copy(update={"linked_holding_id": holding.id})
            self._recurring_buys.setdefault(portfolio_id, []).append(recurring)
        return recurring

    def update_recurring_buy(
        self,
        user_id: UUID,
        portfolio_id: UUID,
        recurring_buy_id: UUID,
        payload: RecurringBuyUpdate,
    ) -> RecurringBuyRead | None:
        portfolio = self.get_portfolio(user_id, portfolio_id)
        if portfolio is None:
            return None
        updates = payload.model_dump(exclude_none=True)
        with self._lock:
            recurring_buys = self._recurring_buys.get(portfolio_id, [])
            for i, recurring in enumerate(recurring_buys):
                if recurring.id == recurring_buy_id:
                    updated = recurring.model_copy(update=updates)
                    holding = self._sync_holding_for_recurring_buy(portfolio, updated)
                    updated = updated.model_copy(update={"linked_holding_id": holding.id})
                    recurring_buys[i] = updated
                    return updated
        return None

    def delete_recurring_buy(self, user_id: UUID, portfolio_id: UUID, recurring_buy_id: UUID) -> bool:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return False
        with self._lock:
            recurring_buys = self._recurring_buys.get(portfolio_id, [])
            recurring = next((row for row in recurring_buys if row.id == recurring_buy_id), None)
            if recurring is None:
                return False
            self._recurring_buys[portfolio_id] = [row for row in recurring_buys if row.id != recurring_buy_id]
            if recurring.linked_holding_id is not None:
                self._holdings[portfolio_id] = [
                    holding for holding in self._holdings.get(portfolio_id, []) if holding.id != recurring.linked_holding_id
                ]
            return True

    def list_watchlists(self, user_id: UUID) -> list[WatchlistRead]:
        with self._lock:
            return [watchlist for watchlist in self._watchlists.values() if watchlist.user_id == user_id]

    def create_watchlist(self, user_id: UUID, payload: WatchlistCreate) -> WatchlistRead:
        watchlist = WatchlistRead(id=uuid4(), user_id=user_id, name=payload.name)
        with self._lock:
            self._watchlists[watchlist.id] = watchlist
        return watchlist

    def delete_watchlist(self, user_id: UUID, watchlist_id: UUID) -> bool:
        with self._lock:
            watchlist = self._watchlists.get(watchlist_id)
            if watchlist is None or watchlist.user_id != user_id:
                return False
            del self._watchlists[watchlist_id]
            self._watchlist_assets.pop(watchlist_id, None)
            return True

    def get_watchlist(self, user_id: UUID, watchlist_id: UUID) -> WatchlistRead | None:
        with self._lock:
            watchlist = self._watchlists.get(watchlist_id)
            if watchlist is None or watchlist.user_id != user_id:
                return None
            return watchlist

    def add_watchlist_asset(
        self, user_id: UUID, watchlist_id: UUID, payload: WatchlistAssetCreate
    ) -> WatchlistAssetRead | None:
        if self.get_watchlist(user_id, watchlist_id) is None:
            return None

        asset = WatchlistAssetRead(
            id=uuid4(),
            watchlist_id=watchlist_id,
            symbol=payload.symbol.upper(),
            asset_type=payload.asset_type,
        )
        with self._lock:
            self._watchlist_assets.setdefault(watchlist_id, []).append(asset)
        return asset

    def remove_watchlist_asset(self, user_id: UUID, watchlist_id: UUID, asset_id: UUID) -> bool:
        if self.get_watchlist(user_id, watchlist_id) is None:
            return False
        with self._lock:
            before = self._watchlist_assets.get(watchlist_id, [])
            after = [a for a in before if a.id != asset_id]
            if len(after) == len(before):
                return False
            self._watchlist_assets[watchlist_id] = after
            return True

    def list_watchlist_assets(self, user_id: UUID, watchlist_id: UUID) -> list[WatchlistAssetRead] | None:
        if self.get_watchlist(user_id, watchlist_id) is None:
            return None
        with self._lock:
            return list(self._watchlist_assets.get(watchlist_id, []))

    def list_strategies(self, user_id: UUID) -> list[StrategyRead]:
        with self._lock:
            return [strategy for strategy in self._strategies.values() if strategy.user_id == user_id]

    def create_strategy(self, user_id: UUID, payload: StrategyCreate) -> StrategyRead:
        strategy = StrategyRead(
            id=uuid4(),
            user_id=user_id,
            name=payload.name,
            strategy_type=payload.strategy_type,
            parameters=payload.parameters,
        )
        with self._lock:
            self._strategies[strategy.id] = strategy
        return strategy

    def create_backtest_run(
        self,
        user_id: UUID,
        payload: BacktestRunCreate,
        trades: list[BacktestTradeCreate],
    ) -> BacktestRunRead:
        run_id = uuid4()
        trade_rows = [
            BacktestTradeRead(
                id=uuid4(),
                backtest_run_id=run_id,
                symbol=trade.symbol,
                side=trade.side,
                quantity=trade.quantity,
                price=trade.price,
                fees=trade.fees,
                pnl=trade.pnl,
                reason=trade.reason,
                executed_at=trade.executed_at,
            )
            for trade in trades
        ]
        run = BacktestRunRead(
            id=run_id,
            user_id=user_id,
            strategy_id=payload.strategy_id,
            strategy_name=payload.strategy_name,
            strategy_type=payload.strategy_type,
            symbols=payload.symbols,
            parameters=payload.parameters,
            assumptions=payload.assumptions,
            metrics=payload.metrics,
            equity_curve=payload.equity_curve,
            trades=trade_rows,
        )
        with self._lock:
            self._backtest_runs[run.id] = run
            self._backtest_trades[run.id] = trade_rows
        return run

    def list_backtest_runs(self, user_id: UUID, limit: int = 20) -> list[BacktestRunRead]:
        with self._lock:
            runs = [run for run in self._backtest_runs.values() if run.user_id == user_id]
            return sorted(runs, key=lambda row: row.created_at, reverse=True)[:limit]

    def get_backtest_run(self, user_id: UUID, run_id: UUID) -> BacktestRunRead | None:
        with self._lock:
            run = self._backtest_runs.get(run_id)
            return run if run is not None and run.user_id == user_id else None

    def delete_backtest_run(self, user_id: UUID, run_id: UUID) -> bool:
        with self._lock:
            run = self._backtest_runs.get(run_id)
            if run is None or run.user_id != user_id:
                return False
            del self._backtest_runs[run_id]
            self._backtest_trades.pop(run_id, None)
            return True

    def create_replay_session(self, user_id: UUID, payload: ReplaySessionCreate, *, total_bars: int) -> ReplaySessionRead:
        session = ReplaySessionRead(
            user_id=user_id,
            name=payload.name,
            symbol=payload.symbol,
            start_date=payload.start_date,
            end_date=payload.end_date,
            initial_balance=payload.initial_balance,
            cash=payload.initial_balance,
            total_bars=total_bars,
        )
        with self._lock:
            self._replay_sessions[session.id] = session
        return session

    def list_replay_sessions(self, user_id: UUID, limit: int = 50) -> list[ReplaySessionRead]:
        with self._lock:
            sessions = [session for session in self._replay_sessions.values() if session.user_id == user_id]
            return sorted(sessions, key=lambda row: row.created_at, reverse=True)[:limit]

    def get_replay_session(self, user_id: UUID, session_id: UUID) -> ReplaySessionRead | None:
        with self._lock:
            session = self._replay_sessions.get(session_id)
            return session if session is not None and session.user_id == user_id else None

    def update_replay_session(self, user_id: UUID, session_id: UUID, payload: ReplaySessionUpdate) -> ReplaySessionRead | None:
        with self._lock:
            session = self._replay_sessions.get(session_id)
            if session is None or session.user_id != user_id:
                return None
            updates = payload.model_dump(exclude_unset=True)
            updates["updated_at"] = datetime.now(timezone.utc)
            updated = session.model_copy(update=updates)
            self._replay_sessions[session_id] = updated
            return updated

    def delete_replay_session(self, user_id: UUID, session_id: UUID) -> bool:
        with self._lock:
            session = self._replay_sessions.get(session_id)
            if session is None or session.user_id != user_id:
                return False
            del self._replay_sessions[session_id]
            return True

    def create_notification_channel(
        self,
        user_id: UUID,
        payload: NotificationChannelCreate,
        *,
        encrypted_destination: str | None,
        encrypted_config: dict,
    ) -> NotificationChannelRead:
        channel = NotificationChannelRead(
            id=uuid4(),
            user_id=user_id,
            channel_type=payload.channel_type,
            name=payload.name,
            destination_label=_destination_label(payload.destination),
            config=_redacted_config(payload.config),
            is_active=payload.is_active,
        )
        with self._lock:
            self._notification_channels[channel.id] = channel
            self._notification_secrets[channel.id] = {
                "encrypted_destination": encrypted_destination,
                "encrypted_config": encrypted_config,
            }
        return channel

    def list_notification_channels(self, user_id: UUID) -> list[NotificationChannelRead]:
        with self._lock:
            return [channel for channel in self._notification_channels.values() if channel.user_id == user_id]

    def create_alert(self, user_id: UUID, payload: AlertCreate) -> AlertRead:
        alert = AlertRead(
            id=uuid4(),
            user_id=user_id,
            name=payload.name,
            alert_type=payload.alert_type,
            symbol=payload.symbol.upper() if payload.symbol else None,
            condition=payload.condition,
            channels=payload.channels,
            is_active=payload.is_active,
        )
        with self._lock:
            self._alerts[alert.id] = alert
        return alert

    def list_alerts(self, user_id: UUID) -> list[AlertRead]:
        with self._lock:
            alerts = [alert for alert in self._alerts.values() if alert.user_id == user_id]
            return sorted(alerts, key=lambda row: row.created_at, reverse=True)

    def update_alert(self, user_id: UUID, alert_id: UUID, payload: AlertUpdate) -> AlertRead | None:
        with self._lock:
            current = self._alerts.get(alert_id)
            if current is None or current.user_id != user_id:
                return None
            changes = payload.model_dump(exclude_unset=True)
            changes["updated_at"] = datetime.now(timezone.utc)
            updated = current.model_copy(update=changes)
            self._alerts[alert_id] = updated
            return updated

    def delete_alert(self, user_id: UUID, alert_id: UUID) -> bool:
        with self._lock:
            current = self._alerts.get(alert_id)
            if current is None or current.user_id != user_id:
                return False
            del self._alerts[alert_id]
            return True

    def list_active_alerts(self) -> list[AlertRead]:
        with self._lock:
            return [alert for alert in self._alerts.values() if alert.is_active]

    def update_alert_triggered_at(self, alert_id: UUID, triggered_at: datetime) -> AlertRead | None:
        with self._lock:
            current = self._alerts.get(alert_id)
            if current is None:
                return None
            updated = current.model_copy(update={"last_triggered_at": triggered_at, "updated_at": triggered_at})
            self._alerts[alert_id] = updated
            return updated

    def create_alert_event(self, payload: AlertEventCreate) -> AlertEventRead:
        event = AlertEventRead(id=uuid4(), **payload.model_dump())
        with self._lock:
            self._alert_events[event.id] = event
        return event

    def list_alert_events(self, user_id: UUID, limit: int = 20) -> list[AlertEventRead]:
        with self._lock:
            events = [event for event in self._alert_events.values() if event.user_id == user_id]
            return sorted(events, key=lambda row: row.created_at, reverse=True)[:limit]

    def get_news_digest_preference(self, user_id: UUID) -> NewsDigestPreferenceRead | None:
        with self._lock:
            return self._news_digest_preferences.get(user_id)

    def upsert_news_digest_preference(
        self,
        user_id: UUID,
        email: str | None,
        payload: NewsDigestPreferenceUpsert,
        next_run_at: datetime | None,
    ) -> NewsDigestPreferenceRead:
        now = datetime.now(timezone.utc)
        with self._lock:
            current = self._news_digest_preferences.get(user_id)
            preference = NewsDigestPreferenceRead(
                **payload.model_dump(),
                user_id=user_id,
                email=email,
                next_run_at=next_run_at,
                last_sent_at=current.last_sent_at if current else None,
                created_at=current.created_at if current else now,
                updated_at=now,
            )
            self._news_digest_preferences[user_id] = preference
            return preference

    def list_due_news_digest_preferences(self, now: datetime) -> list[NewsDigestPreferenceRead]:
        with self._lock:
            return [
                preference
                for preference in self._news_digest_preferences.values()
                if preference.is_enabled
                and preference.email
                and preference.next_run_at is not None
                and preference.next_run_at <= now
            ]

    def list_user_watchlist_symbols(self, user_id: UUID, limit: int = 20) -> list[str]:
        with self._lock:
            owned = {row.id for row in self._watchlists.values() if row.user_id == user_id}
            symbols = {
                asset.symbol.upper()
                for watchlist_id, assets in self._watchlist_assets.items()
                if watchlist_id in owned
                for asset in assets
            }
            return sorted(symbols)[:limit]

    def claim_news_digest_delivery(self, user_id: UUID, digest_date: date) -> NewsDigestDeliveryRead | None:
        key = (user_id, digest_date.isoformat())
        with self._lock:
            if key in self._news_digest_deliveries:
                return None
            delivery = NewsDigestDeliveryRead(user_id=user_id, digest_date=digest_date)
            self._news_digest_deliveries[key] = delivery
            return delivery

    def finish_news_digest_delivery(
        self,
        delivery_id: UUID,
        *,
        status: str,
        source_symbols: list[str],
        article_count: int,
        subject: str,
        provider_message_id: str | None = None,
        error: str | None = None,
    ) -> NewsDigestDeliveryRead | None:
        with self._lock:
            for key, current in self._news_digest_deliveries.items():
                if current.id != delivery_id:
                    continue
                updated = current.model_copy(update={
                    "status": status,
                    "source_symbols": source_symbols,
                    "article_count": article_count,
                    "subject": subject,
                    "provider_message_id": provider_message_id,
                    "error": error,
                    "updated_at": datetime.now(timezone.utc),
                })
                self._news_digest_deliveries[key] = updated
                if status == "sent":
                    preference = self._news_digest_preferences.get(current.user_id)
                    if preference:
                        self._news_digest_preferences[current.user_id] = preference.model_copy(
                            update={"last_sent_at": datetime.now(timezone.utc)}
                        )
                return updated
            return None

    def advance_news_digest_schedule(self, user_id: UUID, next_run_at: datetime) -> None:
        with self._lock:
            current = self._news_digest_preferences.get(user_id)
            if current:
                self._news_digest_preferences[user_id] = current.model_copy(
                    update={
                        "next_run_at": next_run_at,
                        "last_sent_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    }
                )

    def create_risk_snapshot(self, user_id: UUID, payload: RiskSnapshotCreate) -> RiskSnapshotRead:
        if self.get_portfolio(user_id, payload.portfolio_id) is None:
            raise ValueError("Portfolio not found")
        snapshot = RiskSnapshotRead(id=uuid4(), user_id=user_id, **payload.model_dump())
        with self._lock:
            self._risk_snapshots[snapshot.id] = snapshot
        return snapshot

    def list_risk_snapshots(self, user_id: UUID, portfolio_id: UUID, limit: int = 10) -> list[RiskSnapshotRead]:
        with self._lock:
            snapshots = [
                snapshot
                for snapshot in self._risk_snapshots.values()
                if snapshot.user_id == user_id and snapshot.portfolio_id == portfolio_id
            ]
            return sorted(snapshots, key=lambda row: row.created_at, reverse=True)[:limit]

    def create_journal_entry(self, user_id: UUID, payload: JournalEntryCreate) -> JournalEntryRead:
        pnl, return_pct = _trade_result(payload)
        now = datetime.now(timezone.utc)
        entry = JournalEntryRead(
            id=uuid4(),
            user_id=user_id,
            symbol=payload.symbol.upper(),
            direction=payload.direction,
            entry_price=payload.entry_price,
            exit_price=payload.exit_price,
            quantity=payload.quantity,
            fees=payload.fees,
            strategy_id=payload.strategy_id,
            reason_entry=payload.reason_entry,
            reason_exit=payload.reason_exit,
            emotion_tag=payload.emotion_tag,
            mistake_tag=payload.mistake_tag,
            notes=payload.notes,
            tags=payload.tags,
            opened_at=payload.opened_at,
            closed_at=payload.closed_at,
            pnl=pnl,
            return_pct=return_pct,
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self._journal_entries[entry.id] = entry
        return entry

    def list_journal_entries(self, user_id: UUID, limit: int = 50) -> list[JournalEntryRead]:
        with self._lock:
            entries = [entry for entry in self._journal_entries.values() if entry.user_id == user_id]
            return sorted(entries, key=lambda row: row.created_at, reverse=True)[:limit]

    def create_quant_validation_run(self, user_id: UUID, payload: QuantValidationRunCreate) -> QuantValidationRunRead:
        run = QuantValidationRunRead(id=uuid4(), user_id=user_id, **payload.model_dump())
        with self._lock:
            self._quant_validation_runs[run.id] = run
        return run

    def create_strategy_export(self, user_id: UUID, payload: StrategyExportCreate) -> StrategyExportRead:
        export = StrategyExportRead(id=uuid4(), user_id=user_id, **payload.model_dump())
        with self._lock:
            self._strategy_exports[export.id] = export
        return export


store = UserScopedStore()


class SupabaseRestStore:
    """Small Supabase REST adapter for SaaS foundation CRUD."""

    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._base_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    def _request(
        self,
        method: str,
        table: str,
        query: dict[str, str] | None = None,
        body: dict[str, Any] | list[dict[str, Any]] | None = None,
    ) -> list[dict]:
        url = f"{self._base_url}/rest/v1/{table}"
        if query:
            url = f"{url}?{urlencode(query)}"

        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")

        request = Request(
            url,
            data=data,
            method=method,
            headers={
                "apikey": self._service_role_key,
                "Authorization": f"Bearer {self._service_role_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
        )
        try:
            with urlopen(request, timeout=20) as response:
                raw = response.read().decode("utf-8")
                if not raw:
                    return []

                payload = json.loads(raw)
                return payload if isinstance(payload, list) else [payload]
        except HTTPError as error:
            raw_error = error.read()
            try:
                error_payload = json.loads(raw_error.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                error_payload = {}

            error_code = str(error_payload.get("code", ""))
            error_context = json.dumps(error_payload).lower()
            if (
                error.code in {400, 404}
                and error_code in {"PGRST204", "PGRST205", "42P01"}
                and table.lower() in error_context
            ):
                raise SupabaseSchemaUnavailableError(table) from error
            raise HTTPError(
                error.filename,
                error.code,
                error.msg,
                error.hdrs,
                BytesIO(raw_error),
            ) from error

    def list_portfolios(self, user_id: UUID) -> list[PortfolioRead]:
        rows = self._request("GET", "portfolios", {"select": "*", "user_id": f"eq.{user_id}"})
        return [PortfolioRead.model_validate(row) for row in rows]

    def get_investment_policy(self, user_id: UUID) -> InvestmentPolicyRead | None:
        rows = self._request(
            "GET",
            "investment_policies",
            {"select": "*", "user_id": f"eq.{user_id}", "limit": "1"},
        )
        if not rows:
            return None
        row = rows[0]
        return InvestmentPolicyRead.model_validate({
            **row,
            "goals": row.get("goals_json", {}),
            "target_allocation": row.get("target_allocation_json", {}),
            "permitted_assets": row.get("permitted_assets_json", []),
            "rebalancing_policy": row.get("rebalancing_policy_json", {}),
            "tax_preferences": row.get("tax_preferences_json", {}),
        })

    def list_investment_theses(
        self,
        user_id: UUID,
        portfolio_id: UUID | None = None,
    ) -> list[InvestmentThesisRead]:
        query = {"select": "*", "user_id": f"eq.{user_id}", "order": "updated_at.desc"}
        if portfolio_id is not None:
            query["portfolio_id"] = f"eq.{portfolio_id}"
        rows = self._request("GET", "investment_theses", query)
        return [InvestmentThesisRead.model_validate({
            **row,
            "supporting_evidence": row.get("supporting_evidence_json", []),
            "risk_evidence": row.get("risk_evidence_json", []),
            "invalidation_conditions": row.get("invalidation_conditions_json", []),
        }) for row in rows]

    def upsert_investment_thesis(
        self,
        user_id: UUID,
        holding: HoldingRead,
        payload: InvestmentThesisUpsert,
    ) -> InvestmentThesisRead:
        body = {
            "user_id": str(user_id),
            "portfolio_id": str(holding.portfolio_id),
            "holding_id": str(holding.id),
            "symbol": holding.symbol,
            "statement": payload.statement,
            "supporting_evidence_json": payload.supporting_evidence,
            "risk_evidence_json": payload.risk_evidence,
            "invalidation_conditions_json": payload.invalidation_conditions,
            "status": payload.status.value,
            "next_review_at": payload.next_review_at.isoformat() if payload.next_review_at else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        existing = self._request(
            "GET",
            "investment_theses",
            {"select": "id", "user_id": f"eq.{user_id}", "holding_id": f"eq.{holding.id}", "limit": "1"},
        )
        if existing:
            rows = self._request(
                "PATCH",
                "investment_theses",
                {"id": f"eq.{existing[0]['id']}", "user_id": f"eq.{user_id}"},
                body=body,
            )
        else:
            rows = self._request("POST", "investment_theses", body=body)
        row = rows[0]
        return InvestmentThesisRead.model_validate({
            **row,
            "supporting_evidence": row.get("supporting_evidence_json", []),
            "risk_evidence": row.get("risk_evidence_json", []),
            "invalidation_conditions": row.get("invalidation_conditions_json", []),
        })

    def list_investment_decisions(
        self,
        user_id: UUID,
        portfolio_id: UUID | None = None,
        limit: int = 50,
    ) -> list[InvestmentDecisionRead]:
        query = {
            "select": "*",
            "user_id": f"eq.{user_id}",
            "order": "created_at.desc",
            "limit": str(limit),
        }
        if portfolio_id is not None:
            query["portfolio_id"] = f"eq.{portfolio_id}"
        rows = self._request("GET", "investment_decisions", query)
        return [InvestmentDecisionRead.model_validate(row) for row in rows]

    def create_investment_decision(
        self,
        user_id: UUID,
        holding: HoldingRead,
        payload: InvestmentDecisionCreate,
    ) -> InvestmentDecisionRead:
        rows = self._request("POST", "investment_decisions", body={
            "user_id": str(user_id),
            "portfolio_id": str(holding.portfolio_id),
            "holding_id": str(holding.id),
            "symbol": holding.symbol,
            "action": payload.action.value,
            "rationale": payload.rationale,
            "policy_exception": payload.policy_exception,
        })
        return InvestmentDecisionRead.model_validate(rows[0])

    def upsert_investment_policy(
        self,
        user_id: UUID,
        payload: InvestmentPolicyUpsert,
    ) -> InvestmentPolicyRead:
        existing = self.get_investment_policy(user_id)
        body = {
            "user_id": str(user_id),
            "name": payload.name,
            "status": payload.status.value,
            "goals_json": payload.goals,
            "time_horizon": payload.time_horizon,
            "target_allocation_json": payload.target_allocation,
            "max_position_weight": payload.max_position_weight,
            "max_sector_weight": payload.max_sector_weight,
            "max_drawdown": payload.max_drawdown,
            "minimum_cash_weight": payload.minimum_cash_weight,
            "permitted_assets_json": payload.permitted_assets,
            "rebalancing_policy_json": payload.rebalancing_policy,
            "tax_preferences_json": payload.tax_preferences,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if existing:
            rows = self._request("PATCH", "investment_policies", {"id": f"eq.{existing.id}", "user_id": f"eq.{user_id}"}, body=body)
        else:
            rows = self._request("POST", "investment_policies", body=body)
        row = rows[0]
        return InvestmentPolicyRead.model_validate({
            **row,
            "goals": row.get("goals_json", {}),
            "target_allocation": row.get("target_allocation_json", {}),
            "permitted_assets": row.get("permitted_assets_json", []),
            "rebalancing_policy": row.get("rebalancing_policy_json", {}),
            "tax_preferences": row.get("tax_preferences_json", {}),
        })

    def create_portfolio(self, user_id: UUID, payload: PortfolioCreate) -> PortfolioRead:
        rows = self._request(
            "POST",
            "portfolios",
            body={"user_id": str(user_id), "name": payload.name, "base_currency": payload.base_currency.upper()},
        )
        return PortfolioRead.model_validate(rows[0])

    def get_portfolio(self, user_id: UUID, portfolio_id: UUID) -> PortfolioRead | None:
        rows = self._request(
            "GET",
            "portfolios",
            {"select": "*", "id": f"eq.{portfolio_id}", "user_id": f"eq.{user_id}", "limit": "1"},
        )
        return PortfolioRead.model_validate(rows[0]) if rows else None

    def get_holding_by_id(self, user_id: UUID, holding_id: UUID) -> HoldingRead | None:
        rows = self._request("GET", "holdings", {"select": "*", "id": f"eq.{holding_id}", "limit": "1"})
        if not rows:
            return None
        holding = HoldingRead.model_validate(rows[0])
        return holding if self.get_portfolio(user_id, holding.portfolio_id) is not None else None

    def delete_portfolio(self, user_id: UUID, portfolio_id: UUID) -> bool:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return False
        self._request("DELETE", "portfolios", {"id": f"eq.{portfolio_id}", "user_id": f"eq.{user_id}"})
        return True

    def add_holding(self, user_id: UUID, portfolio_id: UUID, payload: HoldingCreate) -> HoldingRead | None:
        portfolio = self.get_portfolio(user_id, portfolio_id)
        if portfolio is None:
            return None
        rows = self._request(
            "POST",
            "holdings",
            body={
                "portfolio_id": str(portfolio_id),
                "symbol": payload.symbol.upper(),
                "asset_type": payload.asset_type,
                "quantity": payload.quantity,
                "average_cost": payload.average_cost,
                "cost_currency": (payload.cost_currency or portfolio.base_currency).upper(),
            },
        )
        return HoldingRead.model_validate(rows[0])

    def update_holding(self, user_id: UUID, portfolio_id: UUID, holding_id: UUID, payload: HoldingUpdate) -> HoldingRead | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        body = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
        rows = self._request("PATCH", "holdings", {"id": f"eq.{holding_id}", "portfolio_id": f"eq.{portfolio_id}"}, body=body)
        if not rows:
            return None
        return HoldingRead.model_validate(rows[0])

    def list_holdings(self, user_id: UUID, portfolio_id: UUID) -> list[HoldingRead] | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        rows = self._request("GET", "holdings", {"select": "*", "portfolio_id": f"eq.{portfolio_id}"})
        return [HoldingRead.model_validate(row) for row in rows]

    def classify_holding(
        self,
        user_id: UUID,
        portfolio_id: UUID,
        holding_id: UUID,
        payload: HoldingClassificationUpdate,
    ) -> HoldingRead | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        rows = self._request(
            "PATCH",
            "holdings",
            {"id": f"eq.{holding_id}", "portfolio_id": f"eq.{portfolio_id}"},
            body={
                "book_type": payload.book_type.value,
                "classification_source": "user",
                "classified_at": datetime.now(timezone.utc).isoformat(),
                "classified_by": str(user_id),
            },
        )
        return HoldingRead.model_validate(rows[0]) if rows else None

    def list_portfolio_book_events(
        self,
        user_id: UUID,
        portfolio_id: UUID,
    ) -> list[PortfolioBookEventRead] | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        rows = self._request(
            "GET",
            "portfolio_book_events",
            {
                "select": "*",
                "user_id": f"eq.{user_id}",
                "portfolio_id": f"eq.{portfolio_id}",
                "order": "created_at.desc",
            },
        )
        return [PortfolioBookEventRead.model_validate(row) for row in rows]

    def delete_holding(self, user_id: UUID, portfolio_id: UUID, holding_id: UUID) -> bool:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return False
        self._request("DELETE", "holdings", {"id": f"eq.{holding_id}", "portfolio_id": f"eq.{portfolio_id}"})
        return True

    def _sync_holding_for_recurring_buy(
        self,
        portfolio: PortfolioRead,
        recurring: RecurringBuyRead,
    ) -> HoldingRead:
        rows = []
        if recurring.linked_holding_id is not None:
            rows = self._request(
                "GET",
                "holdings",
                {"select": "*", "id": f"eq.{recurring.linked_holding_id}", "portfolio_id": f"eq.{portfolio.id}", "limit": "1"},
            )
        if not rows:
            rows = self._request(
                "GET",
                "holdings",
                {"select": "*", "portfolio_id": f"eq.{portfolio.id}", "symbol": f"eq.{recurring.symbol.upper()}", "limit": "1"},
            )

        body = {
            "portfolio_id": str(portfolio.id),
            "symbol": recurring.symbol.upper(),
            "asset_type": "equity",
            "quantity": recurring.filled_quantity,
            "average_cost": recurring.fill_price,
            "cost_currency": (recurring.fill_currency or portfolio.base_currency).upper(),
        }
        if rows:
            updated = self._request("PATCH", "holdings", {"id": f"eq.{rows[0]['id']}", "portfolio_id": f"eq.{portfolio.id}"}, body=body)
            return HoldingRead.model_validate(updated[0])
        created = self._request("POST", "holdings", body=body)
        return HoldingRead.model_validate(created[0])

    def list_recurring_buys(self, user_id: UUID, portfolio_id: UUID) -> list[RecurringBuyRead] | None:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return None
        try:
            rows = self._request(
                "GET",
                "portfolio_recurring_buys",
                {"select": "*", "portfolio_id": f"eq.{portfolio_id}", "order": "executed_at.desc"},
            )
        except SupabaseSchemaUnavailableError:
            logger.warning("Recurring-buy storage is unavailable; apply Supabase migrations 014 and 015.")
            return []
        return [RecurringBuyRead.model_validate(row) for row in rows]

    def _ensure_recurring_buy_schema(self) -> None:
        self._request(
            "GET",
            "portfolio_recurring_buys",
            {
                "select": (
                    "id,linked_holding_id,purchase_mode,recurrence_frequency,"
                    "schedule_time,schedule_day_of_week,schedule_day_of_month,schedule_month"
                ),
                "limit": "0",
            },
        )

    def add_recurring_buy(self, user_id: UUID, portfolio_id: UUID, payload: RecurringBuyCreate) -> RecurringBuyRead | None:
        portfolio = self.get_portfolio(user_id, portfolio_id)
        if portfolio is None:
            return None
        # Validate the optional schema before creating or updating a linked
        # holding, so a missing migration cannot leave a partial write behind.
        self._ensure_recurring_buy_schema()
        recurring = RecurringBuyRead(
            portfolio_id=portfolio_id,
            symbol=payload.symbol,
            account=payload.account,
            status=payload.status,
            purchase_mode=payload.purchase_mode,
            entered_amount=payload.entered_amount,
            entered_currency=payload.entered_currency,
            filled_quantity=payload.filled_quantity,
            fill_price=payload.fill_price,
            fill_currency=payload.fill_currency,
            exchange_rate=payload.exchange_rate,
            recurrence_frequency=payload.recurrence_frequency,
            schedule_time=payload.schedule_time,
            schedule_day_of_week=payload.schedule_day_of_week,
            schedule_day_of_month=payload.schedule_day_of_month,
            schedule_month=payload.schedule_month,
            executed_at=payload.executed_at,
        )
        holding = self._sync_holding_for_recurring_buy(portfolio, recurring)
        rows = self._request(
            "POST",
            "portfolio_recurring_buys",
            body={
                "portfolio_id": str(portfolio_id),
                "linked_holding_id": str(holding.id),
                "symbol": payload.symbol.upper(),
                "account": payload.account,
                "status": payload.status,
                "purchase_mode": payload.purchase_mode,
                "entered_amount": payload.entered_amount,
                "entered_currency": payload.entered_currency,
                "filled_quantity": payload.filled_quantity,
                "fill_price": payload.fill_price,
                "fill_currency": payload.fill_currency,
                "exchange_rate": payload.exchange_rate,
                "recurrence_frequency": payload.recurrence_frequency,
                "schedule_time": payload.schedule_time,
                "schedule_day_of_week": payload.schedule_day_of_week,
                "schedule_day_of_month": payload.schedule_day_of_month,
                "schedule_month": payload.schedule_month,
                "executed_at": payload.executed_at.isoformat(),
            },
        )
        return RecurringBuyRead.model_validate(rows[0])

    def update_recurring_buy(
        self,
        user_id: UUID,
        portfolio_id: UUID,
        recurring_buy_id: UUID,
        payload: RecurringBuyUpdate,
    ) -> RecurringBuyRead | None:
        portfolio = self.get_portfolio(user_id, portfolio_id)
        if portfolio is None:
            return None
        self._ensure_recurring_buy_schema()
        existing_rows = self._request(
            "GET",
            "portfolio_recurring_buys",
            {"select": "*", "id": f"eq.{recurring_buy_id}", "portfolio_id": f"eq.{portfolio_id}", "limit": "1"},
        )
        if not existing_rows:
            return None
        existing = RecurringBuyRead.model_validate(existing_rows[0])
        updates = payload.model_dump(exclude_none=True)
        updated = existing.model_copy(update=updates)
        holding = self._sync_holding_for_recurring_buy(portfolio, updated)
        body = {
            **{
                key: (value.isoformat() if isinstance(value, datetime) else value)
                for key, value in updates.items()
            },
            "linked_holding_id": str(holding.id),
        }
        rows = self._request(
            "PATCH",
            "portfolio_recurring_buys",
            {"id": f"eq.{recurring_buy_id}", "portfolio_id": f"eq.{portfolio_id}"},
            body=body,
        )
        if not rows:
            return None
        return RecurringBuyRead.model_validate(rows[0])

    def delete_recurring_buy(self, user_id: UUID, portfolio_id: UUID, recurring_buy_id: UUID) -> bool:
        if self.get_portfolio(user_id, portfolio_id) is None:
            return False
        rows = self._request(
            "GET",
            "portfolio_recurring_buys",
            {"select": "*", "id": f"eq.{recurring_buy_id}", "portfolio_id": f"eq.{portfolio_id}", "limit": "1"},
        )
        if not rows:
            return False
        recurring = RecurringBuyRead.model_validate(rows[0])
        self._request(
            "DELETE",
            "portfolio_recurring_buys",
            {"id": f"eq.{recurring_buy_id}", "portfolio_id": f"eq.{portfolio_id}"},
        )
        if recurring.linked_holding_id is not None:
            self._request(
                "DELETE",
                "holdings",
                {"id": f"eq.{recurring.linked_holding_id}", "portfolio_id": f"eq.{portfolio_id}"},
            )
        return True

    def list_watchlists(self, user_id: UUID) -> list[WatchlistRead]:
        rows = self._request("GET", "watchlists", {"select": "*", "user_id": f"eq.{user_id}"})
        return [WatchlistRead.model_validate(row) for row in rows]

    def create_watchlist(self, user_id: UUID, payload: WatchlistCreate) -> WatchlistRead:
        rows = self._request("POST", "watchlists", body={"user_id": str(user_id), "name": payload.name})
        return WatchlistRead.model_validate(rows[0])

    def get_watchlist(self, user_id: UUID, watchlist_id: UUID) -> WatchlistRead | None:
        rows = self._request(
            "GET",
            "watchlists",
            {"select": "*", "id": f"eq.{watchlist_id}", "user_id": f"eq.{user_id}", "limit": "1"},
        )
        return WatchlistRead.model_validate(rows[0]) if rows else None

    def add_watchlist_asset(
        self, user_id: UUID, watchlist_id: UUID, payload: WatchlistAssetCreate
    ) -> WatchlistAssetRead | None:
        if self.get_watchlist(user_id, watchlist_id) is None:
            return None
        rows = self._request(
            "POST",
            "watchlist_assets",
            body={"watchlist_id": str(watchlist_id), "symbol": payload.symbol.upper(), "asset_type": payload.asset_type},
        )
        return WatchlistAssetRead.model_validate(rows[0])

    def delete_watchlist(self, user_id: UUID, watchlist_id: UUID) -> bool:
        if self.get_watchlist(user_id, watchlist_id) is None:
            return False
        self._request("DELETE", "watchlists", {"id": f"eq.{watchlist_id}", "user_id": f"eq.{user_id}"})
        return True

    def remove_watchlist_asset(self, user_id: UUID, watchlist_id: UUID, asset_id: UUID) -> bool:
        if self.get_watchlist(user_id, watchlist_id) is None:
            return False
        self._request("DELETE", "watchlist_assets", {"id": f"eq.{asset_id}", "watchlist_id": f"eq.{watchlist_id}"})
        return True

    def list_watchlist_assets(self, user_id: UUID, watchlist_id: UUID) -> list[WatchlistAssetRead] | None:
        if self.get_watchlist(user_id, watchlist_id) is None:
            return None
        rows = self._request("GET", "watchlist_assets", {"select": "*", "watchlist_id": f"eq.{watchlist_id}"})
        return [WatchlistAssetRead.model_validate(row) for row in rows]

    def list_strategies(self, user_id: UUID) -> list[StrategyRead]:
        rows = self._request("GET", "strategies", {"select": "*", "user_id": f"eq.{user_id}", "order": "created_at.desc"})
        return [StrategyRead.model_validate(row) for row in rows]

    def create_strategy(self, user_id: UUID, payload: StrategyCreate) -> StrategyRead:
        rows = self._request(
            "POST",
            "strategies",
            body={
                "user_id": str(user_id),
                "name": payload.name,
                "strategy_type": payload.strategy_type,
                "parameters": payload.parameters,
            },
        )
        return StrategyRead.model_validate(rows[0])

    def create_backtest_run(
        self,
        user_id: UUID,
        payload: BacktestRunCreate,
        trades: list[BacktestTradeCreate],
    ) -> BacktestRunRead:
        body = {
            "user_id": str(user_id),
            "strategy_id": str(payload.strategy_id) if payload.strategy_id else None,
            "strategy_name": payload.strategy_name,
            "strategy_type": payload.strategy_type,
            "symbols": payload.symbols,
            "parameters": payload.parameters,
            "assumptions": payload.assumptions,
            "metrics": payload.metrics,
            "equity_curve": payload.equity_curve,
        }
        run_rows = self._request("POST", "backtest_runs", body=body)
        run = BacktestRunRead.model_validate(run_rows[0])
        if trades:
            trade_rows = self._request(
                "POST",
                "backtest_trades",
                body=[
                    {
                        "backtest_run_id": str(run.id),
                        "symbol": trade.symbol,
                        "side": trade.side,
                        "quantity": trade.quantity,
                        "price": trade.price,
                        "fees": trade.fees,
                        "pnl": trade.pnl,
                        "reason": trade.reason,
                        "executed_at": trade.executed_at.isoformat(),
                    }
                    for trade in trades
                ],
            )
            run.trades = [BacktestTradeRead.model_validate(row) for row in trade_rows]
        return run

    def list_backtest_runs(self, user_id: UUID, limit: int = 20) -> list[BacktestRunRead]:
        rows = self._request(
            "GET",
            "backtest_runs",
            {"select": "*,backtest_trades(*)", "user_id": f"eq.{user_id}", "order": "created_at.desc", "limit": str(limit)},
        )
        for row in rows:
            if "backtest_trades" in row and "trades" not in row:
                row["trades"] = row.pop("backtest_trades")
        return [BacktestRunRead.model_validate(row) for row in rows]

    def get_backtest_run(self, user_id: UUID, run_id: UUID) -> BacktestRunRead | None:
        rows = self._request(
            "GET",
            "backtest_runs",
            {"select": "*,backtest_trades(*)", "id": f"eq.{run_id}", "user_id": f"eq.{user_id}", "limit": "1"},
        )
        if not rows:
            return None
        row = rows[0]
        if "backtest_trades" in row and "trades" not in row:
            row["trades"] = row.pop("backtest_trades")
        return BacktestRunRead.model_validate(row)

    def delete_backtest_run(self, user_id: UUID, run_id: UUID) -> bool:
        if self.get_backtest_run(user_id, run_id) is None:
            return False
        self._request("DELETE", "backtest_runs", {"id": f"eq.{run_id}", "user_id": f"eq.{user_id}"})
        return True

    def create_replay_session(self, user_id: UUID, payload: ReplaySessionCreate, *, total_bars: int) -> ReplaySessionRead:
        body = {
            "user_id": str(user_id),
            "name": payload.name,
            "symbol": payload.symbol,
            "start_date": payload.start_date.isoformat(),
            "end_date": payload.end_date.isoformat(),
            "initial_balance": payload.initial_balance,
            "cash": payload.initial_balance,
            "total_bars": total_bars,
        }
        rows = self._request("POST", "backtest_replay_sessions", body=body)
        return ReplaySessionRead.model_validate(rows[0])

    def list_replay_sessions(self, user_id: UUID, limit: int = 50) -> list[ReplaySessionRead]:
        rows = self._request(
            "GET",
            "backtest_replay_sessions",
            {"user_id": f"eq.{user_id}", "order": "created_at.desc", "limit": str(limit)},
        )
        return [ReplaySessionRead.model_validate(row) for row in rows]

    def get_replay_session(self, user_id: UUID, session_id: UUID) -> ReplaySessionRead | None:
        rows = self._request(
            "GET",
            "backtest_replay_sessions",
            {"id": f"eq.{session_id}", "user_id": f"eq.{user_id}", "limit": "1"},
        )
        return ReplaySessionRead.model_validate(rows[0]) if rows else None

    def update_replay_session(self, user_id: UUID, session_id: UUID, payload: ReplaySessionUpdate) -> ReplaySessionRead | None:
        body = payload.model_dump(exclude_unset=True)
        body["updated_at"] = datetime.now(timezone.utc).isoformat()
        rows = self._request(
            "PATCH",
            "backtest_replay_sessions",
            {"id": f"eq.{session_id}", "user_id": f"eq.{user_id}"},
            body=body,
        )
        return ReplaySessionRead.model_validate(rows[0]) if rows else None

    def delete_replay_session(self, user_id: UUID, session_id: UUID) -> bool:
        if self.get_replay_session(user_id, session_id) is None:
            return False
        self._request("DELETE", "backtest_replay_sessions", {"id": f"eq.{session_id}", "user_id": f"eq.{user_id}"})
        return True

    def create_notification_channel(
        self,
        user_id: UUID,
        payload: NotificationChannelCreate,
        *,
        encrypted_destination: str | None,
        encrypted_config: dict,
    ) -> NotificationChannelRead:
        rows = self._request(
            "POST",
            "notification_channels",
            body={
                "user_id": str(user_id),
                "channel_type": payload.channel_type,
                "name": payload.name,
                "destination_encrypted": encrypted_destination,
                "destination_label": _destination_label(payload.destination),
                "config_encrypted": encrypted_config,
                "config": _redacted_config(payload.config),
                "is_active": payload.is_active,
            },
        )
        return NotificationChannelRead.model_validate(rows[0])

    def list_notification_channels(self, user_id: UUID) -> list[NotificationChannelRead]:
        rows = self._request(
            "GET",
            "notification_channels",
            {"select": "id,user_id,channel_type,name,destination_label,config,is_active,created_at,updated_at", "user_id": f"eq.{user_id}", "order": "created_at.desc"},
        )
        return [NotificationChannelRead.model_validate(row) for row in rows]

    def create_alert(self, user_id: UUID, payload: AlertCreate) -> AlertRead:
        rows = self._request(
            "POST",
            "alerts",
            body={
                "user_id": str(user_id),
                "name": payload.name,
                "alert_type": payload.alert_type,
                "symbol": payload.symbol.upper() if payload.symbol else None,
                "condition": payload.condition,
                "channels": [str(channel_id) for channel_id in payload.channels],
                "is_active": payload.is_active,
            },
        )
        return AlertRead.model_validate(rows[0])

    def list_alerts(self, user_id: UUID) -> list[AlertRead]:
        rows = self._request("GET", "alerts", {"select": "*", "user_id": f"eq.{user_id}", "order": "created_at.desc"})
        return [AlertRead.model_validate(row) for row in rows]

    def update_alert(self, user_id: UUID, alert_id: UUID, payload: AlertUpdate) -> AlertRead | None:
        body = payload.model_dump(exclude_unset=True, mode="json")
        if "symbol" in body and body["symbol"]:
            body["symbol"] = str(body["symbol"]).upper()
        body["updated_at"] = datetime.now(timezone.utc).isoformat()
        rows = self._request(
            "PATCH",
            "alerts",
            {"id": f"eq.{alert_id}", "user_id": f"eq.{user_id}"},
            body=body,
        )
        return AlertRead.model_validate(rows[0]) if rows else None

    def delete_alert(self, user_id: UUID, alert_id: UUID) -> bool:
        rows = self._request(
            "DELETE",
            "alerts",
            {"id": f"eq.{alert_id}", "user_id": f"eq.{user_id}"},
        )
        return bool(rows)

    def list_active_alerts(self) -> list[AlertRead]:
        rows = self._request("GET", "alerts", {"select": "*", "is_active": "eq.true"})
        return [AlertRead.model_validate(row) for row in rows]

    def update_alert_triggered_at(self, alert_id: UUID, triggered_at: datetime) -> AlertRead | None:
        rows = self._request(
            "PATCH",
            "alerts",
            {"id": f"eq.{alert_id}"},
            body={"last_triggered_at": triggered_at.isoformat(), "updated_at": triggered_at.isoformat()},
        )
        return AlertRead.model_validate(rows[0]) if rows else None

    def create_alert_event(self, payload: AlertEventCreate) -> AlertEventRead:
        rows = self._request(
            "POST",
            "alert_events",
            body={
                "alert_id": str(payload.alert_id),
                "user_id": str(payload.user_id),
                "alert_type": payload.alert_type,
                "symbol": payload.symbol,
                "message": payload.message,
                "value": payload.value,
                "metadata": payload.metadata,
            },
        )
        return AlertEventRead.model_validate(rows[0])

    def list_alert_events(self, user_id: UUID, limit: int = 20) -> list[AlertEventRead]:
        rows = self._request(
            "GET",
            "alert_events",
            {"select": "*", "user_id": f"eq.{user_id}", "order": "created_at.desc", "limit": str(limit)},
        )
        return [AlertEventRead.model_validate(row) for row in rows]

    def get_news_digest_preference(self, user_id: UUID) -> NewsDigestPreferenceRead | None:
        rows = self._request(
            "GET",
            "news_digest_preferences",
            {"select": "*,profiles(email)", "user_id": f"eq.{user_id}", "limit": "1"},
        )
        if not rows:
            return None
        row = rows[0]
        profile = row.pop("profiles", None) or {}
        return NewsDigestPreferenceRead.model_validate({**row, "email": profile.get("email")})

    def upsert_news_digest_preference(
        self,
        user_id: UUID,
        email: str | None,
        payload: NewsDigestPreferenceUpsert,
        next_run_at: datetime | None,
    ) -> NewsDigestPreferenceRead:
        body = {
            "user_id": str(user_id),
            **payload.model_dump(mode="json"),
            "next_run_at": next_run_at.isoformat() if next_run_at else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        existing = self.get_news_digest_preference(user_id)
        if existing:
            rows = self._request("PATCH", "news_digest_preferences", {"user_id": f"eq.{user_id}"}, body=body)
        else:
            rows = self._request("POST", "news_digest_preferences", body=body)
        return NewsDigestPreferenceRead.model_validate({**rows[0], "email": email})

    def list_due_news_digest_preferences(self, now: datetime) -> list[NewsDigestPreferenceRead]:
        rows = self._request(
            "GET",
            "news_digest_preferences",
            {
                "select": "*,profiles!inner(email)",
                "is_enabled": "eq.true",
                "next_run_at": f"lte.{now.isoformat()}",
                "order": "next_run_at.asc",
                "limit": "500",
            },
        )
        preferences = []
        for source in rows:
            row = dict(source)
            profile = row.pop("profiles", None) or {}
            if profile.get("email"):
                preferences.append(NewsDigestPreferenceRead.model_validate({**row, "email": profile["email"]}))
        return preferences

    def list_user_watchlist_symbols(self, user_id: UUID, limit: int = 20) -> list[str]:
        watchlists = self._request("GET", "watchlists", {"select": "id", "user_id": f"eq.{user_id}"})
        if not watchlists:
            return []
        ids = ",".join(str(row["id"]) for row in watchlists)
        rows = self._request(
            "GET",
            "watchlist_assets",
            {"select": "symbol", "watchlist_id": f"in.({ids})", "order": "created_at.asc", "limit": str(limit * 3)},
        )
        return list(dict.fromkeys(str(row["symbol"]).upper() for row in rows))[:limit]

    def claim_news_digest_delivery(self, user_id: UUID, digest_date: date) -> NewsDigestDeliveryRead | None:
        rows = self._request(
            "POST",
            "rpc/claim_news_digest_delivery",
            body={"p_user_id": str(user_id), "p_digest_date": digest_date.isoformat()},
        )
        return NewsDigestDeliveryRead.model_validate(rows[0]) if rows else None

    def finish_news_digest_delivery(
        self,
        delivery_id: UUID,
        *,
        status: str,
        source_symbols: list[str],
        article_count: int,
        subject: str,
        provider_message_id: str | None = None,
        error: str | None = None,
    ) -> NewsDigestDeliveryRead | None:
        rows = self._request(
            "PATCH",
            "news_digest_deliveries",
            {"id": f"eq.{delivery_id}"},
            body={
                "status": status,
                "source_symbols": source_symbols,
                "article_count": article_count,
                "subject": subject,
                "provider_message_id": provider_message_id,
                "error": error,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        return NewsDigestDeliveryRead.model_validate(rows[0]) if rows else None

    def advance_news_digest_schedule(self, user_id: UUID, next_run_at: datetime) -> None:
        self._request(
            "PATCH",
            "news_digest_preferences",
            {"user_id": f"eq.{user_id}"},
            body={
                "next_run_at": next_run_at.isoformat(),
                "last_sent_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def create_risk_snapshot(self, user_id: UUID, payload: RiskSnapshotCreate) -> RiskSnapshotRead:
        if self.get_portfolio(user_id, payload.portfolio_id) is None:
            raise ValueError("Portfolio not found")
        rows = self._request(
            "POST",
            "risk_snapshots",
            body={
                "user_id": str(user_id),
                "portfolio_id": str(payload.portfolio_id),
                "metrics": payload.metrics,
                "allocations": payload.allocations,
                "correlation_matrix": payload.correlation_matrix,
                "ai_explanation": payload.ai_explanation,
            },
        )
        return RiskSnapshotRead.model_validate(rows[0])

    def list_risk_snapshots(self, user_id: UUID, portfolio_id: UUID, limit: int = 10) -> list[RiskSnapshotRead]:
        rows = self._request(
            "GET",
            "risk_snapshots",
            {
                "select": "*",
                "user_id": f"eq.{user_id}",
                "portfolio_id": f"eq.{portfolio_id}",
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
        return [RiskSnapshotRead.model_validate(row) for row in rows]

    def create_journal_entry(self, user_id: UUID, payload: JournalEntryCreate) -> JournalEntryRead:
        pnl, return_pct = _trade_result(payload)
        rows = self._request(
            "POST",
            "journal_entries",
            body={
                "user_id": str(user_id),
                "symbol": payload.symbol.upper(),
                "direction": payload.direction,
                "entry_price": payload.entry_price,
                "exit_price": payload.exit_price,
                "quantity": payload.quantity,
                "fees": payload.fees,
                "strategy_id": str(payload.strategy_id) if payload.strategy_id else None,
                "reason_entry": payload.reason_entry,
                "reason_exit": payload.reason_exit,
                "emotion_tag": payload.emotion_tag,
                "mistake_tag": payload.mistake_tag,
                "notes": payload.notes,
                "pnl": pnl,
                "return_pct": return_pct,
                "tags": payload.tags,
                "opened_at": payload.opened_at.isoformat() if payload.opened_at else None,
                "closed_at": payload.closed_at.isoformat() if payload.closed_at else None,
            },
        )
        return JournalEntryRead.model_validate(rows[0])

    def list_journal_entries(self, user_id: UUID, limit: int = 50) -> list[JournalEntryRead]:
        rows = self._request(
            "GET",
            "journal_entries",
            {"select": "*", "user_id": f"eq.{user_id}", "order": "created_at.desc", "limit": str(limit)},
        )
        return [JournalEntryRead.model_validate(row) for row in rows]

    def create_quant_validation_run(self, user_id: UUID, payload: QuantValidationRunCreate) -> QuantValidationRunRead:
        rows = self._request(
            "POST",
            "quant_validation_runs",
            body={
                "user_id": str(user_id),
                "strategy_name": payload.strategy_name,
                "strategy_type": payload.strategy_type,
                "symbols": payload.symbols,
                "method": payload.method,
                "parameters": payload.parameters,
                "assumptions": payload.assumptions,
                "results": payload.results,
            },
        )
        return QuantValidationRunRead.model_validate(rows[0])

    def create_strategy_export(self, user_id: UUID, payload: StrategyExportCreate) -> StrategyExportRead:
        rows = self._request(
            "POST",
            "strategy_exports",
            body={
                "user_id": str(user_id),
                "strategy_name": payload.strategy_name,
                "strategy_type": payload.strategy_type,
                "language": payload.language,
                "parameters": payload.parameters,
                "content": payload.content,
            },
        )
        return StrategyExportRead.model_validate(rows[0])

    def get_subscription(self, user_id: UUID) -> SubscriptionRead:
        rows = self._request("GET", "subscriptions", {"select": "*", "user_id": f"eq.{user_id}", "limit": "1"})
        return SubscriptionRead.model_validate(rows[0]) if rows else SubscriptionRead(user_id=user_id)

    def get_user_plan(self, user_id: UUID) -> Plan | None:
        subscription = self.get_subscription(user_id)
        if subscription.status in {"active", "trialing"}:
            return subscription.plan
        return Plan.FREE

    def upsert_subscription(
        self,
        user_id: UUID,
        *,
        stripe_customer_id: str | None = None,
        stripe_subscription_id: str | None = None,
        plan: Plan = Plan.FREE,
        status: str = "inactive",
        current_period_end: datetime | None = None,
    ) -> SubscriptionRead:
        existing_rows = self._request("GET", "subscriptions", {"select": "*", "user_id": f"eq.{user_id}", "limit": "1"})
        has_existing = bool(existing_rows)
        existing = SubscriptionRead.model_validate(existing_rows[0]) if has_existing else SubscriptionRead(user_id=user_id)
        body = {
            "user_id": str(user_id),
            "stripe_customer_id": stripe_customer_id or existing.stripe_customer_id,
            "stripe_subscription_id": stripe_subscription_id or existing.stripe_subscription_id,
            "plan": plan.value,
            "status": status,
            "current_period_end": current_period_end.isoformat() if current_period_end else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if has_existing:
            rows = self._request("PATCH", "subscriptions", {"user_id": f"eq.{user_id}"}, body=body)
        else:
            rows = self._request("POST", "subscriptions", body=body)

        effective_plan = plan if status in {"active", "trialing"} else Plan.FREE
        self._request("PATCH", "profiles", {"id": f"eq.{user_id}"}, body={"plan": effective_plan.value, "updated_at": datetime.now(timezone.utc).isoformat()})
        return SubscriptionRead.model_validate(rows[0]) if rows else self.get_subscription(user_id)

    def find_subscription_by_customer(self, stripe_customer_id: str) -> SubscriptionRead | None:
        rows = self._request("GET", "subscriptions", {"select": "*", "stripe_customer_id": f"eq.{stripe_customer_id}", "limit": "1"})
        return SubscriptionRead.model_validate(rows[0]) if rows else None

    def find_subscription_by_stripe_subscription(self, stripe_subscription_id: str) -> SubscriptionRead | None:
        rows = self._request("GET", "subscriptions", {"select": "*", "stripe_subscription_id": f"eq.{stripe_subscription_id}", "limit": "1"})
        return SubscriptionRead.model_validate(rows[0]) if rows else None


def get_store(user: AuthenticatedUser | None = None) -> UserScopedStore | SupabaseRestStore:
    if user and user.is_guest:
        return store

    service_role_key = settings.secret_value("supabase_service_role_key")
    if settings.supabase_url and service_role_key:
        return SupabaseRestStore(settings.supabase_url, service_role_key)
    return store


def _destination_label(destination: str | None) -> str | None:
    if not destination:
        return None
    if destination.startswith("http"):
        return destination[:24] + "..." if len(destination) > 27 else destination
    if "@" in destination:
        name, domain = destination.split("@", 1)
        return f"{name[:2]}***@{domain}"
    return destination[-4:].rjust(len(destination), "*")


def _redacted_config(config: dict) -> dict:
    redacted = {}
    for key, value in config.items():
        if any(token in key.lower() for token in ("token", "secret", "webhook", "url")):
            redacted[key] = "***"
        else:
            redacted[key] = value
    return redacted


def _trade_result(payload: JournalEntryCreate) -> tuple[float | None, float | None]:
    if payload.exit_price is None:
        return None, None

    gross = (
        (payload.exit_price - payload.entry_price) * payload.quantity
        if payload.direction == "long"
        else (payload.entry_price - payload.exit_price) * payload.quantity
    )
    pnl = gross - payload.fees
    basis = payload.entry_price * payload.quantity
    return_pct = pnl / basis if basis else None
    return round(pnl, 6), round(return_pct, 6) if return_pct is not None else None
