from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from threading import Lock
from time import monotonic
from typing import Any, Callable, TypeVar

from src.core.config import settings
from src.data.market_data_service import _clean_number, _get_json
from src.data.market_data_service import market_data_service
from src.models.crypto_market import (
    BitcoinMempoolMetrics,
    BitcoinNetworkMetrics,
    CryptoContextResponse,
    CryptoDefiChain,
    CryptoDefiMetrics,
    CryptoMarketBreadthMetrics,
    CryptoOverviewResponse,
    CryptoProviderStatus,
    CryptoSeriesPoint,
    CryptoSeriesResponse,
    FearGreedPoint,
    FearGreedResponse,
    HalvingCycleResponse,
)


COINGECKO_IDS = {
    "BTC": ("bitcoin", "Bitcoin"),
    "ETH": ("ethereum", "Ethereum"),
    "LTC": ("litecoin", "Litecoin"),
    "DOGE": ("dogecoin", "Dogecoin"),
    "ADA": ("cardano", "Cardano"),
}
SUPPORTED_QUOTES = {"CAD", "USD", "USDT"}
RANGE_DAYS = {"1Y": 365, "2Y": 730, "3Y": 1095, "4Y": 1460, "5Y": 1825}
YFINANCE_PERIODS = {"1Y": "2y", "2Y": "5y", "3Y": "5y", "4Y": "5y", "5Y": "10y"}
FEAR_GREED_DAYS = {"14D": 14, "30D": 30, "3M": 90, "6M": 180, "1Y": 365}
LAST_HALVING_HEIGHT = 840_000
NEXT_HALVING_HEIGHT = 1_050_000
LAST_HALVING_DATE = datetime(2024, 4, 20, tzinfo=UTC)

T = TypeVar("T")


@dataclass
class _CacheEntry:
    expires_at: float
    value: Any


