export const CRYPTO_BASES = ["BTC", "ETH", "LTC", "DOGE", "ADA"] as const;
export const CRYPTO_QUOTES = ["CAD", "USD", "USDT"] as const;

export type CryptoBase = (typeof CRYPTO_BASES)[number];
export type CryptoQuote = (typeof CRYPTO_QUOTES)[number];

export function parseCryptoSymbol(symbol: string): { base: CryptoBase; quote: CryptoQuote } | null {
  const [base, quote] = symbol.trim().toUpperCase().split("-");
  if (!CRYPTO_BASES.includes(base as CryptoBase) || !CRYPTO_QUOTES.includes(quote as CryptoQuote)) return null;
  return { base: base as CryptoBase, quote: quote as CryptoQuote };
}

export function isCryptoSymbol(symbol: string) {
  return parseCryptoSymbol(symbol) !== null;
}

export function marketDetailsHref(symbol: string, assetType?: string) {
  const route = assetType === "crypto" || isCryptoSymbol(symbol) ? "crypto" : "stocks";
  return `/discover/markets/${route}/${encodeURIComponent(symbol)}`;
}
