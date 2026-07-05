from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from threading import Lock
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from src.agent.equity_research.entitlements import apply_research_entitlements, research_deep_report_limit, research_report_limit
from src.agent.equity_research.snapshot import build_data_snapshot
from src.models.equity_research import (
    DISCLAIMER,
    AgentStatus,
    EquityResearchEvent,
    EquityResearchReport,
    EquityResearchRun,
    EquityResearchRunCreate,
    EquityResearchRunDetail,
    EquityResearchSnapshot,
    EvidenceReference,
    InvestmentDecision,
    ReportType,
    Recommendation,
    ResearchDepth,
    ResearchEventType,
    ResearchRunStatus,
    TradingBias,
)
from src.llm.gateway import llm_gateway
from src.saas.models import AuthenticatedUser


@dataclass(frozen=True)
class AgentDefinition:
    key: str
    name: str
    team: str
    report_file: str
    title: str


@dataclass(frozen=True)
class FinalDecision:
    recommendation: Recommendation
    investment_decision: InvestmentDecision | None
    trading_bias: TradingBias | None
    confidence: float
    main_upside: str
    main_risk: str
    summary: str


AGENT_SEQUENCE: list[AgentDefinition] = [
    AgentDefinition("market", "Market Analyst", "Analyst Agents", "market_report.md", "Market Structure Report"),
    AgentDefinition("social", "Social Media Analyst", "Analyst Agents", "sentiment_report.md", "Sentiment Limits Report"),
    AgentDefinition("news", "News Analyst", "Analyst Agents", "news_report.md", "News and Macro Context"),
    AgentDefinition("fundamentals", "Fundamentals Analyst", "Analyst Agents", "fundamentals_report.md", "Fundamentals Report"),
    AgentDefinition("bull", "Bull Researcher", "Research Agents", "bull_case.md", "Bull Case"),
    AgentDefinition("bear", "Bear Researcher", "Research Agents", "bear_case.md", "Bear Case"),
    AgentDefinition("evaluator", "Research Evaluator", "Research Agents", "research_evaluation.md", "Balanced Thesis"),
    AgentDefinition("trader", "Trader", "Trading Desk", "trader_plan.md", "Trade Plan"),
    AgentDefinition("risky", "Risky Analyst", "Risk Management Agents", "risk_opportunity.md", "Upside Risk Review"),
    AgentDefinition("neutral", "Neutral Analyst", "Risk Management Agents", "risk_review.md", "Neutral Risk Review"),
    AgentDefinition("safe", "Safe Analyst", "Risk Management Agents", "safe_risk_controls.md", "Conservative Risk Controls"),
    AgentDefinition("pm", "Portfolio Manager", "Final Verdict", "final_trade_decision.md", "Final Trade Decision"),
]


DEPTH_QUALITY_STANDARDS = {
    ResearchDepth.SHALLOW: "shallow: concise snapshot, 500-900 words, plain English, no overstated certainty.",
    ResearchDepth.MEDIUM: "medium: full investment memo, 1,200-2,000 words, with clear synthesis and nearby-decision tradeoffs.",
    ResearchDepth.DEEP: "deep: institutional-style report, 2,500-4,000+ words, resolving agent disagreements and portfolio-manager judgment.",
}

INVESTMENT_DECISION_DEFINITIONS = """Allowed investment decisions:
- strong_buy: high-conviction positive view. Use only when fundamentals, valuation, catalysts, trend, and risk/reward are strongly aligned.
- buy: positive investment view with attractive upside and manageable risk.
- hold: neutral view for an existing position; reasonable to keep but not compelling enough to add.
- watchlist: promising but not ready due to valuation, timing, uncertainty, missing catalyst confirmation, or mixed evidence.
- reduce: trim exposure because risk/reward is weakening.
- sell: exit an existing position because the thesis is broken or downside risk is high.
- avoid: not suitable for new investment due to weak fundamentals, poor risk/reward, excessive uncertainty, or unreliable data.

Confidence rules:
- strong_buy requires confidence >= 75% and no severe unresolved risk flags.
- buy usually requires confidence >= 60%.
- sell usually requires confidence >= 65% and clear downside evidence.
- shallow mode should avoid strong_buy or sell unless evidence is unusually clear.
- explain why the final decision is not a stronger or weaker adjacent decision."""

FINAL_REPORT_QUALITY_GATE = """Final report quality gate:
1. Include exactly one final decision.
2. Do not include unfinished option strings such as "Accumulate / Watchlist / Avoid" or "Bullish / Neutral / Bearish".
3. Explain why the decision was chosen and what would change it.
4. Include market/trend context, catalysts, risks, portfolio fit, and confidence.
5. Translate internal scoring into plain English; do not expose raw internal agent scores as the decision basis.
6. Do not make unsupported claims."""

MAX_REPORT_LINE_CHARS = 1400
MAX_TABLE_CELL_CHARS = 220
MAX_TABLE_COLUMNS = 6
MAX_TABLE_ROWS = 120


class EquityResearchStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self.runs: dict[UUID, EquityResearchRun] = {}
        self.snapshots: dict[UUID, EquityResearchSnapshot] = {}
        self.reports: dict[UUID, list[EquityResearchReport]] = {}
        self.events: dict[UUID, list[EquityResearchEvent]] = {}
        self.share_index: dict[str, UUID] = {}
        self._versions: dict[UUID, int] = {}

    def create_run(self, run: EquityResearchRun) -> EquityResearchRun:
        with self._lock:
            self.runs[run.run_id] = run
            self.reports[run.run_id] = []
            self.events[run.run_id] = []
            self._versions[run.run_id] = 0
        return run

    def update_run(self, run_id: UUID, **fields) -> EquityResearchRun | None:
        with self._lock:
            run = self.runs.get(run_id)
            if not run:
                return None
            updated = run.model_copy(update={**fields, "updated_at": datetime.now(timezone.utc)})
            self.runs[run_id] = updated
            return updated

    def add_snapshot(self, snapshot: EquityResearchSnapshot) -> None:
        with self._lock:
            self.snapshots[snapshot.run_id] = snapshot
            self._versions[snapshot.run_id] = self._versions.get(snapshot.run_id, 0) + 1

    def add_report(self, report: EquityResearchReport) -> None:
        with self._lock:
            existing = [item for item in self.reports.get(report.run_id, []) if item.agent_key != report.agent_key]
            existing.append(report)
            self.reports[report.run_id] = existing
            self._versions[report.run_id] = self._versions.get(report.run_id, 0) + 1

    def add_event(self, event: EquityResearchEvent) -> None:
        with self._lock:
            self.events.setdefault(event.run_id, []).append(event)
            self._versions[event.run_id] = self._versions.get(event.run_id, 0) + 1

    def detail(self, run_id: UUID) -> EquityResearchRunDetail | None:
        with self._lock:
            run = self.runs.get(run_id)
            if not run:
                return None
            return EquityResearchRunDetail(
                run=run,
                snapshot=self.snapshots.get(run_id),
                reports=sorted(self.reports.get(run_id, []), key=lambda item: item.completed_at or datetime.max.replace(tzinfo=timezone.utc)),
                latest_events=self.events.get(run_id, [])[-30:],
            )

    def list_reports(self, run_id: UUID) -> list[EquityResearchReport] | None:
        with self._lock:
            if run_id not in self.runs:
                return None
            return list(self.reports.get(run_id, []))

    def list_events(self, run_id: UUID, after: int = 0) -> tuple[int, list[EquityResearchEvent]] | None:
        with self._lock:
            if run_id not in self.runs:
                return None
            events = self.events.get(run_id, [])
            return len(events), events[after:]

    def delete_run(self, run_id: UUID) -> bool:
        with self._lock:
            if run_id not in self.runs:
                return False
            run = self.runs.pop(run_id)
            if run.share_slug:
                self.share_index.pop(run.share_slug, None)
            self.snapshots.pop(run_id, None)
            self.reports.pop(run_id, None)
            self.events.pop(run_id, None)
            self._versions.pop(run_id, None)
            return True

    def share(self, run_id: UUID, shared: bool) -> EquityResearchRun | None:
        with self._lock:
            run = self.runs.get(run_id)
            if not run:
                return None
            share_slug = run.share_slug
            if shared and not share_slug:
                share_slug = f"{run.ticker.lower()}-{str(run.run_id)[:8]}"
                self.share_index[share_slug] = run_id
            if not shared and share_slug:
                self.share_index.pop(share_slug, None)
                share_slug = None
            updated = run.model_copy(update={"share_slug": share_slug, "updated_at": datetime.now(timezone.utc)})
            self.runs[run_id] = updated
            return updated

    def get_shared(self, slug: str) -> EquityResearchRunDetail | None:
        run_id = self.share_index.get(slug)
        return self.detail(run_id) if run_id else None

    def count_monthly_runs(
        self,
        *,
        user_id: UUID | None,
        guest_owner_id: str | None,
        month_start: datetime,
        research_depth: ResearchDepth | None = None,
    ) -> int:
        with self._lock:
            total = 0
            for run in self.runs.values():
                if run.created_at < month_start:
                    continue
                if research_depth is not None and run.research_depth != research_depth:
                    continue
                if user_id is not None and run.user_id == user_id:
                    total += 1
                    continue
                if user_id is None and guest_owner_id and run.guest_owner_id == guest_owner_id:
                    total += 1
            return total


