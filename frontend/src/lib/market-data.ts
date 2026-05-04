export interface MarketSymbol {
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  price: number;
  change: number;
}

export interface MarketPoint {
  label: string;
  price: number;
  volume: number;
}

export const MARKET_SYMBOLS: MarketSymbol[] = [
  { ticker: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", sector: "Technology", price: 196.58, change: 0.84 },
  { ticker: "NVDA", name: "NVIDIA Corp.", exchange: "NASDAQ", sector: "Semiconductors", price: 188.73, change: 1.92 },
  { ticker: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ", sector: "Communication Services", price: 284.17, change: -0.36 },
  { ticker: "MSFT", name: "Microsoft Corp.", exchange: "NASDAQ", sector: "Technology", price: 512.44, change: 0.62 },
  { ticker: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ", sector: "Consumer Discretionary", price: 437.21, change: -1.18 },
  { ticker: "AMZN", name: "Amazon.com, Inc.", exchange: "NASDAQ", sector: "Consumer Discretionary", price: 236.05, change: 0.48 },
  { ticker: "META", name: "Meta Platforms, Inc.", exchange: "NASDAQ", sector: "Communication Services", price: 681.33, change: 1.14 },
  { ticker: "AMD", name: "Advanced Micro Devices", exchange: "NASDAQ", sector: "Semiconductors", price: 167.92, change: 0.37 },
  { ticker: "NFLX", name: "Netflix, Inc.", exchange: "NASDAQ", sector: "Communication Services", price: 1094.88, change: -0.27 },
  { ticker: "AVGO", name: "Broadcom Inc.", exchange: "NASDAQ", sector: "Semiconductors", price: 349.42, change: 1.06 },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", exchange: "NYSE", sector: "Financials", price: 301.76, change: 0.31 },
  { ticker: "V", name: "Visa Inc.", exchange: "NYSE", sector: "Financials", price: 348.25, change: -0.12 },
  { ticker: "MA", name: "Mastercard Inc.", exchange: "NYSE", sector: "Financials", price: 581.64, change: 0.22 },
  { ticker: "LLY", name: "Eli Lilly and Co.", exchange: "NYSE", sector: "Health Care", price: 914.57, change: 0.74 },
  { ticker: "UNH", name: "UnitedHealth Group", exchange: "NYSE", sector: "Health Care", price: 529.18, change: -0.43 },
  { ticker: "COST", name: "Costco Wholesale", exchange: "NASDAQ", sector: "Consumer Staples", price: 1007.81, change: 0.28 },
  { ticker: "WMT", name: "Walmart Inc.", exchange: "NYSE", sector: "Consumer Staples", price: 104.39, change: 0.18 },
  { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "NYSE Arca", sector: "ETF", price: 676.12, change: 0.41 },
  { ticker: "QQQ", name: "Invesco QQQ Trust", exchange: "NASDAQ", sector: "ETF", price: 615.47, change: 0.69 },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", exchange: "NYSE Arca", sector: "ETF", price: 247.08, change: -0.19 },
  { ticker: "BTC-USD", name: "Bitcoin USD", exchange: "Crypto", sector: "Digital Assets", price: 93642.5, change: 1.31 },
  { ticker: "ETH-USD", name: "Ethereum USD", exchange: "Crypto", sector: "Digital Assets", price: 3184.2, change: 0.95 },
];

export const DEFAULT_MARKET_TICKERS = ["AAPL", "NVDA", "GOOGL", "MSFT", "TSLA", "AMZN", "META"];

export const CHART_RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y"] as const;

export type ChartRange = (typeof CHART_RANGES)[number];

export function findMarketSymbol(ticker: string): MarketSymbol | undefined {
  return MARKET_SYMBOLS.find((symbol) => symbol.ticker === normalizeTicker(ticker));
}

export function normalizeTicker(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function searchMarketSymbols(query: string, limit = 8) {
  const normalized = normalizeTicker(query);
  if (!normalized) return [];

  return MARKET_SYMBOLS.filter((symbol) => {
    const haystack = `${symbol.ticker} ${symbol.name} ${symbol.exchange} ${symbol.sector}`.toUpperCase();
    return haystack.includes(normalized);
  }).slice(0, limit);
}

export function createMarketSymbol(ticker: string): MarketSymbol {
  const normalized = normalizeTicker(ticker);
  const known = findMarketSymbol(normalized);
  if (known) return known;

  const seed = hashTicker(normalized);
  const price = 25 + (seed % 48000) / 100;
  const change = ((seed % 640) - 320) / 100;
  return {
    ticker: normalized,
    name: `${normalized} Market Instrument`,
    exchange: "Custom",
    sector: "Watchlist",
    price,
    change,
  };
}

export function createMarketSeries(symbol: MarketSymbol, range: ChartRange): MarketPoint[] {
  const lengthByRange: Record<ChartRange, number> = {
    "1D": 28,
    "5D": 36,
    "1M": 30,
    "6M": 52,
    "YTD": 44,
    "1Y": 60,
    "5Y": 72,
  };
  const length = lengthByRange[range];
  const seed = hashTicker(`${symbol.ticker}-${range}`);
  const drift = symbol.change / 120;
  let price = symbol.price * (1 - drift * length * 0.25);

  return Array.from({ length }, (_, index) => {
    const wave = Math.sin((index + seed % 9) / 3.2) * 0.012;
    const pulse = Math.cos((index + seed % 13) / 5.4) * 0.008;
    price = Math.max(1, price * (1 + drift + wave + pulse));
    return {
      label: pointLabel(index, length, range),
      price: Number(price.toFixed(2)),
      volume: Math.round(800000 + ((seed + index * 9973) % 6200000)),
    };
  });
}

function pointLabel(index: number, length: number, range: ChartRange) {
  if (range === "1D") return `${9 + Math.floor(index / 4)}:${index % 4 === 0 ? "30" : "45"}`;
  if (range === "5D") return `D${Math.ceil((index + 1) / 7)}`;
  if (range === "1M") return `Day ${index + 1}`;
  if (range === "6M") return `W${index + 1}`;
  if (range === "YTD") return `W${index + 1}`;
  if (range === "1Y") return `M${Math.ceil((index + 1) / 5)}`;
  return `Q${Math.ceil((index + 1) / 4)}`;
}

function hashTicker(value: string) {
  return value.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 2166136261);
}
