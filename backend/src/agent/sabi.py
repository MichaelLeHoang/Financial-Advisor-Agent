"""Minimal Sabi intent planning over Quanfora's existing capabilities."""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Callable


class SabiIntent(str, Enum):
    PLATFORM_HELP = "platform_help"
    MARKET_LOOKUP = "market_lookup"
    INVESTMENT_ANALYSIS = "investment_analysis"
    TRADING_ANALYSIS = "trading_analysis"
    PORTFOLIO_ANALYSIS = "portfolio_analysis"
    RISK_ANALYSIS = "risk_analysis"
    BACKTEST = "backtest"
    TRADE_PROPOSAL = "trade_proposal"
    GENERAL = "general"


class SabiCapability(str, Enum):
    QUICK = "quick"
    CONSENSUS = "consensus"
    RESEARCH = "research"
    PORTFOLIO = "portfolio"
    RISK = "risk"
    BACKTEST = "backtest"
    TRADE_PROPOSAL = "trade_proposal"


@dataclass(frozen=True)
class SabiPlan:
    intent: SabiIntent
    capability: SabiCapability
    use_market_data: bool = False
    use_platform_knowledge: bool = False
    use_portfolio: bool = False
    requested_depth: str = "auto"
    symbol: str | None = None
    report_type: str = "investment"

    @property
    def queue_kind(self) -> str:
        """Map Sabi's plan onto the two queues that already exist."""
        return "consensus" if self.capability == SabiCapability.CONSENSUS else "single"


@dataclass(frozen=True)
class SabiResult:
    response: str
    plan: SabiPlan

    def metadata(self) -> dict[str, object]:
        action_status = (
            "proposal_only"
            if self.plan.capability == SabiCapability.TRADE_PROPOSAL
            else "research_requested"
            if self.plan.capability == SabiCapability.RESEARCH
            else "analysis_only"
        )
        metadata: dict[str, object] = {
            "selected_mode": "sabi",
            "selected_capability": self.plan.capability.value,
            "action_status": action_status,
        }
        if self.plan.capability == SabiCapability.RESEARCH:
            metadata["research_request"] = {
                "ticker": self.plan.symbol,
                "report_type": self.plan.report_type,
                "research_depth": self.plan.requested_depth,
            }
        return metadata


_RESEARCH_PATTERNS = (
    r"^/(?:research|analyze)\b",
    r"\b(?:create|generate|prepare|write|build|run)\s+(?:a\s+)?(?:(?:full|complete|deep|comprehensive)\s+)?(?:(?:investment|trading|equity|stock)\s+)?(?:research\s+)?report\b",
    r"\b(?:full|complete|deep|comprehensive)\s+(?:investment\s+|trading\s+|equity\s+)?research\b",
)

_CONSENSUS_MARKERS = (
    "should i invest",
    "should i buy",
    "should i sell",
    "is it a good time",
    "investment analysis",
    "full analysis",
    "comprehensive analysis",
    "deep analysis",
    "consensus",
    "multi-agent",
    "quanad",
    "risk assessment",
    "portfolio review",
)

_TICKER_STOP_WORDS = {
    "AI",
    "BUY",
    "CREATE",
    "DEEP",
    "FULL",
    "GENERATE",
    "I",
    "REPORT",
    "RESEARCH",
    "SELL",
    "THE",
}


def _extract_symbol(message: str) -> str | None:
    explicit = re.search(r"\$([A-Za-z][A-Za-z0-9.-]{0,14})\b", message)
    if explicit:
        return explicit.group(1).upper()

    phrase = re.search(
        r"\b(?:for|on|about|analyze|research|buy|sell|invest in)\s+([A-Z][A-Z0-9.-]{0,14})\b",
        message,
        re.IGNORECASE,
    )
    if phrase and phrase.group(1).upper() not in _TICKER_STOP_WORDS:
        return phrase.group(1).upper()

    for candidate in re.findall(r"\b[A-Z][A-Z0-9.-]{1,14}\b", message):
        if candidate not in _TICKER_STOP_WORDS:
            return candidate
    return None


def _requested_depth(message: str, fallback: str) -> str:
    match = re.search(r"\b(shallow|medium|deep)\b", message, re.IGNORECASE)
    return match.group(1).lower() if match else fallback


def _report_type(message: str) -> str:
    return (
        "trading"
        if re.search(
            r"\b(trade|trading|swing|scalp|entry|stop|setup|breakout|target)\b",
            message,
            re.IGNORECASE,
        )
        else "investment"
    )


