import { expect, test } from "@playwright/test";

test("landing exposes metadata, skip navigation, and a readable mobile product preview", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile landing regression");
  await page.goto("/");

  await expect(page).toHaveTitle(/Quanfora/);
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeAttached();

  const preview = page.locator("section.landing-fixed-demo figure");
  await expect(preview).toBeVisible();
  const box = await preview.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(320);
  await expect(preview.getByAltText(/Quanfora research workspace/)).toBeVisible();
  await expect(page.locator("section.landing-fixed-demo").getByRole("button", { name: "Back" })).toHaveCount(0);
});

test("search behaves as an accessible account-scoped dialog", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop keyboard-dialog regression");
  await page.addInitScript(() => {
    window.localStorage.setItem("financial-advisor.recent-searches", JSON.stringify(["legacy shared term"]));
    window.localStorage.setItem(
      "financial-advisor.recent-searches.user.00000000-0000-0000-0000-000000000099",
      JSON.stringify(["scoped term"]),
    );
  });
  await page.goto("/");

  const trigger = page.getByRole("button", { name: /Search/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Search Quanfora" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search Quanfora" })).toBeFocused();
  await expect(dialog.getByText("scoped term")).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("financial-advisor.recent-searches"))).toBeNull();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("mobile workspace header clears the fixed navigation trigger", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile workspace regression");
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
  await page.goto("/home");

  const menu = page.getByRole("button", { name: "Open navigation" });
  const eyebrow = page.getByText("Command center", { exact: true });
  await expect(menu).toBeVisible();
  await expect(eyebrow).toBeVisible();
  const menuBox = await menu.boundingBox();
  const eyebrowBox = await eyebrow.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(eyebrowBox).not.toBeNull();
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(eyebrowBox!.y);
});

test("short phones keep the AI starter content clear of fixed navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Short-phone AI Desk regression");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
  await page.goto("/ai");

  const menu = page.getByRole("button", { name: "Open navigation" });
  const heading = page.getByText("What do you want to know today?", { exact: true });
  const composerAction = page.getByRole("button", { name: "Add files" });
  await expect(heading).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Ask AI Desk" })).toBeVisible();

  const [menuBox, headingBox, composerBox] = await Promise.all([
    menu.boundingBox(),
    heading.boundingBox(),
    composerAction.boundingBox(),
  ]);
  expect(menuBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(composerBox).not.toBeNull();
  expect(headingBox!.y).toBeGreaterThanOrEqual(menuBox!.y + menuBox!.height);

  const overlapWidth = Math.max(0, Math.min(menuBox!.x + menuBox!.width, composerBox!.x + composerBox!.width) - Math.max(menuBox!.x, composerBox!.x));
  const overlapHeight = Math.max(0, Math.min(menuBox!.y + menuBox!.height, composerBox!.y + composerBox!.height) - Math.max(menuBox!.y, composerBox!.y));
  expect(overlapWidth * overlapHeight).toBe(0);
});

test("enlarged landing text reflows without page-level horizontal overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile text-reflow regression");
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
