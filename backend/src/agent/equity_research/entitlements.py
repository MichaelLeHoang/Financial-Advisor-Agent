from __future__ import annotations

from fastapi import HTTPException, status

from src.models.equity_research import EquityResearchRunCreate, ReportType, ResearchDepth
from src.saas.entitlements import get_entitlement
from src.saas.models import AuthenticatedUser, Plan


GUEST_TICKER_ALLOWLIST = {
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "TSLA", "AVGO", "COST",
    "NFLX", "AMD", "ADBE", "PEP", "CSCO", "QCOM", "INTC", "AMGN", "TXN", "INTU",
    "AMAT", "BKNG", "ISRG", "HON", "VRTX", "SBUX", "PANW", "ADP", "MU", "LRCX",
    "ADI", "MDLZ", "REGN", "GILD", "KLAC", "MELI", "SNPS", "CDNS", "CRWD", "MAR",
    "ORLY", "CEG", "PYPL", "CSX", "ABNB", "NXPI", "ROP", "PCAR", "FTNT", "MRVL",
    "WDAY", "CPRT", "CHTR", "DASH", "ROST", "KDP", "MNST", "PAYX", "AEP", "FAST",
    "KHC", "ODFL", "EXC", "FANG", "CTAS", "EA", "DDOG", "BKR", "VRSK", "XEL",
    "TEAM", "GEHC", "CCEP", "ZS", "TTWO", "IDXX", "MCHP", "CSGP", "DXCM", "ANSS",
    "ON", "CDW", "BIIB", "GFS", "ILMN", "MDB", "WBD", "SIRI", "ARM", "LIN",
}

DEFAULT_ANALYSTS = ["market", "social", "news", "fundamentals"]
TRADING_REPORT_PLANS = {Plan.TRADER, Plan.QUANT, Plan.EXECUTION_ADDON}
RESEARCH_REPORTS_LIMIT_KEY = "equity_research_reports_per_month"
RESEARCH_DEEP_REPORTS_LIMIT_KEY = "equity_research_deep_reports_per_month"


def research_report_limit(user: AuthenticatedUser) -> int | None:
    return get_entitlement(user.plan).limits.get(RESEARCH_REPORTS_LIMIT_KEY)


def research_deep_report_limit(user: AuthenticatedUser) -> int | None:
    return get_entitlement(user.plan).limits.get(RESEARCH_DEEP_REPORTS_LIMIT_KEY)


def apply_research_entitlements(payload: EquityResearchRunCreate, user: AuthenticatedUser) -> EquityResearchRunCreate:
    """Normalize config to what the current user can run."""
    updates: dict = {}

    if user.is_guest:
        if payload.ticker not in GUEST_TICKER_ALLOWLIST:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "ticker_restricted",
                    "message": "Guest demos are limited to large-cap US equities. Sign up to research broader tickers.",
                    "allowed_examples": sorted(list(GUEST_TICKER_ALLOWLIST))[:12],
                },
            )
        updates.update(
            report_type=ReportType.INVESTMENT,
            research_depth=ResearchDepth.SHALLOW,
            selected_analysts=DEFAULT_ANALYSTS,
            quick_model="default-fast",
            deep_model="default-research",
        )
        return payload.model_copy(update=updates)

    if user.plan in {Plan.FREE, Plan.PRO} and payload.research_depth == ResearchDepth.DEEP:
        updates["research_depth"] = ResearchDepth.MEDIUM if user.plan == Plan.PRO else ResearchDepth.SHALLOW

    if payload.report_type == ReportType.TRADING and user.plan not in TRADING_REPORT_PLANS:
        updates["report_type"] = ReportType.INVESTMENT

    if user.plan == Plan.FREE:
        updates["quick_model"] = "default-fast"
        updates["deep_model"] = "default-research"
        if payload.research_depth != ResearchDepth.SHALLOW:
            updates["research_depth"] = ResearchDepth.SHALLOW

    return payload.model_copy(update=updates) if updates else payload
