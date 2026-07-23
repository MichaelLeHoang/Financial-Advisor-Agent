import { expect, test } from "@playwright/test";

test("desktop landing film scrubs one continuous video and navigates between scenes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop scroll-scrub behavior");
  await page.goto("/");

  const section = page.getByTestId("scroll-world-section");
  await expect(section).toBeAttached();
  await section.evaluate((element) => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY }));

  await expect(page.getByRole("heading", { name: "Start with the signal, not the noise." })).toBeVisible();
  const stickyPosition = await section.locator("div").first().evaluate((element) => getComputedStyle(element).position);
  expect(stickyPosition).toBe("sticky");
  const video = section.locator("video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute("src", /^blob:/);
  await expect(section.getByText("Quanfora decision architecture")).toHaveCount(0);
  const progressStyle = await section.getByTestId("scroll-world-progress").locator("span").evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundImage: style.backgroundImage, backgroundColor: style.backgroundColor };
  });
  expect(progressStyle.backgroundImage).toBe("none");
  expect(progressStyle.backgroundColor).toBe("rgb(119, 118, 201)");
  const eyebrowDecoration = await section.getByText("01 · Market intake").evaluate((element) => getComputedStyle(element, "::before").content);
  expect(eyebrowDecoration).toBe("none");

  const openingTime = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await page.getByRole("button", { name: /Go to Risk:/ }).click();
  await expect(page.getByRole("heading", { name: "Put risk before action." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Go to Risk:/ })).toHaveAttribute("aria-current", "step");
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(openingTime + 2);

  await page.getByRole("button", { name: /Go to Decision:/ }).click();
  await expect(section.getByRole("heading", { name: "Act with a record, not a hunch." })).toBeVisible();
  await expect(section.getByRole("button", { name: "Launch App" })).toBeVisible();
});

test("short desktop viewport keeps the documented-decision actions fully visible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop sticky layout regression");
  await page.setViewportSize({ width: 1062, height: 550 });
  await page.goto("/");

  const section = page.getByTestId("scroll-world-section");
  await expect(section).toBeAttached();
  await section.getByRole("button", { name: /Go to Decision:/ }).click();

  const launchButton = section.getByRole("button", { name: "Launch App" });
  const sampleLink = section.getByRole("link", { name: "View sample research" });
  await expect(launchButton).toBeVisible();
  await expect(sampleLink).toBeVisible();

  for (const control of [launchButton, sampleLink]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(550);
  }
});

test("reduced motion exposes the complete journey without loading video", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Hydration failed")) hydrationErrors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const section = page.getByTestId("scroll-world-section");
  await expect(section).toBeAttached();
  await expect(section.getByRole("heading", { name: "Start with the signal, not the noise." })).toBeAttached();
  await expect(section.getByRole("heading", { name: "Act with a record, not a hunch." })).toBeAttached();
  await expect(section.locator("video")).toHaveCount(0);
  expect(hydrationErrors).toEqual([]);
});

test("portrait mobile uses the frame-safe static journey instead of cropping the desktop film", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile static fallback");
  await page.goto("/");

  const section = page.getByTestId("scroll-world-section");
  await expect(section).toHaveAttribute("data-static-reason", "portrait-mobile");
  await expect(section.locator("video")).toHaveCount(0);
  await expect(section.getByAltText("An isometric miniature world representing Quanfora's research workflow")).toBeVisible();
  await expect(section.getByRole("heading", { name: "Start with the signal, not the noise." })).toBeAttached();
  await expect(section.getByRole("heading", { name: "Act with a record, not a hunch." })).toBeAttached();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
