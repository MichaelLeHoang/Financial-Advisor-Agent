import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
});

async function waitForWorkspace(page: import("@playwright/test").Page) {
  await expect(page.locator('body[data-workspace-ready="true"]')).toBeVisible({ timeout: 60_000 });
}

test("legacy dashboard redirects to the unified Home", async ({ page }) => {
  await page.goto("/dashboard");
  await waitForWorkspace(page);
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Good morning" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Investment Book", { exact: true })).toBeVisible();
  await expect(page.getByText("Trading Book", { exact: true })).toBeVisible();
});

test("workspace subnavigation exposes focused Portfolio and Discover routes", async ({ page }) => {
  await page.goto("/portfolio");
  await waitForWorkspace(page);
  const portfolioNav = page.getByRole("navigation", { name: "Portfolio navigation" });
  await expect(portfolioNav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await portfolioNav.getByRole("link", { name: "Holdings" }).click();
  await expect(page).toHaveURL(/\/portfolio\/holdings$/);
  await expect(portfolioNav.getByRole("link", { name: "Holdings" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Portfolio", exact: true })).toBeVisible();

  await page.goto("/discover/picks");
  await waitForWorkspace(page);
  const discoverNav = page.getByRole("navigation", { name: "Discover navigation" });
  await expect(discoverNav.getByRole("link", { name: "Picks" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("header.introduction-nav")).toHaveCount(0);
});

test("locked workspace destinations remain visible and use canonical redirects", async ({ page }) => {
  await page.goto("/signals");
  await waitForWorkspace(page);
  await expect(page).toHaveURL(/\/discover\/screeners$/);
  const screenersLink = page.getByRole("navigation", { name: "Discover navigation" }).getByRole("link", { name: /Screeners/ });
  await expect(screenersLink).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: /Signal Ranking is available on Quant/ })).toBeVisible();

  await page.goto("/risk");
  await expect(page).toHaveURL(/\/portfolio\/risk$/);
  await page.goto("/news?tab=picks");
  await expect(page).toHaveURL(/\/discover\/picks/);
});

test("external next destinations are rejected", async ({ page }) => {
  await page.goto("/login?next=https%3A%2F%2Fevil.example%2Fcollect");
  await waitForWorkspace(page);
  await expect(page).toHaveURL(/\/home$/);
});

test("new account onboarding preserves the Invest destination", async ({ page }) => {
  await page.goto("/onboarding?next=%2Finvest");
  await waitForWorkspace(page);
  await expect(page.getByRole("heading", { name: "How do you manage capital?" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: /Long-term investing/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Open Invest" }).click();
  await expect(page).toHaveURL(/\/invest$/);
  await expect(page.getByRole("heading", { name: /Build conviction/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.keys(window.localStorage).some((key) => key.startsWith("quanfora.onboarding.user:")))).toBe(true);
});

test("investment decision is recorded in the shared journal", async ({ page }) => {
  await page.goto("/invest");
  await waitForWorkspace(page);
  await expect(page.getByRole("heading", { name: /Build conviction/ })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Classify as Investment" }).click();
  await page.getByRole("button", { name: "Save thesis" }).click();
  await page.getByRole("button", { name: "Apply policy" }).click();
  await expect(page.getByText("Policy violation", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Trim", exact: true }).click();
  await page.getByRole("button", { name: "Record decision" }).click();
  await page.goto("/journal");
  await expect(page.getByText("NVDA · Trim decision recorded")).toBeVisible();
  await page.getByRole("navigation", { name: "Journal navigation" }).getByRole("link", { name: "Investments" }).click();
  await expect(page).toHaveURL(/\/journal\/investments$/);
  await expect(page.getByText("NVDA · Trim decision recorded")).toBeVisible();
});

test("paper trade requires review and creates a simulated fill", async ({ page }) => {
  await page.goto("/trade");
  await waitForWorkspace(page);
  await expect(page.getByRole("heading", { name: "Paper Trading Desk" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Policy passed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review paper order" }).click();
  await expect(page.getByRole("dialog", { name: "Buy 100 AMD" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm simulated fill" }).click();
  await expect(page.getByText("100 AMD shares filled at $170.00")).toBeVisible();
  await page.goto("/journal");
  await expect(page.getByText("AMD · Paper order filled")).toBeVisible();
});

test("Strategy Studio validates changes, versions a draft, and records paper approval", async ({ page }) => {
  await page.goto("/trade/strategies");
  await waitForWorkspace(page);
  await page.getByRole("link", { name: /Daily Trend Discipline/ }).click();
  await expect(page.getByRole("heading", { name: "Visual Strategy Tree" })).toBeVisible();

  await page.getByRole("button", { name: "Remove Risk budget" }).click();
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByText("Add a deterministic risk rule before validation.")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();

  const architectTab = page.getByRole("tab", { name: "architect" });
  if (await architectTab.isVisible()) await architectTab.click();
  await page.getByRole("button", { name: "Accept change" }).click();
  await page.getByRole("button", { name: "Save version" }).click();
  await page.getByRole("button", { name: "Paper deploy" }).click();
  await expect(page.getByRole("dialog", { name: /Deploy Daily Trend Discipline/ })).toBeVisible();
  await page.getByRole("button", { name: "Confirm paper deployment" }).click();

  await page.goto("/journal/strategies");
  await expect(page.getByText("Daily Trend Discipline · Paper deployment approved")).toBeVisible();
});

test("Strategy Studio hands compatible definitions to the deterministic Backtest Lab", async ({ page }) => {
  await page.goto("/trade/strategies/trading-starter");
  await waitForWorkspace(page);
  const previewTab = page.getByRole("tab", { name: "preview" });
  if (await previewTab.isVisible()) await previewTab.click();
  await page.getByRole("link", { name: "Open deterministic Backtest Lab" }).click();
  await expect(page).toHaveURL(/\/trade\/strategies\/backtest\?template=moving_average_crossover/);
  await expect(page.getByRole("heading", { name: "Backtest Lab" })).toBeVisible();
  await expect(page.locator('input[value="Daily Trend Discipline"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove AAPL" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove MSFT" })).toBeVisible();
});

test("Strategy Studio keeps its editing surface within desktop and mobile viewports", async ({ page }, testInfo) => {
  await page.goto("/trade/strategies/trading-starter");
  await waitForWorkspace(page);
  await expect(page.getByRole("heading", { name: "Visual Strategy Tree" })).toBeVisible();

  if (testInfo.project.name === "desktop") {
    await expect(page.getByRole("heading", { name: "Strategy Architect" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Backtest Preview" })).toBeVisible();
  } else {
    await page.getByRole("tab", { name: "preview" }).click();
    await expect(page.getByRole("heading", { name: "Backtest Preview" })).toBeVisible();
  }

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
