import { expect, test } from "@playwright/test";

const report = (date: string, estimate: number, actual: number | null = null) => ({
  date,
  session: "post",
  eps_actual: actual,
  eps_estimate: estimate,
  beat_pct: actual == null ? null : ((actual - estimate) / Math.abs(estimate)) * 100,
  revenue_actual: actual == null ? null : 42_000_000_000,
  revenue_estimate: 40_000_000_000,
  revenue_beat_pct: actual == null ? null : 5,
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
  await page.route("**/api/v1/market/earnings?**", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    const requested = new Set((query.get("symbols") ?? "").split(",").filter(Boolean));
    const rows = [
      { symbol: "AAPL", name: "Apple Inc.", date: "2026-08-11", session: "post" },
      { symbol: "ORCL", name: "Oracle Corp.", date: "2026-08-12", session: "post" },
      { symbol: "WMT", name: "Walmart Inc.", date: "2026-08-13", session: "pre" },
    ].filter((row) => !requested.size || requested.has(row.symbol));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        from_date: query.get("from"),
        to_date: query.get("to"),
        data_sources: ["yfinance_earnings_calendar"],
        events: rows.map((row) => ({ ...row, country: "US", market_cap: 500_000_000_000, logo_url: null, eps_actual: null, eps_estimate: 1.85, beat_pct: null, revenue_actual: null, revenue_estimate: 40_000_000_000, revenue_beat_pct: null })),
      }),
    });
  });
  await page.route("**/api/v1/market/quote/**", async (route) => {
    const ticker = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "AAPL").toUpperCase();
    const currentDates: Record<string, string> = { AAPL: "2026-08-11", ORCL: "2026-08-12", WMT: "2026-08-13" };
    const current = currentDates[ticker];
    const earnings = current ? [
      report("2025-11-05", 1.42, 1.50),
      report("2026-02-04", 1.56, 1.61),
      report("2026-05-06", 1.68, 1.73),
      report(current, 1.85),
    ] : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ticker,
        name: ticker === "AAPL" ? "Apple Inc." : ticker === "ORCL" ? "Oracle Corp." : ticker === "WMT" ? "Walmart Inc." : ticker,
        exchange: "NASDAQ",
        currency: "USD",
        price: 180,
        change: 1.2,
        market_cap: 500_000_000_000,
        history: [],
        earnings,
      }),
    });
  });
});

test("earnings agenda opens day detail and switches to a filtered month", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop covers the complete earnings workspace composition.");
  await page.goto("/discover/earnings?view=list&date=2026-08-11");
  await expect.poll(() => page.evaluate(() => document.body.dataset.workspaceReady)).toBe("true");

  await expect(page.getByRole("heading", { name: "Earnings", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Earnings", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "August 11, 2026" }).first()).toBeVisible();
  await page.getByRole("button", { name: /Apple Inc\./ }).click();
  await expect(page.getByText("Earnings history")).toBeVisible();
  await expect(page.getByRole("link", { name: "Research AAPL" })).toBeVisible();

  await page.getByRole("tab", { name: "Month" }).click();
  await expect(page).toHaveURL(/view=month/);
  await expect(page.getByRole("region", { name: "August 2026 earnings calendar" })).toBeVisible();
  await page.getByRole("button", { name: "Open earnings filters" }).click();
  await expect(page.getByRole("heading", { name: "Filters", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Country/ }).click();
  await expect(page.getByRole("radio", { name: "U.S." })).toBeVisible();
});
