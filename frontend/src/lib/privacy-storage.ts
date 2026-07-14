import { invalidateAll as clearQuoteCache } from "@/lib/quote-cache";

const ACCOUNT_STATE_KEYS = [
  "market.savedStocks",
  "market.skipRemoveConfirm",
  "financial-advisor.recent-searches",
  "financial-advisor.news-categories",
  "financial-advisor.watchlist-summary",
  "portfolio.hideAmounts",
];

function shouldClearAccountStateKey(key: string) {
  return ACCOUNT_STATE_KEYS.includes(key)
    || key.startsWith("quanfora.workspace-prototype.")
    || key.startsWith("quanfora.investment-overview.")
    || key.startsWith("quanfora.investment-records.")
    || key.startsWith("financial-advisor.news-categories.")
    || key.startsWith("financial-advisor.wikipedia-profile.");
}

export function clearAccountScopedBrowserState() {
  if (typeof window === "undefined") return;

  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key));
      for (const key of keys) {
        if (shouldClearAccountStateKey(key)) storage.removeItem(key);
      }
    } catch {
      // Ignore storage access failures in private browsing or restricted contexts.
    }
  }

  clearQuoteCache();
}