_STORE = EquityResearchStore()


def get_research_store() -> EquityResearchStore:
    return _STORE


def _current_month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc)


def _enforce_research_limits(
    payload: EquityResearchRunCreate,
    user: AuthenticatedUser,
    *,
    guest_owner_id: str | None,
) -> None:
    store = get_research_store()
    month_start = _current_month_start()
    owner_id = user.id if not user.is_guest else None
    monthly_limit = research_report_limit(user)
    if monthly_limit is not None:
        used = store.count_monthly_runs(user_id=owner_id, guest_owner_id=guest_owner_id, month_start=month_start)
        if used >= monthly_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "research_limit_reached",
                    "message": "Monthly research report limit reached for your plan.",
                    "limit": monthly_limit,
                    "used": used,
                    "research_depth": payload.research_depth.value,
                },
            )

    if payload.research_depth == ResearchDepth.DEEP:
        deep_limit = research_deep_report_limit(user)
        if deep_limit is not None:
            used_deep = store.count_monthly_runs(
                user_id=owner_id,
                guest_owner_id=guest_owner_id,
                month_start=month_start,
                research_depth=ResearchDepth.DEEP,
            )
            if used_deep >= deep_limit:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "deep_research_limit_reached",
                        "message": "Monthly deep research report limit reached for your plan.",
                        "limit": deep_limit,
                        "used": used_deep,
                        "research_depth": payload.research_depth.value,
                    },
                )


async def create_research_run(
    payload: EquityResearchRunCreate,
    user: AuthenticatedUser,
    *,
    guest_owner_id: str | None = None,
) -> EquityResearchRun:
    effective = apply_research_entitlements(payload, user)
    _enforce_research_limits(effective, user, guest_owner_id=guest_owner_id)
    run = EquityResearchRun(
        run_id=uuid4(),
        user_id=user.id if not user.is_guest else None,
        guest_owner_id=guest_owner_id if user.is_guest else None,
        ticker=effective.ticker,
        analysis_date=effective.analysis_date or date.today(),
        report_type=effective.report_type,
        research_depth=effective.research_depth,
        selected_analysts=effective.selected_analysts,
        quick_model=effective.quick_model,
        deep_model=effective.deep_model,
        source_surface=effective.source_surface,
    )
    get_research_store().create_run(run)
    get_research_store().add_event(
        EquityResearchEvent(
            run_id=run.run_id,
            event_type=ResearchEventType.STATUS,
            label="Run queued",
            content=f"Created Quanfora 2.1 {run.report_type.value} research run for {run.ticker}.",
        )
    )
    asyncio.create_task(execute_research_run(run.run_id))
    return run


async def execute_research_run(run_id: UUID) -> None:
    store = get_research_store()
    run = store.update_run(run_id, status=ResearchRunStatus.RUNNING)
    if not run:
        return
    try:
        store.add_event(EquityResearchEvent(run_id=run_id, event_type=ResearchEventType.TOOL, label="Snapshot", content="Resolving ticker identity and market data.", tool_name="build_data_snapshot", tool_args={"ticker": run.ticker}))
        snapshot = await asyncio.to_thread(build_data_snapshot, run_id, run.ticker, run.analysis_date)
        store.add_snapshot(snapshot)
        store.update_run(
            run_id,
            company_name=snapshot.company_name,
            exchange=snapshot.exchange,
            data_snapshot_id=snapshot.snapshot_id,
        )
        store.add_event(EquityResearchEvent(run_id=run_id, event_type=ResearchEventType.STATUS, label="Snapshot ready", content="Data snapshot captured. Agents will reason from the same evidence base."))

        outputs: dict[str, EquityResearchReport] = {}
        for agent in AGENT_SEQUENCE:
            if agent.key in {"market", "social", "news", "fundamentals"} and agent.key not in run.selected_analysts:
                report = _skipped_report(run_id, agent)
                outputs[agent.key] = report
                store.add_report(report)
                store.add_event(EquityResearchEvent(run_id=run_id, agent_key=agent.key, agent_name=agent.name, event_type=ResearchEventType.STATUS, label="Skipped", content=f"{agent.name} was not selected for this run."))
                continue

            started_at = datetime.now(timezone.utc)
            store.add_event(EquityResearchEvent(run_id=run_id, agent_key=agent.key, agent_name=agent.name, event_type=ResearchEventType.REASONING, label="Agent started", content=f"{agent.name} is reviewing the shared snapshot."))
            await asyncio.sleep(0.55)
            report = _build_report(run, snapshot, agent, outputs, started_at)
            outputs[agent.key] = report
            store.add_report(report)
            report_file = _report_file_for(run, agent)
            store.add_event(EquityResearchEvent(run_id=run_id, agent_key=agent.key, agent_name=agent.name, event_type=ResearchEventType.REPORT, label=report_file, content=f"{agent.name} completed {report_file}.", token_input=report.token_input, token_output=report.token_output))

        final = outputs["pm"]
        decision = _final_decision(run, snapshot, outputs)
        store.update_run(
            run_id,
            status=ResearchRunStatus.COMPLETED,
            recommendation=decision.recommendation,
            investment_decision=decision.investment_decision,
            trading_bias=decision.trading_bias,
            confidence=decision.confidence,
            completed_at=datetime.now(timezone.utc),
            main_upside=decision.main_upside,
            main_risk=decision.main_risk,
            final_summary=decision.summary,
        )
        final_label = _final_label(run.report_type, decision)
        store.add_event(EquityResearchEvent(run_id=run_id, agent_key="pm", agent_name="Portfolio Manager", event_type=ResearchEventType.FINAL, label="Final verdict", content=f"{final.agent_name} issued {final_label} with {decision.confidence:.0%} confidence."))
    except Exception as exc:
        store.update_run(run_id, status=ResearchRunStatus.FAILED, error_message=str(exc), completed_at=datetime.now(timezone.utc))
        store.add_event(EquityResearchEvent(run_id=run_id, event_type=ResearchEventType.ERROR, label="Run failed", content=str(exc)))


def _skipped_report(run_id: UUID, agent: AgentDefinition) -> EquityResearchReport:
    now = datetime.now(timezone.utc)
    return EquityResearchReport(
        run_id=run_id,
        agent_key=agent.key,
        agent_name=agent.name,
        team=agent.team,
        status=AgentStatus.SKIPPED,
        title=agent.title,
        markdown=f"# {agent.title}\n\nThis agent was skipped because it was not selected for this run.",
        summary_points=["Agent skipped by configuration."],
        confidence=0,
        started_at=now,
        completed_at=now,
    )


def _report_file_for(run: EquityResearchRun, agent: AgentDefinition) -> str:
    if agent.key != "pm":
        return agent.report_file
    return "final_trading_bias.md" if run.report_type == ReportType.TRADING else "final_investment_view.md"


def _title_for(run: EquityResearchRun, agent: AgentDefinition) -> str:
    if agent.key != "pm":
        return agent.title
    return "Final Trading Bias" if run.report_type == ReportType.TRADING else "Final Investment View"


