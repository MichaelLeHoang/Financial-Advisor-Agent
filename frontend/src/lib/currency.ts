import { fetchQuote } from "@/lib/quote-cache";

export async function fetchCurrencyRate(sourceCurrency: string, targetCurrency: string): Promise<number> {
  const source = sourceCurrency.toUpperCase();
  const target = targetCurrency.toUpperCase();
  if (source === target) return 1;

  try {
    if (source === "USD" && target === "CAD") {
      return (await fetchQuote("CAD=X", "1d", "1d")).price;
    }
    if (source === "CAD" && target === "USD") {
      const rate = (await fetchQuote("CAD=X", "1d", "1d")).price;
      return rate ? 1 / rate : 1;
    }
    const direct = await fetchQuote(`${source}${target}=X`, "1d", "1d");
    if (direct.price > 0) return direct.price;
  } catch {
    try {
      const inverse = await fetchQuote(`${target}${source}=X`, "1d", "1d");
      if (inverse.price > 0) return 1 / inverse.price;
    } catch {
      return 1;
    }
  }
  return 1;
}