class CryptoMarketService:
    def __init__(self) -> None:
        self._cache: dict[str, _CacheEntry] = {}
        self._cache_lock = Lock()

    def normalize_asset(self, base: str, quote: str = "CAD") -> tuple[str, str, str, str]:
        normalized_base = base.strip().upper().split("-")[0]
        normalized_quote = quote.strip().upper()
        if normalized_base not in COINGECKO_IDS:
            raise ValueError(f"Unsupported crypto asset: {normalized_base}")
        if normalized_quote not in SUPPORTED_QUOTES:
            raise ValueError(f"Unsupported quote currency: {normalized_quote}")
        coin_id, name = COINGECKO_IDS[normalized_base]
        return normalized_base, normalized_quote, coin_id, name

    def _cached(self, key: str, ttl_seconds: int, loader: Callable[[], T]) -> T:
        now = monotonic()
        with self._cache_lock:
            cached = self._cache.get(key)
            if cached and cached.expires_at > now:
                return cached.value
        value = loader()
        with self._cache_lock:
            self._cache[key] = _CacheEntry(now + ttl_seconds, value)
        return value

    @staticmethod
    def _status(provider: str, status: str, detail: str | None = None) -> CryptoProviderStatus:
        return CryptoProviderStatus(provider=provider, status=status, detail=detail, timestamp=datetime.now(UTC).isoformat())

    @staticmethod
    def _coingecko_headers() -> dict[str, str]:
        key = settings.secret_value("coingecko_api_key")
        return {"x-cg-demo-api-key": key} if key else {}

    @staticmethod
    def _provider_quote(quote: str) -> str:
        # CoinGecko does not expose USDT as a display currency. Its USD series is
        # the documented analytics proxy while venue charts retain the USDT pair.
        return "usd" if quote == "USDT" else quote.lower()

    def overview(self, base: str, quote: str = "CAD") -> CryptoOverviewResponse:
        normalized_base, normalized_quote, coin_id, name = self.normalize_asset(base, quote)

        def load() -> CryptoOverviewResponse:
            now = datetime.now(UTC).isoformat()
            statuses: list[CryptoProviderStatus] = []
            try:
                payload = _get_json(
                    "https://api.coingecko.com/api/v3/coins/markets",
                    {"vs_currency": self._provider_quote(normalized_quote), "ids": coin_id, "sparkline": "false", "price_change_percentage": "24h"},
                    self._coingecko_headers(),
                )
                row = payload[0] if isinstance(payload, list) and payload else {}
                if not isinstance(row, dict) or _clean_number(row.get("current_price")) is None:
                    raise ValueError("CoinGecko returned no current price")
                ath_change = _clean_number(row.get("ath_change_percentage"))
                return CryptoOverviewResponse(
                    base_asset=normalized_base,
                    quote_currency=normalized_quote,
                    provider_symbol=f"{normalized_base}-{normalized_quote}",
                    name=str(row.get("name") or name),
                    venue="Kraken" if normalized_quote == "CAD" else "Composite",
                    price=float(row["current_price"]),
                    change_24h=_clean_number(row.get("price_change_percentage_24h")),
                    high_24h=_clean_number(row.get("high_24h")),
                    low_24h=_clean_number(row.get("low_24h")),
                    volume_24h=_clean_number(row.get("total_volume")),
                    market_cap=_clean_number(row.get("market_cap")),
                    market_cap_rank=int(row["market_cap_rank"]) if row.get("market_cap_rank") else None,
                    circulating_supply=_clean_number(row.get("circulating_supply")),
                    total_supply=_clean_number(row.get("total_supply")),
                    max_supply=_clean_number(row.get("max_supply")),
                    ath=_clean_number(row.get("ath")),
                    ath_date=str(row.get("ath_date")) if row.get("ath_date") else None,
                    ath_drawdown_pct=abs(ath_change) if ath_change is not None else None,
                    updated_at=str(row.get("last_updated") or now),
                    data_sources=["coingecko"],
                    provider_status=[self._status("coingecko", "ok")],
                )
            except Exception as exc:
                statuses.append(self._status("coingecko", "error", str(exc)[:160]))

            provider_quote = "USD" if normalized_quote == "USDT" else normalized_quote
            try:
                snapshot = market_data_service.fetch_snapshot(
                    f"{normalized_base}-{provider_quote}",
                    "5d",
                    "1d",
                    include_news=False,
                    include_sec=False,
                    include_fundamentals=False,
                )
                if snapshot.latest_price is None:
                    raise RuntimeError("Yahoo Finance returned no current price")
                statuses.append(self._status("yfinance", "ok", "Fallback used after CoinGecko was unavailable."))
                fallback_volume = _clean_number(snapshot.volume)
                return CryptoOverviewResponse(
                    base_asset=normalized_base,
                    quote_currency=normalized_quote,
                    provider_symbol=f"{normalized_base}-{normalized_quote}",
                    name=snapshot.company_name or name,
                    venue="Yahoo Finance composite",
                    price=float(snapshot.latest_price),
                    change_24h=_clean_number(snapshot.daily_change),
                    high_24h=_clean_number(snapshot.day_high),
                    low_24h=_clean_number(snapshot.day_low),
                    volume_24h=fallback_volume * float(snapshot.latest_price) if fallback_volume is not None else None,
                    market_cap=_clean_number(snapshot.market_cap),
                    updated_at=snapshot.quote_timestamp or now,
                    data_sources=["yfinance"],
                    provider_status=statuses,
                )
            except Exception as exc:
                statuses.append(self._status("yfinance", "error", str(exc)[:160]))

            if normalized_base == "BTC":
                try:
                    prices = _get_json("https://mempool.space/api/v1/prices")
                    price = _clean_number(prices.get(provider_quote)) if isinstance(prices, dict) else None
                    if price is None:
                        raise RuntimeError(f"mempool.space returned no {provider_quote} price")
                    statuses.append(self._status("mempool.space", "ok", "Price-only fallback used."))
                    return CryptoOverviewResponse(
                        base_asset=normalized_base,
                        quote_currency=normalized_quote,
                        provider_symbol=f"{normalized_base}-{normalized_quote}",
                        name=name,
                        venue="mempool.space",
                        price=price,
                        updated_at=now,
                        data_sources=["mempool.space"],
                        provider_status=statuses,
                    )
                except Exception as exc:
                    statuses.append(self._status("mempool.space", "error", str(exc)[:160]))

            raise RuntimeError("Crypto overview is temporarily unavailable from all configured providers")

        return self._cached(f"overview:{normalized_base}:{normalized_quote}", 60, load)

    def series(self, base: str, quote: str = "CAD", range_key: str = "1Y") -> CryptoSeriesResponse:
        normalized_base, normalized_quote, coin_id, _ = self.normalize_asset(base, quote)
        normalized_range = range_key.strip().upper()
        if normalized_range not in RANGE_DAYS:
            raise ValueError(f"Unsupported range: {normalized_range}")

        def load() -> CryptoSeriesResponse:
            visible_days = RANGE_DAYS[normalized_range]
            requested_days = visible_days + 220
            statuses: list[CryptoProviderStatus] = []
            sources: list[str] = []
            try:
                payload = _get_json(
                    f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart",
                    {"vs_currency": self._provider_quote(normalized_quote), "days": requested_days, "interval": "daily"},
                    self._coingecko_headers(),
                )
                if not isinstance(payload, dict):
                    raise RuntimeError("CoinGecko returned an invalid history payload")
                prices = payload.get("prices") or []
                volumes = {int(item[0]): float(item[1]) for item in payload.get("total_volumes") or [] if len(item) >= 2}
                market_caps = {int(item[0]): float(item[1]) for item in payload.get("market_caps") or [] if len(item) >= 2}
                statuses.append(self._status("coingecko", "ok"))
                sources.append("coingecko")
            except Exception as exc:
                statuses.append(self._status("coingecko", "error", str(exc)[:160]))
                provider_quote = "USD" if normalized_quote == "USDT" else normalized_quote
                snapshot = market_data_service.fetch_snapshot(
                    f"{normalized_base}-{provider_quote}",
                    YFINANCE_PERIODS[normalized_range],
                    "1d",
                    include_news=False,
                    include_sec=False,
                    include_fundamentals=False,
                )
                frame = snapshot.history_frame
                if frame is None or frame.empty or "Close" not in frame:
                    raise RuntimeError("Long-term crypto price history is temporarily unavailable") from exc
                prices = []
                volumes = {}
                market_caps = {}
                for index, row in frame.iterrows():
                    timestamp = index.to_pydatetime() if hasattr(index, "to_pydatetime") else index
                    if not isinstance(timestamp, datetime):
                        continue
                    if timestamp.tzinfo is None:
                        timestamp = timestamp.replace(tzinfo=UTC)
                    timestamp_ms = int(timestamp.timestamp() * 1000)
                    close = _clean_number(row.get("Close"))
                    if close is None:
                        continue
                    prices.append([timestamp_ms, close])
                    volume = _clean_number(row.get("Volume"))
                    if volume is not None:
                        volumes[timestamp_ms] = volume
                sources.append("yfinance")
                statuses.append(self._status("yfinance", "ok", "Fallback used after CoinGecko history was unavailable."))
            closes: list[float] = []
            points: list[CryptoSeriesPoint] = []
            for item in prices:
                if not isinstance(item, list) or len(item) < 2:
                    continue
                timestamp_ms = int(item[0])
                price = float(item[1])
                closes.append(price)
                index = len(closes) - 1

                def average(window: int) -> float | None:
                    if len(closes) < window:
                        return None
                    values = closes[index - window + 1 : index + 1]
                    return sum(values) / window

                points.append(CryptoSeriesPoint(
                    timestamp=datetime.fromtimestamp(timestamp_ms / 1000, UTC).isoformat(),
                    price=price,
                    volume=volumes.get(timestamp_ms),
                    market_cap=market_caps.get(timestamp_ms),
                    sma_50=average(50),
                    sma_100=average(100),
                    sma_200=average(200),
                ))
            visible_from = datetime.now(UTC) - timedelta(days=visible_days)
            visible_points = [point for point in points if datetime.fromisoformat(point.timestamp) >= visible_from]
            if not visible_points:
                raise RuntimeError("CoinGecko returned no price history")
            return CryptoSeriesResponse(
                base_asset=normalized_base,
                quote_currency=normalized_quote,
                range=normalized_range,
                visible_from=visible_from.isoformat(),
                points=visible_points,
                updated_at=datetime.now(UTC).isoformat(),
                data_sources=sources,
                provider_status=statuses,
            )

        return self._cached(f"series:{normalized_base}:{normalized_quote}:{normalized_range}", 3600, load)

    @staticmethod
    def fear_greed_classification(value: int) -> str:
        if value <= 24:
            return "Extreme fear"
        if value <= 44:
            return "Fear"
        if value <= 55:
            return "Neutral"
        if value <= 74:
            return "Greed"
        return "Extreme greed"

    def fear_greed(self, range_key: str = "30D") -> FearGreedResponse:
        normalized_range = range_key.strip().upper()
        if normalized_range not in FEAR_GREED_DAYS:
            raise ValueError(f"Unsupported sentiment range: {normalized_range}")

        def load() -> FearGreedResponse:
            payload = _get_json("https://api.alternative.me/fng/", {"limit": FEAR_GREED_DAYS[normalized_range], "format": "json"})
            rows = payload.get("data") if isinstance(payload, dict) else []
            points = []
            for row in reversed(rows or []):
                try:
                    value = max(0, min(100, int(row["value"])))
                    timestamp = datetime.fromtimestamp(int(row["timestamp"]), UTC).isoformat()
                except (KeyError, TypeError, ValueError):
                    continue
                points.append(FearGreedPoint(timestamp=timestamp, value=value, classification=self.fear_greed_classification(value)))
            current = points[-1].value if points else None
            previous = points[-2].value if len(points) > 1 else None
            return FearGreedResponse(
                range=normalized_range,
                current_value=current,
                current_classification=self.fear_greed_classification(current) if current is not None else None,
                daily_change=current - previous if current is not None and previous is not None else None,
                points=points,
                updated_at=datetime.now(UTC).isoformat(),
                data_sources=["alternative.me"],
                provider_status=[self._status("alternative.me", "ok")],
            )

        return self._cached(f"fear-greed:{normalized_range}", 21_600, load)

    def halving(self) -> HalvingCycleResponse:
        def load() -> HalvingCycleResponse:
            payload = _get_json("https://api.blockchain.info/stats")
            if not isinstance(payload, dict):
                raise RuntimeError("Blockchain.com returned an invalid stats payload")
            latest_height = int(payload.get("n_blocks_total") or payload.get("n_blocks_mined") or 0)
            if latest_height < LAST_HALVING_HEIGHT:
                raise RuntimeError("Blockchain.com returned an invalid block height")
            blocks_mined_24h = int(payload.get("n_blocks_mined") or 144)
            average_block_minutes = 1440 / max(1, blocks_mined_24h)
            completed = min(NEXT_HALVING_HEIGHT - LAST_HALVING_HEIGHT, latest_height - LAST_HALVING_HEIGHT)
            remaining = max(0, NEXT_HALVING_HEIGHT - latest_height)
            estimated_days = round(remaining * average_block_minutes / 1440)
            estimated_date = datetime.now(UTC) + timedelta(days=estimated_days)
            return HalvingCycleResponse(
                previous_halving_date=LAST_HALVING_DATE.date().isoformat(),
                previous_halving_height=LAST_HALVING_HEIGHT,
                latest_block_height=latest_height,
                next_halving_height=NEXT_HALVING_HEIGHT,
                next_halving_number=5,
                progress_pct=round(completed / (NEXT_HALVING_HEIGHT - LAST_HALVING_HEIGHT) * 100, 2),
                blocks_completed=completed,
                blocks_remaining=remaining,
                estimated_days_remaining=max(0, estimated_days),
                estimated_next_halving_date=estimated_date.date().isoformat(),
                average_block_minutes=round(average_block_minutes, 2),
                updated_at=datetime.now(UTC).isoformat(),
                data_sources=["blockchain.com"],
                provider_status=[self._status("blockchain.com", "ok")],
            )

        return self._cached("bitcoin-halving", 900, load)

    def network(self) -> BitcoinNetworkMetrics:
        def load() -> BitcoinNetworkMetrics:
            stats = _get_json("https://api.blockchain.info/stats")
            if not isinstance(stats, dict):
                raise RuntimeError("Blockchain.com returned an invalid network payload")
            return BitcoinNetworkMetrics(
                hash_rate=_clean_number(stats.get("hash_rate")),
                difficulty=_clean_number(stats.get("difficulty")),
                transactions_24h=int(stats.get("n_tx") or 0) or None,
                fees_btc_24h=_clean_number(stats.get("total_fees_btc")),
                blocks_mined_24h=int(stats.get("n_blocks_mined") or 0) or None,
            )

        return self._cached("bitcoin-network", 300, load)

    def mempool(self) -> BitcoinMempoolMetrics:
        def load() -> BitcoinMempoolMetrics:
            mempool = _get_json("https://mempool.space/api/mempool")
            fees = _get_json("https://mempool.space/api/v1/fees/recommended")
            block_height = _get_json("https://mempool.space/api/blocks/tip/height")
            if not isinstance(mempool, dict) or not isinstance(fees, dict):
                raise RuntimeError("mempool.space returned an invalid payload")
            total_fee_sats = _clean_number(mempool.get("total_fee"))
            return BitcoinMempoolMetrics(
                block_height=int(block_height) if isinstance(block_height, (int, float)) else None,
                unconfirmed_transactions=int(mempool.get("count") or 0) or None,
                virtual_size_bytes=int(mempool.get("vsize") or 0) or None,
                total_fees_btc=total_fee_sats / 100_000_000 if total_fee_sats is not None else None,
                fastest_fee_sats_vb=_clean_number(fees.get("fastestFee")),
                half_hour_fee_sats_vb=_clean_number(fees.get("halfHourFee")),
                hour_fee_sats_vb=_clean_number(fees.get("hourFee")),
                economy_fee_sats_vb=_clean_number(fees.get("economyFee")),
                minimum_fee_sats_vb=_clean_number(fees.get("minimumFee")),
            )

        return self._cached("bitcoin-mempool", 60, load)

    def defi(self) -> CryptoDefiMetrics:
        def load() -> CryptoDefiMetrics:
            chains_payload = _get_json("https://api.llama.fi/v2/chains")
            dex_payload = _get_json(
                "https://api.llama.fi/overview/dexs",
                {"excludeTotalDataChart": "true", "excludeTotalDataChartBreakdown": "true"},
            )
            chains = []
            if isinstance(chains_payload, list):
                for row in chains_payload:
                    if not isinstance(row, dict):
                        continue
                    tvl = _clean_number(row.get("tvl"))
                    name = str(row.get("name") or "").strip()
                    if name and tvl is not None and tvl >= 0:
                        chains.append(CryptoDefiChain(name=name, tvl_usd=tvl))
            chains.sort(key=lambda row: row.tvl_usd, reverse=True)
            if not chains and not isinstance(dex_payload, dict):
                raise RuntimeError("DefiLlama returned no usable market data")
            dex_volume = _clean_number(dex_payload.get("total24h")) if isinstance(dex_payload, dict) else None
            return CryptoDefiMetrics(
                total_value_locked_usd=sum(row.tvl_usd for row in chains) or None,
                dex_volume_24h_usd=dex_volume,
                top_chains=chains[:6],
            )

        return self._cached("crypto-defi", 600, load)

    def market_breadth(self) -> CryptoMarketBreadthMetrics:
        def load() -> CryptoMarketBreadthMetrics:
            payload = _get_json("https://api.coingecko.com/api/v3/global", headers=self._coingecko_headers())
            data = payload.get("data") if isinstance(payload, dict) else None
            if not isinstance(data, dict):
                raise RuntimeError("CoinGecko returned an invalid global market payload")
            percentages = data.get("market_cap_percentage") if isinstance(data.get("market_cap_percentage"), dict) else {}
            market_caps = data.get("total_market_cap") if isinstance(data.get("total_market_cap"), dict) else {}
            volumes = data.get("total_volume") if isinstance(data.get("total_volume"), dict) else {}
            return CryptoMarketBreadthMetrics(
                bitcoin_dominance_pct=_clean_number(percentages.get("btc")),
                total_market_cap_usd=_clean_number(market_caps.get("usd")),
                total_volume_24h_usd=_clean_number(volumes.get("usd")),
            )

        return self._cached("crypto-market-breadth", 300, load)

    def context(self, base: str, quote: str = "CAD", sentiment_range: str = "30D") -> CryptoContextResponse:
        normalized_base, normalized_quote, _, _ = self.normalize_asset(base, quote)
        statuses: list[CryptoProviderStatus] = []
        sources: list[str] = []
        results: dict[str, Any] = {}
        loaders: dict[str, tuple[str, Callable[[], Any]]] = {
            "fear_greed": ("alternative.me", lambda: self.fear_greed(sentiment_range)),
            "market": ("coingecko", self.market_breadth),
        }
        if normalized_base == "BTC":
            loaders.update({
                "halving": ("blockchain.com", self.halving),
                "network": ("blockchain.com", self.network),
                "mempool": ("mempool.space", self.mempool),
                "defi": ("defillama", self.defi),
            })
        with ThreadPoolExecutor(max_workers=len(loaders)) as executor:
            futures = {executor.submit(loader): (key, provider) for key, (provider, loader) in loaders.items()}
            for future in as_completed(futures):
                key, provider = futures[future]
                try:
                    results[key] = future.result()
                    statuses.append(self._status(provider, "ok"))
                    sources.append(provider)
                except Exception as exc:
                    statuses.append(self._status(provider, "error", str(exc)[:160]))

        fear_greed = results.get("fear_greed")
        halving = results.get("halving")
        return CryptoContextResponse(
            base_asset=normalized_base,
            quote_currency=normalized_quote,
            fear_greed=fear_greed,
            halving=halving,
            network=results.get("network"),
            mempool=results.get("mempool"),
            defi=results.get("defi"),
            market=results.get("market"),
            updated_at=datetime.now(UTC).isoformat(),
            data_sources=list(dict.fromkeys(sources)),
            provider_status=statuses,
        )


crypto_market_service = CryptoMarketService()
