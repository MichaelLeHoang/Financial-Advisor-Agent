import { expect, test } from "@playwright/test";

const userId = "00000000-0000-0000-0000-000000000099";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
  await page.route("**/api/v1/watchlists", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "watch-1", user_id: userId, name: "Core holdings", created_at: "2026-08-07T12:00:00Z" }, { id: "watch-2", user_id: userId, name: "Growth ideas", created_at: "2026-08-07T12:00:00Z" }]) });
    return route.continue();
  });
  await page.route("**/api/v1/watchlists/watch-1/assets", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "asset-1", watchlist_id: "watch-1", symbol: "AAPL", asset_type: "equity", created_at: "2026-08-07T12:00:00Z" }]) }));
  await page.route("**/api/v1/watchlists/watch-2/assets", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(route.request().method() === "POST" ? { id: "asset-2", watchlist_id: "watch-2", symbol: "AAPL", asset_type: "equity", created_at: "2026-08-07T12:00:00Z" } : []) }));
  await page.route("**/api/v1/alerts", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "alert-1", user_id: userId, name: "AAPL breakout", alert_type: "price", symbol: "AAPL", condition: { operator: "above", price: 240, cooldown_minutes: 1440 }, channels: [], is_active: true, created_at: "2026-08-07T12:00:00Z", updated_at: "2026-08-07T12:00:00Z" }]) }));
  await page.route("**/api/v1/market/quote/**", (route) => {
    const ticker = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "AAPL").toUpperCase();
    const isApple = ticker === "AAPL";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ticker,
      name: isApple ? "Apple Inc." : ticker,
      exchange: "NASDAQ",
      price: isApple ? 233.16 : 100.82,
      change: isApple ? 1.54 : 0.82,
      market_cap: isApple ? 3_560_000_000_000 : 1_000_000_000,
      pe_ratio: isApple ? 35.5 : 20.1,
      history: [{ label: "Aug 6", price: isApple ? 231.2 : 100, volume: 1000 }, { label: "Aug 7", price: isApple ? 233.16 : 100.82, volume: 1200 }],
      earnings: isApple ? [{ date: "2026-11-05", eps_actual: null, eps_estimate: 1.85, beat_pct: null, revenue_actual: null, revenue_estimate: null, revenue_beat_pct: null }] : [],
    }) });
  });
});

test("market discovery and stock details support the heatmap and both chart engines", async ({ page }) => {
  await page.goto("/discover/markets");
  await expect.poll(() => page.evaluate(() => document.body.dataset.workspaceReady)).toBe("true");
  await expect(page.getByRole("heading", { name: "See leadership before individual names" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "S&P 500 stock heatmap" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Global market overview" })).toBeVisible();

  await page.goto("/discover/markets/stocks/AAPL?exchange=NASDAQ");
  await expect(page.getByRole("heading", { name: "AAPL stock details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Price chart" })).toBeVisible();
  await expect(page.getByRole("region", { name: "AAPL Quanfora chart" })).toBeVisible();
  await page.getByRole("button", { name: /Chart type:/ }).focus();
  await expect(page.getByRole("tooltip", { name: /chart · Switch to/ })).toBeVisible();
  await page.getByRole("button", { name: "TradingView" }).click();
  await expect(page.getByRole("region", { name: "AAPL advanced chart" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "TradingView market performance" })).toBeVisible();
  await expect(page.getByRole("region", { name: "AAPL market performance" })).toBeVisible();
  await expect(page.getByRole("region", { name: "AAPL technical analysis" })).toBeVisible();
  await page.getByRole("button", { name: "Add to watchlist" }).click();
  await page.getByRole("checkbox", { name: /Growth ideas/ }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("AAPL added to Growth ideas")).toBeVisible();
});

test("watchlist table keeps quote context and active alerts together", async ({ page }) => {
  await page.goto("/discover/watchlists");
  await expect.poll(() => page.evaluate(() => document.body.dataset.workspaceReady)).toBe("true");
  await expect(page.getByRole("heading", { name: "Watchlists & alerts" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Apple Inc." })).toBeVisible();
  await expect(page.getByRole("cell", { name: "$233.16" })).toBeVisible();
  await expect(page.getByText("Price > $240.00")).toBeVisible();
  await expect(page.getByText("Once per day")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Market context" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Markets", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Crypto" }).click();
  await expect(page.getByRole("link", { name: "Open Bitcoin / CAD market details" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Research S&P 500" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "US market summary" })).toBeVisible();
  await expect(page.getByText("Cached market brief", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Major indexes finish higher following blockbuster SpaceX debut" }).click();
  await expect(page.getByRole("link", { name: "Dive deeper on this topic with AI" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming earnings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AAPL Apple Inc. Nov 5, 2026" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Market trends" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest market news" })).toBeVisible();
  await page.getByRole("link", { name: "Open Bitcoin / CAD market details" }).click();
  await expect(page.getByRole("heading", { name: "BTC-CAD stock details" })).toBeVisible();
});