def _title_label(value: str) -> str:
    return value.replace("_", " ").title()


def _final_label(report_type: ReportType, decision: FinalDecision | Recommendation | InvestmentDecision | TradingBias) -> str:
    if isinstance(decision, FinalDecision):
        if report_type == ReportType.TRADING and decision.trading_bias is not None:
            return _title_label(decision.trading_bias.value)
        if report_type == ReportType.INVESTMENT and decision.investment_decision is not None:
            return _title_label(decision.investment_decision.value)
        recommendation = decision.recommendation
    elif isinstance(decision, InvestmentDecision | TradingBias):
        return _title_label(decision.value)
    else:
        recommendation = decision

    if report_type == ReportType.TRADING:
        return {
            Recommendation.BUY: "Bullish",
            Recommendation.HOLD: "Neutral",
            Recommendation.SELL: "Bearish",
            Recommendation.INSUFFICIENT_DATA: "Insufficient Data",
        }[recommendation]
    return {
        Recommendation.BUY: "Buy",
        Recommendation.HOLD: "Watchlist",
        Recommendation.SELL: "Avoid",
        Recommendation.INSUFFICIENT_DATA: "Avoid",
    }[recommendation]


def _build_report(
    run: EquityResearchRun,
    snapshot: EquityResearchSnapshot,
    agent: AgentDefinition,
    previous: dict[str, EquityResearchReport],
    started_at: datetime,
) -> EquityResearchReport:
    builders = {
        "market": _market_report,
        "social": _sentiment_report,
        "news": _news_report,
        "fundamentals": _fundamentals_report,
        "bull": _bull_report,
        "bear": _bear_report,
        "evaluator": _evaluation_report,
        "trader": _trader_report,
        "risky": _risky_report,
        "neutral": _neutral_report,
        "safe": _safe_report,
        "pm": _pm_report,
    }
    markdown, points, risk_flags, confidence = builders[agent.key](run, snapshot, previous)
    markdown = _maybe_enhance_with_llm(run, snapshot, agent, markdown, previous)
    return EquityResearchReport(
        run_id=run.run_id,
        agent_key=agent.key,
        agent_name=agent.name,
        team=agent.team,
        status=AgentStatus.COMPLETED,
        title=_title_for(run, agent),
        markdown=markdown,
        summary_points=points,
        evidence=[EvidenceReference(label="Shared data snapshot", source="snapshot", detail=f"{snapshot.ticker} {snapshot.analysis_date}")],
        confidence=confidence,
        risk_flags=risk_flags,
        started_at=started_at,
        completed_at=datetime.now(timezone.utc),
        token_input=900 + len(markdown) // 6,
        token_output=max(120, len(markdown) // 4),
    )


def _fmt(value: float | None, suffix: str = "") -> str:
    if value is None:
        return "Unavailable"
    return f"{value:,.2f}{suffix}"


def _money(value: float | None) -> str:
    if value is None:
        return "Unavailable"
    abs_value = abs(value)
    if abs_value >= 1_000_000_000_000:
        return f"${value / 1_000_000_000_000:,.2f}T"
    if abs_value >= 1_000_000_000:
        return f"${value / 1_000_000_000:,.2f}B"
    if abs_value >= 1_000_000:
        return f"${value / 1_000_000:,.2f}M"
    return f"${value:,.2f}"


def _pct(value: float | None) -> str:
    if value is None:
        return "Unavailable"
    return f"{value * 100:,.2f}%" if abs(value) <= 1 else f"{value:,.2f}%"


def _metric_rows(rows: list[tuple[str, str, str, str]]) -> str:
    body = "\n".join(_table_row([a, b, c, d]) for a, b, c, d in rows)
    return "| Metric | Value | Signal | Why It Matters |\n| --- | ---: | --- | --- |\n" + body


def _table_cell(value: Any, limit: int = MAX_TABLE_CELL_CHARS) -> str:
    text = re.sub(r"\s+", " ", str(value or "n/a")).strip()
    text = text.replace("|", "/")
    if len(text) > limit:
        return f"{text[:limit - 3].rstrip()}..."
    return text or "n/a"


def _table_row(cells: list[Any]) -> str:
    safe_cells = [_table_cell(cell) for cell in cells[:MAX_TABLE_COLUMNS]]
    return "| " + " | ".join(safe_cells) + " |"


def _is_table_separator_cell(value: str) -> bool:
    return bool(re.fullmatch(r":?-{3,}:?", value.strip()))


def _sanitize_markdown_table_line(line: str) -> str:
    raw_cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    if raw_cells and all(_is_table_separator_cell(cell) for cell in raw_cells):
        return "| " + " | ".join("---" for _ in raw_cells[:MAX_TABLE_COLUMNS]) + " |"
    return _table_row(raw_cells)


def _sanitize_llm_report_markdown(markdown: str) -> str | None:
    table_rows = 0
    sanitized_lines: list[str] = []

    for line in markdown.splitlines():
        if line.lstrip().startswith("|") and line.rstrip().endswith("|"):
            table_rows += 1
            if table_rows > MAX_TABLE_ROWS:
                return None
            sanitized_lines.append(_sanitize_markdown_table_line(line))
            continue

        compact = re.sub(r"\s+", " ", line).strip()
        if len(compact) > MAX_REPORT_LINE_CHARS:
            return None
        sanitized_lines.append(line)

    sanitized = "\n".join(sanitized_lines).strip()
    return sanitized if len(sanitized) >= 500 else None


def _source_quality(snapshot: EquityResearchSnapshot) -> str:
    statuses = snapshot.provider_status or []
    rows = []
    for status in statuses:
        provider = status.get("provider", "unknown")
        state = status.get("status", "unknown")
        detail = status.get("detail") or ""
        detail_text = detail[:90] if detail else ("Available" if state == "ok" else "No detail")
        rows.append((provider, state, detail_text))
    if not rows:
        return "No provider status was captured."
    return "| Provider | Status | Detail |\n| --- | --- | --- |\n" + "\n".join(_table_row([p, s, d]) for p, s, d in rows)


def _evidence_items(snapshot: EquityResearchSnapshot) -> list[str]:
    items = []
    for item in snapshot.evidence_items[:8]:
        label = item.get("label", "Evidence")
        source = item.get("source", "source")
        detail = item.get("detail")
        url = item.get("url")
        text = f"{label} ({source})"
        if detail:
            text += f": {detail}"
        if url:
            text += f" [{url}]({url})"
        items.append(text)
    if not items:
        items = snapshot.data_sources or ["Shared data snapshot"]
    return items


def _snapshot_brief(snapshot: EquityResearchSnapshot) -> str:
    f = snapshot.fundamentals
    t = snapshot.technical_indicators
    return "\n".join([
        f"Ticker: {snapshot.ticker}",
        f"Company: {snapshot.company_name}",
        f"Analysis date: {snapshot.analysis_date}",
        f"Latest price: {_money(snapshot.latest_price)}; daily change: {_pct(snapshot.daily_change)}; market cap: {_money(snapshot.market_cap)}",
        f"Trend: {t.get('trend')}; RSI: {_fmt(t.get('rsi_14'))}; MACD: {_fmt(t.get('macd'))}; support/resistance: {_money(t.get('support_20d'))} / {_money(t.get('resistance_20d'))}",
        f"Valuation: trailing PE {_fmt(f.get('trailing_pe'))}; revenue growth {_pct(f.get('revenue_growth') or f.get('quarterly_revenue_growth_yoy') or f.get('revenue_growth_ttm_yoy'))}; profit margin {_pct(f.get('profit_margins') or f.get('net_margin_ttm'))}",
        f"Sentiment: {snapshot.sentiment_summary.get('signal')} ({snapshot.sentiment_summary.get('score')})",
        f"Sources: {', '.join(snapshot.data_sources)}",
    ])


def _maybe_enhance_with_llm(
    run: EquityResearchRun,
    snapshot: EquityResearchSnapshot,
    agent: AgentDefinition,
    markdown: str,
    previous: dict[str, EquityResearchReport],
) -> str:
    if run.user_id is None or run.research_depth.value == "shallow":
        return markdown
    try:
        routed = llm_gateway.get_chat_model(
            user_id=str(run.user_id),
            plan="free",
            task_type="equity_research_report",
            messages=[],
            preferred_mode=None,
        )
        previous_context = "\n\n".join(
            f"## {report.title}\n{report.markdown[:1800]}"
            for report in previous.values()
        )[:6000]
        objective = "shorter-horizon trading setup" if run.report_type == ReportType.TRADING else "longer-horizon investment thesis"
        section_policy = (
            "For the Portfolio Manager final report, use exactly these top-level sections: Market Snapshot; "
            "Technical Setup; Catalyst & Sentiment; Trade Plan; Risk / Invalidation; Bull vs Bear Scenario; "
            "Final Trading Bias; Confidence + What Would Change The View. The Final Trading Bias section must choose exactly one of bullish, neutral, or bearish."
            if agent.key == "pm" and run.report_type == ReportType.TRADING
            else "For the Portfolio Manager final report, use exactly these top-level sections: Company / Asset Overview; "
            "Long-Term Thesis; Fundamentals; Valuation Context; Growth Drivers; Key Risks; Portfolio Fit; "
            "Final Investment View; Confidence + Time Horizon. The Final Investment View section must choose exactly one allowed investment decision."
            if agent.key == "pm"
            else "Keep the report aligned to the run objective and do not imply brokerage execution."
        )
        mode_guidance = DEPTH_QUALITY_STANDARDS.get(run.research_depth, DEPTH_QUALITY_STANDARDS[ResearchDepth.SHALLOW])
        decision_guidance = INVESTMENT_DECISION_DEFINITIONS if run.report_type == ReportType.INVESTMENT else "Trading bias decisions are bullish, neutral, or bearish. Use exactly one."
        prompt = f"""You are writing one source-grounded Quanfora 2.1 equity research report.

Report file: {_report_file_for(run, agent)}
Agent: {agent.name}
Report objective: {run.report_type.value} ({objective})
Research depth: {run.research_depth.value}
Depth quality standard: {mode_guidance}

{decision_guidance}

{FINAL_REPORT_QUALITY_GATE}

Use only the evidence below. Do not invent news, analyst targets, product claims, prices, dates, or fundamentals.
If data is missing, say it is missing and explain how that limits confidence.
Write professionally for the report objective. {section_policy}
Include:
- Executive summary
- Key metrics and evidence
- Interpretation
- Risks and caveats
- What would change the view
- Source quality notes
- Disclaimer

Prefer quality over hype. Do not imply guaranteed returns or brokerage execution.
If you use markdown tables, keep every cell concise. Never put full paragraphs, long source text, URLs, or raw article excerpts inside table cells; use bullets below the table for details instead.

Shared snapshot:
{_snapshot_brief(snapshot)}

Provider status:
{_source_quality(snapshot)}

Existing deterministic draft:
{markdown}

Prior agent context:
{previous_context}
"""
        response = routed.chat_model.invoke([{"role": "user", "content": prompt}])
        content = response.content
        if isinstance(content, list):
            content = "\n".join(part.get("text", str(part)) if isinstance(part, dict) else str(part) for part in content)
        sanitized = _sanitize_llm_report_markdown(content) if isinstance(content, str) else None
        if sanitized and _passes_quality_gate(sanitized):
            llm_gateway.record_usage(
                user_id=str(run.user_id),
                task_type="equity_research_report",
                routed_model=routed,
                input_text=prompt,
                output_text=sanitized,
            )
            return sanitized
    except Exception:
        return markdown
    return markdown


def _passes_quality_gate(markdown: str) -> bool:
    banned = [
        "Accumulate / Watchlist / Avoid",
        "Bullish / Neutral / Bearish",
        "Strong Buy / Buy / Hold",
    ]
    if any(fragment in markdown for fragment in banned):
        return False
    if markdown.count("Final Investment View") > 2:
        return False
    if markdown.count("Final Trading Bias") > 2:
        return False
    return True


def _score(snapshot: EquityResearchSnapshot) -> int:
    score = 0
    tech = snapshot.technical_indicators
    fundamentals = snapshot.fundamentals
    if snapshot.daily_change is not None:
        score += 1 if snapshot.daily_change > 0 else -1 if snapshot.daily_change < -2 else 0
    if tech.get("trend") == "uptrend":
        score += 1
    rsi = tech.get("rsi_14")
    if isinstance(rsi, (int, float)):
        score += 1 if 45 <= rsi <= 68 else -1 if rsi > 78 else 0
    if fundamentals.get("revenue_growth") and fundamentals["revenue_growth"] > 0:
        score += 1
    if fundamentals.get("debt_to_equity") and fundamentals["debt_to_equity"] > 180:
        score -= 1
    if snapshot.sentiment_summary.get("signal") == "bullish":
        score += 1
    if snapshot.sentiment_summary.get("signal") == "bearish":
        score -= 1
    if snapshot.risk_metrics.get("max_drawdown_window") and snapshot.risk_metrics["max_drawdown_window"] > 0.25:
        score -= 1
    return score


def _market_report(run, snapshot, previous):
    tech = snapshot.technical_indicators
    latest = snapshot.latest_price
    ema_10 = tech.get("ema_10")
    sma_50 = tech.get("sma_50")
    macd = tech.get("macd")
    rsi = tech.get("rsi_14")
    lower = tech.get("bollinger_lower")
    upper = tech.get("bollinger_upper")
    atr = tech.get("atr_14")
    vwma = tech.get("vwma_20")
    support = tech.get("support_20d")
    resistance = tech.get("resistance_20d")
    trend_label = tech.get("trend", "Unavailable")
    sentiment = "Bullish" if trend_label == "uptrend" and (rsi or 0) < 70 else "Bearish" if latest and sma_50 and latest < sma_50 else "Neutral"
    points = [
        f"Latest price is {_money(latest)} with daily change {_pct(snapshot.daily_change)}.",
        f"Trend classification is {trend_label}; price is {'above' if latest and sma_50 and latest >= sma_50 else 'below' if latest and sma_50 else 'not comparable to'} the 50-day SMA.",
        f"Support/resistance from the 20-day window: {_money(support)} / {_money(resistance)}.",
    ]
    risk = []
    if latest and sma_50 and latest < sma_50:
        risk.append("Price is trading below the 50-day SMA, which weakens medium-term trend confirmation.")
    if rsi and rsi > 75:
        risk.append("RSI is elevated and may indicate momentum exhaustion.")
    if rsi and rsi < 35:
        risk.append("RSI is weak; sellers may still control near-term momentum.")
    if tech.get("annualized_volatility") and tech["annualized_volatility"] > 0.35:
        risk.append("High realized volatility in the snapshot window.")
    table = _metric_rows([
        ("Price", _money(latest), sentiment, "Anchor for support/resistance and trend confirmation."),
        ("10-day EMA", _money(ema_10), "Short-term trend", "Dynamic short-term momentum line."),
        ("50-day SMA", _money(sma_50), "Medium-term trend", "Common institutional trend filter."),
        ("MACD", _fmt(macd), "Momentum", "Negative values often show weakening momentum."),
        ("RSI (14)", _fmt(rsi), "Momentum breadth", "Below 30 is often oversold; above 70 is often extended."),
        ("VWMA (20)", _money(vwma), "Volume-weighted cost basis", "Shows where recent volume-weighted buyers are positioned."),
        ("Bollinger Range", f"{_money(lower)} - {_money(upper)}", "Volatility band", "Defines the current statistical trading envelope."),
        ("ATR (14)", _fmt(atr), "Volatility", "Measures average daily trading range."),
    ])
    markdown = (
        f"# Market Report\n\n"
        f"**Ticker:** {snapshot.ticker}  \n**Company:** {snapshot.company_name or 'Unavailable'}  \n**Analysis Date:** {snapshot.analysis_date}\n\n"
        f"## Technical Readout\n"
        f"{snapshot.ticker} is currently classified as **{trend_label}**. The latest price of **{_money(latest)}** is "
        f"{'below' if latest and sma_50 and latest < sma_50 else 'above' if latest and sma_50 else 'not directly comparable to'} the 50-day SMA at **{_money(sma_50)}**, "
        f"while the 10-day EMA at **{_money(ema_10)}** frames the short-term momentum path.\n\n"
        f"## Trend and Momentum Analysis\n"
        f"MACD is **{_fmt(macd)}** and RSI is **{_fmt(rsi)}**. This combination suggests "
        f"{'bearish or weakening momentum' if macd and macd < 0 else 'constructive or improving momentum' if macd and macd > 0 else 'limited momentum confirmation'} "
        f"with room for reassessment around the support zone at **{_money(support)}** and resistance near **{_money(resistance)}**.\n\n"
        f"## Volatility and Volume Insights\n"
        f"Bollinger bands span **{_money(lower)} to {_money(upper)}**. ATR is **{_fmt(atr)}**, and VWMA is **{_money(vwma)}**. "
        f"When price trades below VWMA, recent volume-weighted buyers may be underwater; when it trades above VWMA, overhead supply pressure is lower.\n\n"
        f"## Key Takeaways for Traders\n{_bullets(points)}\n\n"
        f"## Indicator Table\n{table}\n\n"
        f"## Risk Flags\n{_bullets(risk or ['No critical technical risk flag from this agent.'])}\n\n"
        f"## Evidence Used\n{_bullets(_evidence_items(snapshot))}\n\n"
        f"_{DISCLAIMER}_\n"
    )
    return markdown, points, risk, 0.72


def _sentiment_report(run, snapshot, previous):
    sentiment = snapshot.sentiment_summary
    news = snapshot.news_items[:8]
    points = [
        f"News sentiment signal: {sentiment.get('signal', 'limited')} with score {sentiment.get('score', 0)}.",
        sentiment.get("summary", "Sentiment data is limited."),
        "Social media sentiment remains unavailable unless a social provider is configured; this report uses provider news plus FinBERT-style title analysis where available.",
    ]
    risk = list(sentiment.get("limitations", []))
    headline_rows = "\n".join(
        _table_row([item.get("title", "Untitled"), item.get("publisher") or item.get("source") or "Unknown", item.get("sentiment") or "n/a"])
        for item in news
    ) or "| No recent headlines available | n/a | n/a |"
    markdown = (
        f"# Sentiment Report\n\n"
        f"**Ticker:** {snapshot.ticker}  \n**Company:** {snapshot.company_name or 'Unavailable'}  \n**Analysis Date:** {snapshot.analysis_date}\n\n"
        f"## Executive Summary\n"
        f"The current sentiment read is **{sentiment.get('signal', 'limited')}**. {sentiment.get('summary', '')} "
        f"This signal should be treated as a market narrative input, not as a standalone trading trigger.\n\n"
        f"## Public and News Sentiment\n{_bullets(points)}\n\n"
        f"## Source Headlines\n| Headline | Publisher/Source | Provider Sentiment |\n| --- | --- | --- |\n{headline_rows}\n\n"
        f"## Implications for Traders and Investors\n"
        f"- A bullish sentiment shift is more useful when confirmed by price strength and fundamentals.\n"
        f"- A bearish sentiment shift matters most when it aligns with legal, regulatory, margin, or guidance risks.\n"
        f"- Missing social data is explicitly treated as a limitation rather than filled with unsupported claims.\n\n"
        f"## Risk Flags\n{_bullets(risk or ['No critical sentiment risk flag from this agent.'])}\n\n"
        f"## Evidence Used\n{_bullets(_evidence_items(snapshot))}\n\n"
        f"_{DISCLAIMER}_\n"
    )
    return markdown, points, risk, 0.58 if risk else 0.68


def _news_report(run, snapshot, previous):
    points = [item.get("title", "Untitled news item") for item in snapshot.news_items[:6]]
    if not points:
        points = ["No recent news items were returned by the configured source."]
    risk = [] if snapshot.news_items else ["News context is limited for this run."]
    news_rows = "\n".join(
        _table_row([f"[{item.get('title', 'Untitled')}]({item.get('url')})" if item.get("url") else item.get("title", "Untitled"), item.get("publisher") or item.get("source") or "Unknown", item.get("published_at") or "n/a"])
        for item in snapshot.news_items[:10]
    ) or "| No current news available | n/a | n/a |"
    markdown = (
        f"# News Report\n\n"
        f"**Ticker:** {snapshot.ticker}  \n**Company:** {snapshot.company_name or 'Unavailable'}  \n**Analysis Date:** {snapshot.analysis_date}\n\n"
        f"## News and Macro Context\n"
        f"The news tape should be read as catalyst evidence. Quanfora prioritizes source, timestamp, and direct links so the user can verify whether the narrative is current.\n\n"
        f"## Key Headlines\n{_bullets(points)}\n\n"
        f"## News Evidence Table\n| Headline | Source | Published |\n| --- | --- | --- |\n{news_rows}\n\n"
        f"## Trader Interpretation\n"
        f"- Positive headlines matter most when they connect to revenue growth, margins, product demand, analyst revisions, or capital returns.\n"
        f"- Negative headlines matter most when they introduce regulatory, litigation, balance-sheet, guidance, or demand risk.\n"
        f"- If the news set is thin, the final verdict should carry lower confidence.\n\n"
        f"## Risk Flags\n{_bullets(risk or ['No critical news risk flag from this agent.'])}\n\n"
        f"## Evidence Used\n{_bullets(_evidence_items(snapshot))}\n\n"
        f"_{DISCLAIMER}_\n"
    )
    return markdown, points, risk, 0.62 if snapshot.news_items else 0.45


def _fundamentals_report(run, snapshot, previous):
    f = snapshot.fundamentals
    analyst = snapshot.analyst_context
    filings = snapshot.filing_context
    points = [
        f"Sector/industry: {f.get('sector') or 'Unavailable'} / {f.get('industry') or 'Unavailable'}.",
        f"Market cap: {_money(snapshot.market_cap)}; Trailing P/E: {_fmt(f.get('trailing_pe'))}; Forward P/E: {_fmt(f.get('forward_pe'))}.",
        f"Revenue growth: {_pct(f.get('revenue_growth') or f.get('quarterly_revenue_growth_yoy') or f.get('revenue_growth_ttm_yoy'))}; Profit margin: {_pct(f.get('profit_margins') or f.get('net_margin_ttm'))}.",
        f"Debt/equity: {_fmt(f.get('debt_to_equity'))}; free cash flow: {_money(f.get('free_cashflow'))}.",
    ]
    risk = []
    if f.get("debt_to_equity") and f["debt_to_equity"] > 180:
        risk.append("Debt-to-equity appears elevated.")
    if f.get("revenue_growth") is None:
        risk.append("Revenue growth was unavailable.")
    table = _metric_rows([
        ("Market Cap", _money(snapshot.market_cap), "Scale", "Large market caps can provide durability but require large catalysts to rerate."),
        ("Revenue TTM", _money(f.get("revenue_ttm")), "Growth base", "Shows the revenue base investors are paying for."),
        ("Revenue Growth", _pct(f.get("revenue_growth") or f.get("quarterly_revenue_growth_yoy") or f.get("revenue_growth_ttm_yoy")), "Growth", "Growth justifies or undermines valuation premium."),
        ("Profit Margin", _pct(f.get("profit_margins") or f.get("net_margin_ttm")), "Profitability", "High margins support earnings resilience."),
        ("EPS TTM", _fmt(f.get("eps_ttm")), "Earnings", "Per-share earnings after dilution."),
        ("P/E", _fmt(f.get("trailing_pe")), "Valuation", "Higher multiples require stronger future growth."),
        ("Free Cash Flow", _money(f.get("free_cashflow")), "Cash generation", "Supports buybacks, dividends, reinvestment, and balance-sheet flexibility."),
        ("Analyst Target", _money(analyst.get("analyst_target_price") or analyst.get("target_mean")), "Street context", "Useful context, not a guarantee."),
    ])
    filing_points = []
    for item in filings.get("recent_filings", [])[:4] if isinstance(filings, dict) else []:
        filing_points.append(f"{item.get('form')} filed {item.get('filing_date')} (accession {item.get('accession')}).")
    markdown = (
        f"# Fundamentals Report\n\n"
        f"**Ticker:** {snapshot.ticker}  \n**Company:** {snapshot.company_name or 'Unavailable'}  \n**Analysis Date:** {snapshot.analysis_date}\n\n"
        f"## Company Profile\n"
        f"{snapshot.company_name or snapshot.ticker} operates in **{f.get('sector') or 'Unavailable'} / {f.get('industry') or 'Unavailable'}**. "
        f"The current market capitalization is **{_money(snapshot.market_cap)}**.\n\n"
        f"## Financial Performance Analysis\n{_bullets(points)}\n\n"
        f"## Valuation and Quality Table\n{table}\n\n"
        f"## SEC Filing Context\n{_bullets(filing_points or ['SEC filing context was unavailable or not matched for this ticker.'])}\n\n"
        f"## Risk Flags\n{_bullets(risk or ['No critical fundamental risk flag from this agent.'])}\n\n"
        f"## Evidence Used\n{_bullets(_evidence_items(snapshot))}\n\n"
        f"_{DISCLAIMER}_\n"
    )
    return markdown, points, risk, 0.66


def _bull_report(run, snapshot, previous):
    score = _score(snapshot)
    f = snapshot.fundamentals
    points = [
        "Bull case depends on positive trend confirmation, improving fundamentals, constructive news, and manageable risk conditions.",
        f"Composite evidence score: {score}.",
        "Upside improves if price holds above near-term support while news/fundamental data remain constructive.",
    ]
    markdown = (
        f"# Bull Case\n\n"
        f"## Bull Researcher View\n"
        f"The constructive argument for **{snapshot.ticker}** is strongest when technical support, earnings quality, and narrative catalysts line up. "
        f"The evidence score is **{score}**, latest price is **{_money(snapshot.latest_price)}**, and revenue growth is "
        f"**{_pct(f.get('revenue_growth') or f.get('quarterly_revenue_growth_yoy') or f.get('revenue_growth_ttm_yoy'))}** where available.\n\n"
        f"## Strongest Bullish Arguments\n{_bullets(points)}\n\n"
        f"## Upside Catalysts to Watch\n"
        f"- Price reclaiming resistance at **{_money(snapshot.technical_indicators.get('resistance_20d'))}** with volume confirmation.\n"
        f"- Positive analyst revisions, improved margins, or stronger guidance.\n"
        f"- News flow confirming product demand, capital returns, or sector leadership.\n\n"
        f"## Evidence Used\n{_bullets(_evidence_items(snapshot))}\n\n"
        f"_{DISCLAIMER}_\n"
    )
    return markdown, points, [], 0.64


def _bear_report(run, snapshot, previous):
    risk = _collect_risks(previous)
    f = snapshot.fundamentals
    points = [
        "Bear case focuses on valuation, trend deterioration, drawdown, volatility, regulatory/news risk, and incomplete evidence.",
        f"Primary flagged risks: {', '.join(risk[:3]) if risk else 'No critical risk flags, but uncertainty remains.'}",
        "Downside case strengthens if support breaks, risk metrics deteriorate, or fundamentals weaken.",
    ]
    markdown = (
        f"# Bear Case\n\n"
        f"## Bear Researcher View\n"
        f"The bearish argument is not that the company must fail; it is that the market may be paying too much or that timing risk is unfavorable. "
        f"Current P/E is **{_fmt(f.get('trailing_pe'))}**, price support is near **{_money(snapshot.technical_indicators.get('support_20d'))}**, "
        f"and max drawdown in the window is **{_pct(snapshot.risk_metrics.get('max_drawdown_window'))}**.\n\n"
        f"## Strongest Bearish Arguments\n{_bullets(points)}\n\n"
        f"## Downside Triggers\n"
        f"- A close below support at **{_money(snapshot.technical_indicators.get('support_20d'))}** with expanding volume.\n"
        f"- Margin, earnings, or revenue growth deterioration.\n"
        f"- New legal/regulatory/news catalyst that challenges the core thesis.\n\n"
        f"## Risk Flags\n{_bullets(risk or ['No critical risk flags, but uncertainty remains.'])}\n\n"
        f"## Evidence Used\n{_bullets(_evidence_items(snapshot))}\n\n"
        f"_{DISCLAIMER}_\n"
    )
    return markdown, points, risk, 0.64


def _evaluation_report(run, snapshot, previous):
    score = _score(snapshot)
    points = [
        "Evidence is balanced across market structure, news/sentiment limits, fundamentals, and risk.",
        f"Composite score is {score}; this supports {'a constructive lean' if score > 1 else 'a defensive or neutral stance' if score < 0 else 'a neutral stance'}.",
        "Agreement is strongest when trend and fundamentals point in the same direction.",
    ]
    risk = _collect_risks(previous)
    markdown = (
        f"# Research Team Debate\n\n"
        f"## Research Evaluator\n"
        f"The bull and bear cases are evaluated against the same data snapshot to prevent selective evidence use. The current score is **{score}**. "
        f"That score supports **{'a constructive lean' if score > 1 else 'a defensive or neutral stance' if score < 0 else 'a neutral stance'}**, but the final verdict must account for risk flags and source gaps.\n\n"
        f"## Points of Agreement\n{_bullets(points)}\n\n"
        f"## Points of Disagreement\n"
        f"- Bulls prioritize upside catalysts, cash generation, source-backed fundamentals, and trend confirmation.\n"
        f"- Bears prioritize valuation risk, broken support, stale or missing data, and downside catalysts.\n"
        f"- The trader should size exposure based on confirmation rather than treating the thesis as guaranteed.\n\n"
        f"## Risk Flags\n{_bullets(risk or ['No major disagreement risk flags were collected.'])}\n\n"
        f"## Evidence Used\n{_bullets(_evidence_items(snapshot))}\n\n"
        f"_{DISCLAIMER}_\n"
    )
    return markdown, points, risk, 0.7


def _trader_report(run, snapshot, previous):
    decision = _final_decision(run, snapshot, previous)
    confidence = decision.confidence
    upside = decision.main_upside
    risk = decision.main_risk
    support = snapshot.technical_indicators.get("support_20d")
    resistance = snapshot.technical_indicators.get("resistance_20d")
    label = _final_label(run.report_type, decision)
    if run.report_type == ReportType.TRADING:
        points = [
            f"Trading bias: {label} with {confidence:.0%} confidence.",
            f"Entry consideration: use support near {_money(support)} and confirmation above {_money(resistance)} rather than chasing price.",
            f"Invalidation: downgrade if {risk.lower()} or price breaks key support with volume.",
            "Position sizing: use conservative sizing; this is not direct brokerage execution.",
        ]
        title = "Trader Setup Plan"
        framework_title = "Execution Framework"
    else:
        points = [
            f"Investment view support: {label} with {confidence:.0%} confidence.",
            f"Timing consideration: monitor support near {_money(support)} and confirmation above {_money(resistance)} before adding exposure.",
            f"Thesis risk: reassess if {risk.lower()} or price breaks key support with volume.",
            "Portfolio sizing should reflect risk tolerance, diversification, and time horizon.",
        ]
        title = "Investment Timing Review"
        framework_title = "Position Building Framework"
    markdown = (
        f"# {title}\n\n"
        f"## Proposed {'Trading Bias' if run.report_type == ReportType.TRADING else 'Investment Timing View'}\n{_bullets(points)}\n\n"
        f"## {framework_title}\n"
        f"- **Pilot tranche:** small initial exposure only if the user accepts research risk.\n"
        f"- **Value tranche:** consider adding near support at **{_money(support)}** if evidence remains intact.\n"
        f"- **Confirmation tranche:** consider adding only after price clears resistance at **{_money(resistance)}** or trend metrics improve.\n\n"
        f"## Risk Management\n"
        f"- Main risk: {risk}\n"
        f"- Main upside: {upside}\n"
        f"- No direct brokerage execution is implied.\n\n"
        f"_{DISCLAIMER}_\n"
    )
    return markdown, points, [risk], confidence


def _risky_report(run, snapshot, previous):
    decision = _final_decision(run, snapshot, previous)
    points = [
        f"Upside scenario favors momentum continuation, positive data surprise, and a {_final_label(run.report_type, decision)} stance holding above invalidation levels.",
        "High-risk opportunity is only attractive when volatility is compensated by evidence quality.",
        f"Main upside: {decision.main_upside}",
    ]
    markdown = _markdown("Risk Debate - Risky Analyst", run, snapshot, points, [decision.main_risk] if decision.confidence < 0.55 else [], ["Bull case, market report, sentiment report."])
    return markdown, points, [], 0.62


def _neutral_report(run, snapshot, previous):
    risk = _collect_risks(previous)
    points = [
        "Neutral view weighs upside catalysts against evidence gaps and drawdown risk.",
        "The preferred decision should remain conditional, not absolute.",
        "More confidence requires cleaner trend/fundamental alignment.",
    ]
    markdown = _markdown("Risk Debate - Neutral Analyst", run, snapshot, points, risk, ["All prior reports."])
    return markdown, points, risk, 0.68


def _safe_report(run, snapshot, previous):
    risk = _collect_risks(previous)
    points = [
        "Conservative control: avoid over-sizing and require invalidation conditions before acting.",
        "Delay or downgrade if data is missing, volatility spikes, or support fails.",
        "Risk controls take priority over a bullish narrative.",
    ]
    markdown = _markdown("Risk Debate - Safe Analyst", run, snapshot, points, risk, ["Risk metrics and conservative review."])
    return markdown, points, risk, 0.72


def _pm_report(run, snapshot, previous):
    decision = _final_decision(run, snapshot, previous)
    risk_flags = _collect_risks(previous) or [decision.main_risk]
    if run.report_type == ReportType.TRADING:
        markdown, points = _trading_final_markdown(snapshot, decision, risk_flags)
    else:
        markdown, points = _investment_final_markdown(snapshot, decision, risk_flags)
    return markdown, points, risk_flags, decision.confidence


def _trading_final_markdown(
    snapshot: EquityResearchSnapshot,
    decision: FinalDecision,
    risk_flags: list[str],
) -> tuple[str, list[str]]:
    tech = snapshot.technical_indicators
    support = tech.get("support_20d")
    resistance = tech.get("resistance_20d")
    sentiment = snapshot.sentiment_summary
    label = _final_label(ReportType.TRADING, decision)
    points = [
        f"Final Trading Bias: {label}",
        f"Confidence: {decision.confidence:.0%}",
        f"Main upside: {decision.main_upside}",
        f"Main invalidation risk: {decision.main_risk}",
    ]
    markdown = (
        f"# Final Trading Bias\n\n"
        f"**Ticker:** {snapshot.ticker}  \n"
        f"**Company:** {snapshot.company_name or 'Unavailable'}  \n"
        f"**Analysis Date:** {snapshot.analysis_date}  \n"
        f"**Final Trading Bias:** {label}  \n"
        f"**Confidence:** {decision.confidence:.0%}\n\n"
        f"## Market Snapshot\n"
        f"- Latest price: **{_money(snapshot.latest_price)}**; daily change: **{_pct(snapshot.daily_change)}**.\n"
        f"- Volume: **{_fmt(snapshot.volume)}**; market cap: **{_money(snapshot.market_cap)}**.\n"
        f"- Source quality: {_source_quality(snapshot)}\n\n"
        f"## Technical Setup\n"
        f"- Trend: **{tech.get('trend', 'Unavailable')}**.\n"
        f"- RSI (14): **{_fmt(tech.get('rsi_14'))}**; MACD: **{_fmt(tech.get('macd'))}**.\n"
        f"- Support / resistance: **{_money(support)} / {_money(resistance)}**.\n"
        f"- ATR (14): **{_fmt(tech.get('atr_14'))}**.\n\n"
        f"## Catalyst & Sentiment\n"
        f"- Sentiment signal: **{sentiment.get('signal', 'limited')}** with score **{sentiment.get('score', 0)}**.\n"
        f"- Recent catalysts: {_bullets([item.get('title', 'Untitled news item') for item in snapshot.news_items[:4]] or ['No recent catalyst headlines were returned.'])}\n\n"
        f"## Trade Plan\n"
        f"- **Bias:** {label}.\n"
        f"- **Entry area:** Prefer confirmation near support at **{_money(support)}** or a clean break above **{_money(resistance)}**.\n"
        f"- **Target context:** Upside depends on {decision.main_upside.lower()}.\n"
        f"- **Sizing:** Use conservative sizing; this is a research plan, not an execution order.\n\n"
        f"## Risk / Invalidation\n"
        f"- Primary invalidation: {decision.main_risk}\n"
        f"- Risk flags: {_bullets(risk_flags)}\n\n"
        f"## Bull vs Bear Scenario\n"
        f"- **Bull case:** {decision.main_upside}\n"
        f"- **Bear case:** {decision.main_risk}\n"
        f"- **Balanced read:** {decision.summary}\n\n"
        f"## Final Trading Bias\n"
        f"**{label}.** Treat this as a conditional trading bias that must be refreshed if price, volume, news, or risk metrics change.\n\n"
        f"## Confidence + What Would Change The View\n"
        f"- Confidence: **{decision.confidence:.0%}**.\n"
        f"- A break below support with expanding volume would weaken the view.\n"
        f"- A clean break above resistance with improving sentiment would strengthen the view.\n"
        f"- A material earnings, guidance, regulatory, or liquidity event would require a fresh run.\n\n"
        f"## Disclaimer\n{DISCLAIMER}\n"
    )
    return markdown, points


def _investment_final_markdown(
    snapshot: EquityResearchSnapshot,
    decision: FinalDecision,
    risk_flags: list[str],
) -> tuple[str, list[str]]:
    f = snapshot.fundamentals
    analyst = snapshot.analyst_context
    label = _final_label(ReportType.INVESTMENT, decision)
    time_horizon = "6-18 months" if decision.recommendation != Recommendation.INSUFFICIENT_DATA else "Unavailable until evidence improves"
    adjacent = _investment_adjacent_explanation(decision)
    points = [
        f"Final Investment View: {label}",
        f"Confidence: {decision.confidence:.0%}",
        f"Time horizon: {time_horizon}",
        f"Main risk: {decision.main_risk}",
    ]
    markdown = (
        f"# Final Investment View\n\n"
        f"**Ticker:** {snapshot.ticker}  \n"
        f"**Company:** {snapshot.company_name or 'Unavailable'}  \n"
        f"**Analysis Date:** {snapshot.analysis_date}  \n"
        f"**Final Investment View:** {label}  \n"
        f"**Confidence:** {decision.confidence:.0%}  \n"
        f"**Time Horizon:** {time_horizon}\n\n"
        f"## Company / Asset Overview\n"
        f"{snapshot.company_name or snapshot.ticker} operates in **{f.get('sector') or 'Unavailable'} / {f.get('industry') or 'Unavailable'}**. "
        f"Market capitalization is **{_money(snapshot.market_cap)}** and latest price is **{_money(snapshot.latest_price)}**.\n\n"
        f"## Long-Term Thesis\n"
        f"{decision.summary}\n\n"
        f"## Fundamentals\n"
        f"- Revenue growth: **{_pct(f.get('revenue_growth') or f.get('quarterly_revenue_growth_yoy') or f.get('revenue_growth_ttm_yoy'))}**.\n"
        f"- Profit margin: **{_pct(f.get('profit_margins') or f.get('net_margin_ttm'))}**.\n"
        f"- Free cash flow: **{_money(f.get('free_cashflow'))}**.\n"
        f"- Debt/equity: **{_fmt(f.get('debt_to_equity'))}**.\n\n"
        f"## Valuation Context\n"
        f"- Trailing P/E: **{_fmt(f.get('trailing_pe'))}**.\n"
        f"- Forward P/E: **{_fmt(f.get('forward_pe'))}**.\n"
        f"- Analyst target context: **{_money(analyst.get('analyst_target_price') or analyst.get('target_mean'))}**.\n"
        f"- Valuation should be compared against growth durability and margin quality, not read in isolation.\n\n"
        f"## Growth Drivers\n"
        f"- {decision.main_upside}\n"
        f"- Growth driver evidence improves with stronger revenue, margin, guidance, or source-backed catalyst data.\n\n"
        f"## Key Risks\n"
        f"{_bullets(risk_flags)}\n\n"
        f"## Portfolio Fit\n"
        f"- View this as an **{label}** candidate within a diversified portfolio, not a standalone mandate.\n"
        f"- Position sizing should consider volatility, drawdown tolerance, sector concentration, and existing exposure.\n"
        f"- Refresh the thesis before increasing exposure after major earnings, guidance, or macro changes.\n\n"
        f"## Final Investment View\n"
        f"**{label}.** This view reflects current evidence quality and can change if fundamentals, valuation, catalysts, or risk metrics shift.\n\n"
        f"## Why This Decision\n"
        f"{adjacent}\n\n"
        f"## Confidence + Time Horizon\n"
        f"- Confidence: **{decision.confidence:.0%}**.\n"
        f"- Time horizon: **{time_horizon}**.\n"
        f"- Revisit the view after earnings, major news, material valuation changes, or a technical breakdown.\n\n"
        f"## Disclaimer\n{DISCLAIMER}\n"
    )
    return markdown, points


def _markdown(title: str, run: EquityResearchRun, snapshot: EquityResearchSnapshot, points: list[str], risk: list[str], evidence: list[str]) -> str:
    limitations = []
    limitations.extend(snapshot.technical_indicators.get("limitations", []))
    limitations.extend(snapshot.sentiment_summary.get("limitations", []))
    limitations.extend(snapshot.source_quality.get("limitations", []))
    return (
        f"# {title}\n\n"
        f"**Ticker:** {snapshot.ticker}  \n"
        f"**Company:** {snapshot.company_name or 'Unavailable'}  \n"
        f"**Analysis Date:** {snapshot.analysis_date}\n\n"
        f"## Findings\n{_bullets(points)}\n\n"
        f"## Risk Flags\n{_bullets(risk or ['No critical risk flag from this agent.'])}\n\n"
        f"## Evidence Used\n{_bullets(evidence + _evidence_items(snapshot))}\n\n"
        f"## Source Quality\n{_source_quality(snapshot)}\n\n"
        f"## Limitations\n{_bullets(limitations or ['Analysis depends on available market data and should be refreshed before decisions.'])}\n\n"
        f"_{DISCLAIMER}_\n"
    )


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items if item)


