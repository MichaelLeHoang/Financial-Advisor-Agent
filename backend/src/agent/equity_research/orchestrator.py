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
from src.llm.gateway import llm_gateway
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
    markdown = _maybe_enhance_with_llm(run, snapshot, agent, markdown, previous)
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
    body = "\n".join(f"| {a} | {b} | {c} | {d} |" for a, b, c, d in rows)
    return "| Metric | Value | Signal | Why It Matters |\n| --- | ---: | --- | --- |\n" + body


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
    return "| Provider | Status | Detail |\n| --- | --- | --- |\n" + "\n".join(f"| {p} | {s} | {d} |" for p, s, d in rows)


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
        prompt = f"""You are writing one source-grounded QuanAd 2.1 equity research report.

Report file: {agent.report_file}
Agent: {agent.name}
Research depth: {run.research_depth.value}

Use only the evidence below. Do not invent news, analyst targets, product claims, prices, dates, or fundamentals.
If data is missing, say it is missing and explain how that limits confidence.
Write professionally for investors/traders. Include:
- Executive summary
- Key metrics and evidence
- Interpretation
- Risks and caveats
- What would change the view
- Source quality notes
- Disclaimer

Prefer quality over hype. Do not imply guaranteed returns or brokerage execution.

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
        if isinstance(content, str) and len(content.strip()) > 500:
            llm_gateway.record_usage(
                user_id=str(run.user_id),
                task_type="equity_research_report",
                routed_model=routed,
                input_text=prompt,
                output_text=content,
            )
            return content
    except Exception:
        return markdown
    return markdown


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
        f"| {item.get('title', 'Untitled')} | {item.get('publisher') or item.get('source') or 'Unknown'} | {item.get('sentiment') or 'n/a'} |"
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
        f"| [{item.get('title', 'Untitled')}]({item.get('url')}) | {item.get('publisher') or item.get('source') or 'Unknown'} | {item.get('published_at') or 'n/a'} |"
        if item.get("url") else f"| {item.get('title', 'Untitled')} | {item.get('publisher') or item.get('source') or 'Unknown'} | {item.get('published_at') or 'n/a'} |"
        for item in snapshot.news_items[:10]
    ) or "| No current news available | n/a | n/a |"
    markdown = (
        f"# News Report\n\n"
        f"**Ticker:** {snapshot.ticker}  \n**Company:** {snapshot.company_name or 'Unavailable'}  \n**Analysis Date:** {snapshot.analysis_date}\n\n"
        f"## News and Macro Context\n"
        f"The news tape should be read as catalyst evidence. QuanAd prioritizes source, timestamp, and direct links so the user can verify whether the narrative is current.\n\n"
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
    rec, confidence, upside, risk, _ = _final_decision(snapshot, previous)
    support = snapshot.technical_indicators.get("support_20d")
    resistance = snapshot.technical_indicators.get("resistance_20d")
    points = [
        f"Proposed stance: {rec.value.upper()} with {confidence:.0%} confidence.",
        f"Entry consideration: use support near {_money(support)} and confirmation above {_money(resistance)} rather than chasing price.",
        f"Invalidation: downgrade if {risk.lower()} or price breaks key support with volume.",
        "Position sizing: use conservative sizing; this is not direct brokerage execution.",
    ]
    markdown = (
        f"# Trader Investment Plan\n\n"
        f"## Proposed Trade Stance\n{_bullets(points)}\n\n"
        f"## Execution Framework\n"
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
    rec, confidence, upside, risk, _ = _final_decision(snapshot, previous)
    points = [
        f"Upside scenario favors momentum continuation, positive data surprise, and a {rec.value.upper()} stance holding above invalidation levels.",
        "High-risk opportunity is only attractive when volatility is compensated by evidence quality.",
        f"Main upside: {upside}",
    ]
    markdown = _markdown("Risk Debate - Risky Analyst", run, snapshot, points, [risk] if confidence < 0.55 else [], ["Bull case, market report, sentiment report."])
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
    rec, confidence, upside, risk, summary = _final_decision(snapshot, previous)
    support = snapshot.technical_indicators.get("support_20d")
    resistance = snapshot.technical_indicators.get("resistance_20d")
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
        f"## Strategic Actions\n"
        f"- **Immediate posture:** Treat {rec.value.upper()} as a research stance, not an execution order.\n"
        f"- **Support zone:** Monitor **{_money(support)}** for evidence of stabilization or failure.\n"
        f"- **Confirmation zone:** Monitor **{_money(resistance)}** for upside confirmation.\n"
        f"- **Sizing note:** Use staged exposure and risk limits; avoid all-in decisions from a single report.\n\n"
        f"## Risk Flags\n{_bullets(risk_flags)}\n\n"
        f"## Evidence/Data Used\n{_bullets(_evidence_items(snapshot))}\n\n"
        f"## Source Quality\n{_source_quality(snapshot)}\n\n"
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
