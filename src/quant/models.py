from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from src.backtesting.models import BacktestMetrics, StrategyType


QUANT_DISCLAIMER = "Quant outputs are research tools, not financial advice. Historical validation does not guarantee future results."


class StrategyConfig(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    strategy_type: StrategyType
    parameters: dict = Field(default_factory=dict)


class StrategyComparisonRequest(BaseModel):
    symbols: list[str] = Field(default_factory=lambda: ["AAPL", "MSFT"], min_length=1, max_length=10)
    start_date: date
    end_date: date
    initial_capital: float = Field(default=10_000, gt=0, le=10_000_000)
    fees_bps: float = Field(default=5, ge=0, le=100)
    slippage_bps: float = Field(default=5, ge=0, le=100)
    position_size: float = Field(default=1.0, gt=0, le=1.0)
    strategies: list[StrategyConfig] = Field(min_length=1, max_length=6)

    @field_validator("symbols")
    @classmethod
    def normalize_symbols(cls, value: list[str]) -> list[str]:
        symbols = []
        for symbol in value:
            normalized = symbol.strip().upper()
            if normalized and normalized not in symbols:
                symbols.append(normalized)
        if not symbols:
            raise ValueError("At least one symbol is required")
        return symbols


class StrategyComparisonRow(BaseModel):
    name: str
    strategy_type: str
    metrics: BacktestMetrics


class StrategyComparisonResponse(BaseModel):
    results: list[StrategyComparisonRow]
    best_strategy: str | None
    ranking_metric: str = "sharpe_ratio"
    disclaimer: str = QUANT_DISCLAIMER


class AdvancedValidationRequest(BaseModel):
    strategy_name: str = Field(default="Quant validation", min_length=1, max_length=120)
    strategy_type: StrategyType = "moving_average_crossover"
    symbols: list[str] = Field(default_factory=lambda: ["AAPL"], min_length=1, max_length=10)
    start_date: date
    end_date: date
    initial_capital: float = Field(default=10_000, gt=0, le=10_000_000)
    fees_bps: float = Field(default=5, ge=0, le=100)
    slippage_bps: float = Field(default=5, ge=0, le=100)
    position_size: float = Field(default=1.0, gt=0, le=1.0)
    parameters: dict = Field(default_factory=dict)
    walk_forward_windows: int = Field(default=4, ge=2, le=12)
    monte_carlo_paths: int = Field(default=250, ge=50, le=2000)
    bootstrap_samples: int = Field(default=500, ge=100, le=5000)


class AdvancedValidationResponse(BaseModel):
    base_metrics: BacktestMetrics
    walk_forward: list[dict]
    monte_carlo: dict
    bootstrap: dict
    saved_run_id: str | None = None
    disclaimer: str = QUANT_DISCLAIMER


class SignalRankingRequest(BaseModel):
    symbols: list[str] = Field(default_factory=lambda: ["AAPL", "MSFT", "NVDA"], min_length=1, max_length=25)
    start_date: date
    end_date: date


class SignalRank(BaseModel):
    symbol: str
    score: float
    momentum_20d: float
    momentum_60d: float
    volatility_20d: float
    trend_label: str


class SignalRankingResponse(BaseModel):
    rankings: list[SignalRank]
    disclaimer: str = QUANT_DISCLAIMER


ExportLanguage = Literal["json", "python", "pine"]


class StrategyExportRequest(BaseModel):
    strategy_name: str = Field(default="Exported strategy", min_length=1, max_length=120)
    strategy_type: StrategyType = "moving_average_crossover"
    symbols: list[str] = Field(default_factory=lambda: ["AAPL"])
    parameters: dict = Field(default_factory=dict)
    language: ExportLanguage = "json"


class StrategyExportResponse(BaseModel):
    language: ExportLanguage
    content: str
    saved_export_id: str | None = None
    routed_mode: str = "coding_export"
    disclaimer: str = QUANT_DISCLAIMER