def _collect_risks(reports: dict[str, EquityResearchReport]) -> list[str]:
    risks: list[str] = []
    for report in reports.values():
        for flag in report.risk_flags:
            if flag and flag not in risks:
                risks.append(flag)
    return risks


def _investment_adjacent_explanation(decision: FinalDecision) -> str:
    selected = decision.investment_decision
    if selected == InvestmentDecision.STRONG_BUY:
        return "Strong Buy is used because the evidence is unusually aligned; any severe unresolved risk flag would downgrade this to Buy or Watchlist."
    if selected == InvestmentDecision.BUY:
        return "Buy is stronger than Watchlist because upside evidence is actionable, but it is not Strong Buy because conviction is not extreme across every evidence category."
    if selected == InvestmentDecision.HOLD:
        return "Hold is for an existing position: the evidence does not require an exit, but it is not strong enough to add aggressively."
    if selected == InvestmentDecision.WATCHLIST:
        return "Watchlist is used instead of Buy because the asset is interesting, but timing, valuation, catalyst strength, or evidence quality is not yet strong enough."
    if selected == InvestmentDecision.REDUCE:
        return "Reduce is weaker than Hold because risk/reward has deteriorated, but it stops short of Sell because the thesis is not fully broken."
    if selected == InvestmentDecision.SELL:
        return "Sell is stronger than Reduce because downside evidence or thesis damage is clear enough to justify exiting an existing position."
    if selected == InvestmentDecision.AVOID:
        return "Avoid is used for a new-money decision because uncertainty, weak evidence, or poor risk/reward makes the setup unsuitable."
    return "The decision is constrained by incomplete evidence and should be refreshed when better data is available."


