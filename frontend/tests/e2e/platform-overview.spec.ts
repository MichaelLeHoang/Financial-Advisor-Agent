import { expect, test } from "@playwright/test";

test("desktop product navigation opens the platform overview", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop product menu");
  await page.goto("/");

  await page.getByRole("button", { name: "Product", exact: true }).click();
  const platformLink = page.getByRole("link", { name: /Platform overview/ }).first();
  await expect(platformLink).toHaveAttribute("href", "/platform");
  await platformLink.click();

  await expect(page).toHaveURL(/\/platform$/);
  await expect(page.getByRole("heading", { name: "Five perspectives. One decision you can audit." })).toBeVisible();
});

test("platform overview is public and exposes the accurate multi-agent story", async ({ page }) => {
  await page.goto("/platform");

  await expect(page.getByRole("heading", { name: "Five perspectives. One decision you can audit." })).toBeVisible();
  await expect(page.getByText("Sequential runtime").first()).toBeAttached();
  await expect(page.getByText("Illustrative product walkthrough").first()).toBeAttached();
  await expect(page.getByRole("link", { name: "Launch App" })).toHaveAttribute("href", "/home");
});

test("desktop scroll progress drives specialist, consensus, and synthesis phases", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop sticky-scroll behavior");
  await page.goto("/platform");

  const story = page.getByTestId("platform-multi-agent-story");
  const sticky = story.locator("div").first();
  await expect(story).toBeAttached();
  await expect(sticky).toHaveCSS("position", "sticky");

  await story.evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY;
    const travel = element.scrollHeight - window.innerHeight;
    window.scrollTo({ top: top + travel * 0.38 });
  });
  await expect(story.locator("[data-phase=\"specialists\"]")).toBeAttached();

  await story.evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY;
    const travel = element.scrollHeight - window.innerHeight;
    window.scrollTo({ top: top + travel * 0.7 });
  });
  await expect(story.locator("[data-phase=\"consensus\"]")).toBeAttached();

  await story.evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY;
    const travel = element.scrollHeight - window.innerHeight;
    window.scrollTo({ top: top + travel * 0.9 });
  });
  await expect(story.locator("[data-phase=\"synthesis\"]")).toBeAttached();
  await expect(story.getByText("Hold / Wait", { exact: true })).toBeAttached();
});

test("reduced motion renders every phase without a sticky scroll sequence", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Reduced-motion desktop fallback");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/platform");

  const story = page.getByTestId("platform-multi-agent-story");
  await expect(story.getByRole("heading", { name: "Route the question" })).toBeVisible();
  await expect(story.getByRole("heading", { name: "Run five specialists" })).toBeVisible();
  await expect(story.getByRole("heading", { name: "Calculate consensus" })).toBeVisible();
  await expect(story.getByRole("heading", { name: "Synthesize the answer" })).toBeVisible();
  await expect(story.locator("[data-phase=\"synthesis\"]")).toBeAttached();
  await expect(story).not.toHaveCSS("position", "sticky");
});

test("mobile uses the static story without horizontal overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile fallback");
  await page.goto("/platform");

  await expect(page.getByTestId("platform-multi-agent-story").getByRole("heading", { name: "Run five specialists" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
