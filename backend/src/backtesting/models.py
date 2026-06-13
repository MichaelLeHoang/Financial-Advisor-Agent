from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from src.saas.models import BacktestRunRead, BacktestTradeCreate


StrategyType = Literal["buy_and_hold", "moving_average_crossover", "rsi_mean_reversion"]

BACKTEST_DISCLAIMER = (
    "Backtests use historical data and simplified assumptions. Historical results do not guarantee future performance."
)


class BacktestRequest(BaseModel):
    strategy_id: UUID | None = None
    strategy_name: str = Field(default="Strategy test", min_length=1, max_length=120)
    strategy_type: StrategyType = "moving_average_crossover"
    symbols: list[str] = Field(default_factory=lambda: ["AAPL"], min_length=1, max_length=10)
    start_date: date
    end_date: date
    initial_capital: float = Field(default=10_000, gt=0, le=10_000_000)
    fees_bps: float = Field(default=5, ge=0, le=100)
    slippage_bps: float = Field(default=5, ge=0, le=100)
    position_size: float = Field(default=1.0, gt=0, le=1.0)
    parameters: dict = Field(default_factory=dict)
    save_strategy: bool = False

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

    @field_validator("end_date")
    @classmethod
    def validate_range(cls, value: date, info):
        start_date = info.data.get("start_date")
        if start_date and value <= start_date:
            raise ValueError("end_date must be after start_date")
        return value


class EquityPoint(BaseModel):
    date: date
    value: float


class PricePoint(BaseModel):
    date: datetime
    close: float


class BacktestMetrics(BaseModel):
    total_return: float
    annualized_return: float
    max_drawdown: float
    sharpe_ratio: float
    win_rate: float
    profit_factor: float | None
    number_of_trades: int
    fees_paid: float


class BacktestResult(BaseModel):
    run: BacktestRunRead
    metrics: BacktestMetrics
    equity_curve: list[EquityPoint]
    trades: list[BacktestTradeCreate]
    price_series: dict[str, list[PricePoint]] = Field(default_factory=dict)
    disclaimer: str = BACKTEST_DISCLAIMER


class StrategyOption(BaseModel):
    type: StrategyType
    name: str
    description: str
    default_parameters: dict


class Candle(BaseModel):
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None


class CandleResponse(BaseModel):
    candles: dict[str, list[Candle]]
    source: str = "yfinance_development"