def _legacy_recommendation(decision: InvestmentDecision | None, trading_bias: TradingBias | None, missing_price: bool) -> Recommendation:
    if missing_price:
        return Recommendation.INSUFFICIENT_DATA
    if trading_bias == TradingBias.BULLISH:
        return Recommendation.BUY
    if trading_bias == TradingBias.BEARISH:
        return Recommendation.SELL
    if trading_bias == TradingBias.NEUTRAL:
        return Recommendation.HOLD
    if decision in {InvestmentDecision.STRONG_BUY, InvestmentDecision.BUY}:
        return Recommendation.BUY
    if decision in {InvestmentDecision.SELL, InvestmentDecision.AVOID}:
        return Recommendation.SELL
    return Recommendation.HOLD


def _investment_decision_for(score: int, confidence: float, risks: list[str], missing_fundamentals: bool, depth: ResearchDepth) -> InvestmentDecision:
    severe_risk = len(risks) >= 4 or missing_fundamentals
    if score >= 4 and confidence >= 0.75 and not severe_risk and depth != ResearchDepth.SHALLOW:
        return InvestmentDecision.STRONG_BUY
    if score >= 3 and confidence >= 0.60:
        return InvestmentDecision.BUY
    if score <= -4 and confidence >= 0.65 and depth != ResearchDepth.SHALLOW:
        return InvestmentDecision.SELL
    if score <= -3 or len(risks) >= 5:
        return InvestmentDecision.AVOID
    if score <= -2 or len(risks) >= 3:
        return InvestmentDecision.REDUCE
    if score >= 2 and not severe_risk:
        return InvestmentDecision.HOLD
    return InvestmentDecision.WATCHLIST


