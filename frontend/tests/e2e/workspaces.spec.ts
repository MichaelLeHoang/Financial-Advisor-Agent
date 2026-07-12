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
