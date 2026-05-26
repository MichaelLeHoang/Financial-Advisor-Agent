"""QuanAd 2.0 specialist agents for multi-agent consensus architecture."""

from src.agent.specialists.base import BaseSpecialist
from src.agent.specialists.quant_researcher import QuantResearcher
from src.agent.specialists.quant_analyst import QuantAnalyst
from src.agent.specialists.data_scientist import FinancialDataScientist
from src.agent.specialists.risk_analyst import RiskAnalyst
from src.agent.specialists.portfolio_analytics import PortfolioAnalytics

ALL_SPECIALISTS = [
    QuantResearcher,
    QuantAnalyst,
    FinancialDataScientist,
    RiskAnalyst,
    PortfolioAnalytics,
]

__all__ = [
    "BaseSpecialist",
    "QuantResearcher",
    "QuantAnalyst",
    "FinancialDataScientist",
    "RiskAnalyst",
    "PortfolioAnalytics",
    "ALL_SPECIALISTS",
]
