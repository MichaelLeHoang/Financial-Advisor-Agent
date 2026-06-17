from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import date, datetime, timezone
from threading import Lock
from uuid import UUID, uuid4

from src.agent.equity_research.entitlements import apply_research_entitlements
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
    Recommendation,
    ResearchEventType,
    ResearchRunStatus,
)
from src.saas.models import AuthenticatedUser


@dataclass(frozen=True)
class AgentDefinition:
    key: str
    name: str
    team: str
    report_file: str
    title: str


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


_STORE = EquityResearchStore()


def get_research_store() -> EquityResearchStore:
    return _STORE


async def create_research_run(payload: EquityResearchRunCreate, user: AuthenticatedUser) -> EquityResearchRun:
    effective = apply_research_entitlements(payload, user)
    run = EquityResearchRun(
        run_id=uuid4(),
        user_id=user.id if not user.is_guest else None,
        ticker=effective.ticker,
        analysis_date=effective.analysis_date or date.today(),
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
            content=f"Created QuanAd 2.1 research run for {run.ticker}.",
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
            await asyncio.sleep(0.18)
            report = _build_report(run, snapshot, agent, outputs, started_at)
            outputs[agent.key] = report
            store.add_report(report)
            store.add_event(EquityResearchEvent(run_id=run_id, agent_key=agent.key, agent_name=agent.name, event_type=ResearchEventType.REPORT, label=agent.report_file, content=f"{agent.name} completed {agent.report_file}.", token_input=report.token_input, token_output=report.token_output))

        final = outputs["pm"]
        recommendation, confidence, main_upside, main_risk, summary = _final_decision(snapshot, outputs)
        store.update_run(
            run_id,
            status=ResearchRunStatus.COMPLETED,
            recommendation=recommendation,
            confidence=confidence,
            completed_at=datetime.now(timezone.utc),
            main_upside=main_upside,
            main_risk=main_risk,
            final_summary=summary,
        )
        store.add_event(EquityResearchEvent(run_id=run_id, agent_key="pm", agent_name="Portfolio Manager", event_type=ResearchEventType.FINAL, label="Final verdict", content=f"{final.agent_name} issued {recommendation.value.upper()} with {confidence:.0%} confidence."))
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
    return EquityResearchReport(
        run_id=run.run_id,
        agent_key=agent.key,
        agent_name=agent.name,
        team=agent.team,
        status=AgentStatus.COMPLETED,
        title=agent.title,
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
    points = [
        f"Latest price: {_fmt(snapshot.latest_price)} with daily change {_fmt(snapshot.daily_change, '%')}.",
        f"Trend classification: {tech.get('trend', 'Unavailable')}.",
        f"RSI 14: {_fmt(tech.get('rsi_14'))}; 20-day support/resistance: {_fmt(tech.get('support_20d'))} / {_fmt(tech.get('resistance_20d'))}.",
    ]
    risk = []
    if tech.get("annualized_volatility") and tech["annualized_volatility"] > 0.35:
        risk.append("High realized volatility in the snapshot window.")
    markdown = _markdown("Market Structure Report", run, snapshot, points, risk, ["SMA/EMA, MACD, RSI, Bollinger bands, support/resistance from OHLCV."])
    return markdown, points, risk, 0.72


def _sentiment_report(run, snapshot, previous):
    sentiment = snapshot.sentiment_summary
    points = [
        f"News-title sentiment signal: {sentiment.get('signal', 'limited')}.",
        sentiment.get("summary", "Sentiment data is limited."),
        "Social media sentiment is unavailable unless a social data provider is configured.",
    ]
    risk = list(sentiment.get("limitations", []))
    markdown = _markdown("Sentiment and Social Limits Report", run, snapshot, points, risk, ["Available news metadata; no unsupported social-source claims."])
    return markdown, points, risk, 0.58 if risk else 0.68


def _news_report(run, snapshot, previous):
    points = [item.get("title", "Untitled news item") for item in snapshot.news_items[:4]]
    if not points:
        points = ["No recent news items were returned by the configured source."]
    risk = [] if snapshot.news_items else ["News context is limited for this run."]
    markdown = _markdown("News and Macro Context", run, snapshot, points, risk, ["Recent yfinance news metadata and available RAG context."])
    return markdown, points, risk, 0.62 if snapshot.news_items else 0.45


def _fundamentals_report(run, snapshot, previous):
    f = snapshot.fundamentals
    points = [
        f"Sector/industry: {f.get('sector') or 'Unavailable'} / {f.get('industry') or 'Unavailable'}.",
        f"Trailing P/E: {_fmt(f.get('trailing_pe'))}; Forward P/E: {_fmt(f.get('forward_pe'))}.",
        f"Revenue growth: {_fmt(f.get('revenue_growth'))}; Profit margin: {_fmt(f.get('profit_margins'))}.",
        f"Debt/equity: {_fmt(f.get('debt_to_equity'))}; free cash flow: {_fmt(f.get('free_cashflow'))}.",
    ]
    risk = []
    if f.get("debt_to_equity") and f["debt_to_equity"] > 180:
        risk.append("Debt-to-equity appears elevated.")
    if f.get("revenue_growth") is None:
        risk.append("Revenue growth was unavailable.")
    markdown = _markdown("Fundamentals Report", run, snapshot, points, risk, ["yfinance company info fields; missing fields are treated as limitations."])
    return markdown, points, risk, 0.66


def _bull_report(run, snapshot, previous):
    points = [
        "Bull case depends on positive trend confirmation, improving fundamentals, and benign risk conditions.",
        f"Composite evidence score: {_score(snapshot)}.",
        "Upside improves if price holds above near-term support while news/fundamental data remain constructive.",
    ]
    markdown = _markdown("Bull Case", run, snapshot, points, [], ["Analyst reports generated earlier in this run."])
    return markdown, points, [], 0.64


def _bear_report(run, snapshot, previous):
    risk = _collect_risks(previous)
    points = [
        "Bear case focuses on valuation, drawdown, volatility, and incomplete evidence.",
        f"Primary flagged risks: {', '.join(risk[:3]) if risk else 'No critical risk flags, but uncertainty remains.'}",
        "Downside case strengthens if support breaks, risk metrics deteriorate, or fundamentals weaken.",
    ]
    markdown = _markdown("Bear Case", run, snapshot, points, risk, ["Analyst risk flags and shared snapshot."])
    return markdown, points, risk, 0.64


def _evaluation_report(run, snapshot, previous):
    score = _score(snapshot)
    points = [
        "Evidence is balanced across market structure, news/sentiment limits, fundamentals, and risk.",
        f"Composite score is {score}; this supports {'a constructive lean' if score > 1 else 'a defensive or neutral stance' if score < 0 else 'a neutral stance'}.",
        "Agreement is strongest when trend and fundamentals point in the same direction.",
    ]
    risk = _collect_risks(previous)
    markdown = _markdown("Balanced Investment Thesis", run, snapshot, points, risk, ["Bull and bear arguments compared against the same snapshot."])
    return markdown, points, risk, 0.7


def _trader_report(run, snapshot, previous):
    rec, confidence, upside, risk, _ = _final_decision(snapshot, previous)
    points = [
        f"Proposed stance: {rec.value.upper()} with {confidence:.0%} confidence.",
        "Entry consideration: wait for confirmation near support/resistance rather than chasing price.",
        "Invalidation: downgrade if the main risk materializes or price breaks key support with volume.",
        "Position sizing: use conservative sizing; this is not direct brokerage execution.",
    ]
    markdown = _markdown("Trade Plan", run, snapshot, points, [risk], ["Final stance preview and shared risk metrics."])
    return markdown, points, [risk], confidence


def _risky_report(run, snapshot, previous):
    points = [
        "Upside scenario favors momentum continuation and positive data surprise.",
        "High-risk opportunity is only attractive when volatility is compensated by evidence quality.",
        f"Main upside: {_final_decision(snapshot, previous)[2]}",
    ]
    markdown = _markdown("Upside Risk Review", run, snapshot, points, [], ["Bull case, market report, sentiment report."])
    return markdown, points, [], 0.62


def _neutral_report(run, snapshot, previous):
    risk = _collect_risks(previous)
    points = [
        "Neutral view weighs upside catalysts against evidence gaps and drawdown risk.",
        "The preferred decision should remain conditional, not absolute.",
        "More confidence requires cleaner trend/fundamental alignment.",
    ]
    markdown = _markdown("Neutral Risk Review", run, snapshot, points, risk, ["All prior reports."])
    return markdown, points, risk, 0.68


def _safe_report(run, snapshot, previous):
    risk = _collect_risks(previous)
    points = [
        "Conservative control: avoid over-sizing and require invalidation conditions before acting.",
        "Delay or downgrade if data is missing, volatility spikes, or support fails.",
        "Risk controls take priority over a bullish narrative.",
    ]
    markdown = _markdown("Conservative Risk Controls", run, snapshot, points, risk, ["Risk metrics and conservative review."])
    return markdown, points, risk, 0.72


def _pm_report(run, snapshot, previous):
    rec, confidence, upside, risk, summary = _final_decision(snapshot, previous)
    points = [
        f"Final Recommendation: {rec.value.upper()}",
        f"Confidence: {confidence:.0%}",
        f"Main upside: {upside}",
        f"Main risk: {risk}",
        "This verdict can change if price, fundamentals, news, or risk metrics materially change.",
    ]
    risk_flags = _collect_risks(previous) or [risk]
    markdown = (
        f"# Final Trade Decision\n\n"
        f"**Ticker:** {snapshot.ticker}  \n"
        f"**Company:** {snapshot.company_name or 'Unavailable'}  \n"
        f"**Analysis Date:** {snapshot.analysis_date}  \n"
        f"**Final Recommendation:** {rec.value.upper()}  \n"
        f"**Confidence:** {confidence:.0%}\n\n"
        f"## Summary of Key Arguments\n{_bullets(points)}\n\n"
        f"## Rationale\n{summary}\n\n"
        f"## Risk Flags\n{_bullets(risk_flags)}\n\n"
        f"## Evidence/Data Used\n{_bullets(snapshot.data_sources or ['Shared data snapshot'])}\n\n"
        f"## What Would Change the Decision\n"
        f"- A break below support with expanding volume.\n"
        f"- A material earnings, margin, debt, or guidance change.\n"
        f"- New adverse news or stronger evidence that current risk flags are resolving.\n\n"
        f"## Disclaimer\n{DISCLAIMER}\n"
    )
    return markdown, points, risk_flags, confidence


def _markdown(title: str, run: EquityResearchRun, snapshot: EquityResearchSnapshot, points: list[str], risk: list[str], evidence: list[str]) -> str:
    limitations = []
    limitations.extend(snapshot.technical_indicators.get("limitations", []))
    limitations.extend(snapshot.sentiment_summary.get("limitations", []))
    return (
        f"# {title}\n\n"
        f"**Ticker:** {snapshot.ticker}  \n"
        f"**Company:** {snapshot.company_name or 'Unavailable'}  \n"
        f"**Analysis Date:** {snapshot.analysis_date}\n\n"
        f"## Findings\n{_bullets(points)}\n\n"
        f"## Risk Flags\n{_bullets(risk or ['No critical risk flag from this agent.'])}\n\n"
        f"## Evidence Used\n{_bullets(evidence)}\n\n"
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


def _final_decision(snapshot: EquityResearchSnapshot, previous: dict[str, EquityResearchReport]) -> tuple[Recommendation, float, str, str, str]:
    risks = _collect_risks(previous)
    score = _score(snapshot)
    missing_penalty = 1 if not snapshot.latest_price or not snapshot.fundamentals else 0
    if not snapshot.latest_price:
        return Recommendation.INSUFFICIENT_DATA, 0.25, "Insufficient price evidence.", "Price data is unavailable.", "The run cannot support a directional verdict without reliable price data."
    if score >= 3 and len(risks) < 3:
        rec = Recommendation.BUY
    elif score <= -2 or len(risks) >= 4:
        rec = Recommendation.SELL if score <= -3 else Recommendation.HOLD
    else:
        rec = Recommendation.HOLD
    confidence = max(0.35, min(0.86, 0.55 + abs(score) * 0.06 - missing_penalty * 0.12 - min(len(risks), 4) * 0.03))
    upside = "Constructive price/fundamental alignment could support upside continuation." if score > 0 else "Upside requires fresh confirmation from price action or fundamentals."
    risk = risks[0] if risks else "The decision is sensitive to new data and near-term volatility."
    summary = (
        f"QuanAd 2.1 assigns a {rec.value.upper()} stance because the shared evidence score is {score}, "
        f"with {len(risks)} risk flag(s). The portfolio manager treats the output as a research verdict, "
        "not a guaranteed trading signal."
    )
    return rec, round(confidence, 2), upside, risk, summary
