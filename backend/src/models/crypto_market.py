from __future__ import annotations

from pydantic import BaseModel, Field


class CryptoProviderStatus(BaseModel):
    provider: str
    status: str
    detail: str | None = None
    timestamp: str


class CryptoOverviewResponse(BaseModel):
    asset_type: str = "crypto"
    base_asset: str
    quote_currency: str
    provider_symbol: str
    name: str
    venue: str
    price: float
    change_24h: float | None = None
    high_24h: float | None = None
    low_24h: float | None = None
    volume_24h: float | None = None
    market_cap: float | None = None
    market_cap_rank: int | None = None
    circulating_supply: float | None = None
    total_supply: float | None = None
    max_supply: float | None = None
    ath: float | None = None
    ath_date: str | None = None
    ath_drawdown_pct: float | None = None
    updated_at: str
    data_sources: list[str] = []
    provider_status: list[CryptoProviderStatus] = []


class CryptoSeriesPoint(BaseModel):
    timestamp: str
    price: float
    volume: float | None = None
    market_cap: float | None = None
    sma_50: float | None = None
    sma_100: float | None = None
    sma_200: float | None = None


class CryptoSeriesResponse(BaseModel):
    base_asset: str
    quote_currency: str
    range: str
    visible_from: str
    points: list[CryptoSeriesPoint]
    updated_at: str
    data_sources: list[str] = []
    provider_status: list[CryptoProviderStatus] = []


class FearGreedPoint(BaseModel):
    timestamp: str
    value: int = Field(ge=0, le=100)
    classification: str


class FearGreedResponse(BaseModel):
    range: str
    current_value: int | None = None
    current_classification: str | None = None
    daily_change: int | None = None
    points: list[FearGreedPoint] = []
    updated_at: str
    data_sources: list[str] = []
    provider_status: list[CryptoProviderStatus] = []


class HalvingCycleResponse(BaseModel):
    previous_halving_date: str
    previous_halving_height: int
    latest_block_height: int
    next_halving_height: int
    next_halving_number: int
    progress_pct: float = Field(ge=0, le=100)
    blocks_completed: int
    blocks_remaining: int
    estimated_days_remaining: int
    estimated_next_halving_date: str
    average_block_minutes: float
    updated_at: str
    data_sources: list[str] = []
    provider_status: list[CryptoProviderStatus] = []


class BitcoinNetworkMetrics(BaseModel):
    hash_rate: float | None = None
    difficulty: float | None = None
    transactions_24h: int | None = None
    fees_btc_24h: float | None = None
    blocks_mined_24h: int | None = None


class BitcoinMempoolMetrics(BaseModel):
    block_height: int | None = None
    unconfirmed_transactions: int | None = None
    virtual_size_bytes: int | None = None
    total_fees_btc: float | None = None
    fastest_fee_sats_vb: float | None = None
    half_hour_fee_sats_vb: float | None = None
    hour_fee_sats_vb: float | None = None
    economy_fee_sats_vb: float | None = None
    minimum_fee_sats_vb: float | None = None


class CryptoDefiChain(BaseModel):
    name: str
    tvl_usd: float


class CryptoDefiMetrics(BaseModel):
    total_value_locked_usd: float | None = None
    dex_volume_24h_usd: float | None = None
    top_chains: list[CryptoDefiChain] = []


class CryptoMarketBreadthMetrics(BaseModel):
    bitcoin_dominance_pct: float | None = None
    total_market_cap_usd: float | None = None
    total_volume_24h_usd: float | None = None


class CryptoContextResponse(BaseModel):
    base_asset: str
    quote_currency: str
    fear_greed: FearGreedResponse | None = None
    halving: HalvingCycleResponse | None = None
    network: BitcoinNetworkMetrics | None = None
    mempool: BitcoinMempoolMetrics | None = None
    defi: CryptoDefiMetrics | None = None
    market: CryptoMarketBreadthMetrics | None = None
    updated_at: str
    data_sources: list[str] = []
    provider_status: list[CryptoProviderStatus] = []