class SabiOrchestrator:
    """Select and invoke existing capabilities without owning their logic."""

    def plan(
        self,
        message: str,
        *,
        requested_depth: str = "auto",
        force_capability: SabiCapability | None = None,
    ) -> SabiPlan:
        lower = message.lower().strip()
        symbol = _extract_symbol(message)
        depth = _requested_depth(message, requested_depth)

        if force_capability == SabiCapability.RESEARCH or any(
            re.search(pattern, message, re.IGNORECASE)
            for pattern in _RESEARCH_PATTERNS
        ):
            return SabiPlan(
                intent=SabiIntent.INVESTMENT_ANALYSIS,
                capability=SabiCapability.RESEARCH,
                use_market_data=True,
                requested_depth=depth,
                symbol=symbol,
                report_type=_report_type(message),
            )

        if re.search(r"\b(?:buy|sell)\s+\d+(?:\.\d+)?\s+shares?\b", lower):
            return SabiPlan(
                intent=SabiIntent.TRADE_PROPOSAL,
                capability=SabiCapability.TRADE_PROPOSAL,
                use_market_data=True,
                use_portfolio=True,
                symbol=symbol,
            )

        if "backtest" in lower or "historical test" in lower:
            return SabiPlan(
                intent=SabiIntent.BACKTEST,
                capability=SabiCapability.BACKTEST,
                use_market_data=True,
                symbol=symbol,
            )

        if any(marker in lower for marker in _CONSENSUS_MARKERS):
            intent = (
                SabiIntent.PORTFOLIO_ANALYSIS
                if "portfolio" in lower
                else SabiIntent.RISK_ANALYSIS
                if "risk" in lower
                else SabiIntent.INVESTMENT_ANALYSIS
            )
            return SabiPlan(
                intent=intent,
                capability=SabiCapability.CONSENSUS,
                use_market_data=True,
                use_portfolio=intent == SabiIntent.PORTFOLIO_ANALYSIS,
                symbol=symbol,
            )

        if re.search(r"\b(my portfolio|my holdings|my allocation)\b", lower):
            return SabiPlan(
                intent=SabiIntent.PORTFOLIO_ANALYSIS,
                capability=SabiCapability.PORTFOLIO,
                use_market_data=True,
                use_portfolio=True,
                symbol=symbol,
            )

        if re.search(r"\b(risk|drawdown|volatility|value at risk|var)\b", lower):
            return SabiPlan(
                intent=SabiIntent.RISK_ANALYSIS,
                capability=SabiCapability.RISK,
                use_market_data=True,
                use_portfolio="my " in lower,
                symbol=symbol,
            )

        if re.search(r"\b(price|quote|trading at|market cap|ticker)\b", lower):
            return SabiPlan(
                intent=SabiIntent.MARKET_LOOKUP,
                capability=SabiCapability.QUICK,
                use_market_data=True,
                symbol=symbol,
            )

        if re.search(
            r"\b(how (?:does|do)|where (?:can|do)|what is|subscription|paper trading|research mode)\b",
            lower,
        ):
            return SabiPlan(
                intent=SabiIntent.PLATFORM_HELP,
                capability=SabiCapability.QUICK,
                use_platform_knowledge=True,
                symbol=symbol,
            )

        return SabiPlan(
            intent=SabiIntent.GENERAL,
            capability=force_capability or SabiCapability.QUICK,
            use_market_data=bool(symbol),
            symbol=symbol,
        )

    def run(
        self,
        *,
        plan: SabiPlan,
        quick: Callable[[], str],
        consensus: Callable[[], str],
    ) -> SabiResult:
        if plan.capability == SabiCapability.RESEARCH:
            subject = plan.symbol or "the requested company"
            return SabiResult(
                response=(
                    f"Sabi selected a full {plan.report_type} research run for {subject}. "
                    "The existing Equity Research Desk workflow will prepare the report."
                ),
                plan=plan,
            )
        if plan.capability == SabiCapability.CONSENSUS:
            return SabiResult(response=consensus(), plan=plan)
        return SabiResult(response=quick(), plan=plan)


def build_sabi_plan(message: str, requested_depth: str = "auto") -> SabiPlan:
    return SabiOrchestrator().plan(message, requested_depth=requested_depth)


def is_complex_analysis_request(message: str) -> bool:
    return build_sabi_plan(message).capability in {
        SabiCapability.CONSENSUS,
        SabiCapability.RESEARCH,
    }
