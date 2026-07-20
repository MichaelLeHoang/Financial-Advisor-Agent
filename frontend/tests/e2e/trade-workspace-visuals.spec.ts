import { expect, test, type Page, type TestInfo } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
  await page.route("**/api/v1/market/quote/**", async (route) => {
    const ticker = new URL(route.request().url()).pathname.split("/").at(-1) ?? "AMD";
    const prices: Record<string, number> = { AMD: 170, NVDA: 132, AAPL: 226 };
    const price = prices[ticker] ?? 100;
    const history = Array.from({ length: 96 }, (_, index) => {
      const close = price - 1.2 + Math.sin(index / 7) * 1.1 + index * (1.2 / 95);
      return { label: new Date(Date.UTC(2026, 6, 7, 9, 30) + index * 3_600_000).toISOString(), price: close, open: close - 0.3, high: close + 0.5, low: close - 0.6, volume: 350_000 + index * 4_000 };
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ticker, name: ticker, exchange: "NASDAQ", currency: "USD", price, change: 0.42, history }) });
  });
});

async function waitForDesk(page: Page) {
  await expect.poll(() => page.evaluate(() => document.body.dataset.workspaceReady)).toBe("true");
  await expect(page.getByRole("heading", { name: "Paper Trading Desk" })).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ fullPage: true, path });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

test("captures the Paper Trading workspace acceptance states", async ({ page }, testInfo) => {
  await page.goto("/trade");
  await waitForDesk(page);
  await capture(page, testInfo, "paper-trading-default");

  if (testInfo.project.name === "desktop") {
    const chartWidget = page.locator('[data-widget-type="price_chart"]');
    await chartWidget.locator("canvas").first().hover({ position: { x: 240, y: 160 }, force: true });
    await expect(chartWidget.getByText("AMD close", { exact: false })).toBeVisible();
    await capture(page, testInfo, "paper-trading-chart-tooltip");
    await page.getByRole("button", { name: "Order type" }).click();
    await expect(page.getByTestId("order-type-options-menu")).toBeVisible();
    await page.waitForTimeout(200);
    await capture(page, testInfo, "paper-trading-order-type-menu");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Edit layout" }).click();
    await capture(page, testInfo, "paper-trading-edit-layout");
    await page.getByRole("button", { name: "Add widget" }).click();
    await expect(page.getByTestId("add-widget-menu")).toBeVisible();
    await page.waitForTimeout(200);
    await capture(page, testInfo, "paper-trading-add-widget");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Workspace actions" }).click();
    await page.getByRole("menuitem", { name: "New empty workspace" }).click();
    await expect(page.getByRole("heading", { name: "Start from a template", exact: true })).toBeVisible();
    await capture(page, testInfo, "empty-trading-workspace");
    await page.getByRole("button", { name: "Presets" }).click();
    await expect(page.getByTestId("workspace-presets-menu")).toBeVisible();
    await page.waitForTimeout(200);
    await capture(page, testInfo, "paper-trading-presets");
    const presetMenu = page.getByTestId("workspace-presets-menu");
    await presetMenu.getByRole("menuitem", { name: /^Options trading/ }).click();
    await expect(presetMenu).toBeHidden();
    await page.waitForTimeout(200);
    await expect(page.getByRole("heading", { name: "Options Chain" })).toBeVisible();
    await capture(page, testInfo, "options-trading-preset");
    await page.getByRole("button", { name: "Workspace actions" }).click();
    await page.getByRole("menuitem", { name: "Delete workspace" }).click();
    await expect(page.getByRole("alertdialog", { name: /Delete Options Trading/ })).toBeVisible();
    await capture(page, testInfo, "delete-workspace-warning");
    await page.getByRole("button", { name: "Keep workspace" }).click();
    await page.getByRole("button", { name: "Options Trading" }).click();
    await page.getByRole("menu", { name: "Workspace selector" }).getByRole("menuitem", { name: "Paper Trading Desk" }).click();
  }

  await page.getByRole("spinbutton", { name: "Stop" }).fill("175");
  await expect(page.getByText("Policy blocked", { exact: true })).toBeVisible();
  await capture(page, testInfo, "paper-trading-policy-failed");
  await page.getByRole("spinbutton", { name: "Stop" }).fill("164");
  await page.getByRole("button", { name: "Review paper order" }).click();
  await expect(page.getByRole("alertdialog", { name: "Buy 100 AMD" })).toBeVisible();
  await capture(page, testInfo, "paper-trading-order-review");
  await page.getByRole("button", { name: "Submit paper order" }).click();
  await expect(page.getByRole("cell", { name: "AMD" })).toBeVisible();
  await capture(page, testInfo, testInfo.project.name === "mobile" ? "paper-trading-mobile" : "paper-trading-order-submitted");
});