def _trading_bias_for(score: int, confidence: float, risks: list[str]) -> TradingBias:
    if score >= 2 and confidence >= 0.55 and len(risks) < 4:
        return TradingBias.BULLISH
    if score <= -2 or len(risks) >= 4:
        return TradingBias.BEARISH
    return TradingBias.NEUTRAL


def _final_decision(run: EquityResearchRun, snapshot: EquityResearchSnapshot, previous: dict[str, EquityResearchReport]) -> FinalDecision:
    risks = _collect_risks(previous)
    score = _score(snapshot)
    missing_penalty = 1 if not snapshot.latest_price or not snapshot.fundamentals else 0
    if not snapshot.latest_price:
        investment_decision = InvestmentDecision.AVOID if run.report_type == ReportType.INVESTMENT else None
        trading_bias = TradingBias.NEUTRAL if run.report_type == ReportType.TRADING else None
        return FinalDecision(
            recommendation=Recommendation.INSUFFICIENT_DATA,
            investment_decision=investment_decision,
            trading_bias=trading_bias,
            confidence=0.25,
            main_upside="Insufficient price evidence.",
            main_risk="Price data is unavailable.",
            summary="The run cannot support a directional verdict without reliable price data. Avoid new action until the data gap is resolved.",
        )

    confidence = max(0.35, min(0.86, 0.55 + abs(score) * 0.06 - missing_penalty * 0.12 - min(len(risks), 4) * 0.03))
    confidence = round(confidence, 2)
    missing_fundamentals = not bool(snapshot.fundamentals)
    investment_decision = None
    trading_bias = None
    if run.report_type == ReportType.TRADING:
        trading_bias = _trading_bias_for(score, confidence, risks)
    else:
        investment_decision = _investment_decision_for(score, confidence, risks, missing_fundamentals, run.research_depth)
    rec = _legacy_recommendation(investment_decision, trading_bias, missing_price=False)
    upside = "Constructive price/fundamental alignment could support upside continuation." if score > 0 else "Upside requires fresh confirmation from price action or fundamentals."
    risk = risks[0] if risks else "The decision is sensitive to new data and near-term volatility."
    label = _final_label(run.report_type, investment_decision or trading_bias or rec)
    summary = (
        f"Quanfora 2.1 assigns a {label} view because the shared evidence is "
        f"{'constructive' if score > 1 else 'negative' if score < -1 else 'mixed'}, with {len(risks)} risk flag(s). "
        "The portfolio manager treats the output as a research verdict, "
        "not a guaranteed trading signal."
    )
    return FinalDecision(rec, investment_decision, trading_bias, confidence, upside, risk, summary)
