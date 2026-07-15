import { expect, test, type Page, type TestInfo } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
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
    await page.getByRole("button", { name: "Edit layout" }).click();
    await capture(page, testInfo, "paper-trading-edit-layout");
    await page.getByRole("button", { name: "Add widget" }).click();
    await expect(page.getByRole("dialog", { name: "Add widget" })).toBeVisible();
    await capture(page, testInfo, "paper-trading-add-widget");
    await page.getByRole("button", { name: "Close add widget" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
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
