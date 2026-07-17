import { expect, test } from "@playwright/test";

const E2E_USER_ID = "00000000-0000-0000-0000-000000000099";

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

  await page.goto("/invest");
  await waitForWorkspace(page);
  const investNav = page.getByRole("navigation", { name: "Invest navigation" });
  await investNav.getByRole("link", { name: "Accounts" }).click();
  await expect(page).toHaveURL(/\/invest\/accounts$/);
  await expect(page.getByRole("heading", { name: "Investment Accounts" })).toBeVisible();
  await investNav.getByRole("link", { name: "Activity" }).click();
  await expect(page).toHaveURL(/\/invest\/activity$/);
  await expect(page.getByRole("heading", { name: "Investment Activity" })).toBeVisible();
});

test("desktop sidebar defaults collapsed and labels compact navigation on hover", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Compact desktop sidebar is hidden below the desktop breakpoint.");
  await page.goto("/invest");
  await waitForWorkspace(page);

  await expect(page.getByRole("button", { name: "Open sidebar" })).toBeVisible();
  const investLink = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Invest" });
  await investLink.hover();
  await expect(investLink.getByRole("tooltip")).toHaveText("Invest");
  await expect(investLink.getByRole("tooltip")).toBeVisible();

  await page.getByRole("button", { name: "Open sidebar" }).click();
  await expect(page.getByRole("button", { name: "Close sidebar" })).toBeVisible();
  const primaryAction = page.locator(".theme-accent-surface").filter({ hasText: "New chat" });
  await expect.poll(() => primaryAction.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, boxShadow: style.boxShadow };
  })).toEqual({ backgroundColor: "rgb(99, 102, 241)", backgroundImage: "none", boxShadow: "none" });
});

test("investment selectors stay anchored and expose their expanded state", async ({ page }) => {
  await page.goto("/invest");
  await waitForWorkspace(page);

  const trigger = page.getByRole("button", { name: "Investment portfolio scope" });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();

  const triggerBox = await trigger.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.y).toBeGreaterThanOrEqual(triggerBox!.y + triggerBox!.height - 2);
  expect(Math.abs(menuBox!.x - triggerBox!.x)).toBeLessThan(16);

  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  const chevron = page.getByTestId("investment-portfolio-scope-chevron");
  const reducedDuration = await chevron.evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(reducedDuration).toBeLessThan(0.001);
});

test("notification center exposes workspace activity and product updates", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The compact notification control is desktop navigation chrome.");
  await page.goto("/invest");
  await waitForWorkspace(page);

  const notificationsButton = page.getByRole("button", { name: "Notifications", exact: true }).first();
  await notificationsButton.hover();
  await expect(notificationsButton.getByRole("tooltip")).toBeVisible();
  await notificationsButton.click();

  const dialog = page.getByRole("dialog", { name: "Notification center" });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  const dialogHeight = await dialog.evaluate((element) => getComputedStyle(element).height);
  const dialogStyle = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, boxShadow: style.boxShadow };
  });
  expect(dialogStyle.backgroundColor).toBe("rgb(8, 9, 13)");
  expect(dialogStyle.backgroundImage).toBe("none");
  expect(dialogStyle.boxShadow).not.toContain("99, 102, 241");
  expect(dialogBox!.width).toBeLessThanOrEqual(430);
  expect(dialogBox!.height).toBeLessThanOrEqual(690);
  await expect(page.locator('[data-slot="dialog-backdrop"]')).toHaveCount(0);

  const feed = dialog.locator(".notification-feed");
  await feed.evaluate((element) => { element.scrollTop = 80; element.dispatchEvent(new Event("scroll")); });
  await expect(feed).toHaveAttribute("data-scrolling", "true");
  await expect(feed).toHaveAttribute("data-scrolling", "false", { timeout: 1_500 });

  await expect(dialog.getByRole("tab", { name: "Notifications" })).toHaveAttribute("aria-selected", "true");
  await dialog.getByRole("tab", { name: "What's new" }).click();
  await expect(dialog.getByRole("tab", { name: "What's new" })).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => dialog.evaluate((element) => getComputedStyle(element).height)).toBe(dialogHeight);
  await expect(dialog.getByRole("heading", { name: "Investment workspace, rebuilt" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Performance insights" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(notificationsButton).toBeFocused();
});

test("compact profile menu exposes system appearance, language, and real shortcuts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The compact profile menu is desktop navigation chrome.");
  await page.goto("/invest");
  await waitForWorkspace(page);

  const profileTrigger = page.getByRole("button", { name: "Open profile menu" });
  await profileTrigger.press("Enter");
  const profileMenu = page.locator('[data-slot="dropdown-menu-content"]');
  await expect(profileMenu).toBeVisible();
  const profileBox = await profileMenu.boundingBox();
  expect(profileBox).not.toBeNull();
  expect(profileBox!.width).toBeLessThanOrEqual(270);
  const profileStyle = await profileMenu.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundImage: style.backgroundImage, boxShadow: style.boxShadow };
  });
  expect(profileStyle.backgroundImage).toBe("none");
  expect(profileStyle.boxShadow).not.toContain("99, 102, 241");

  const plansItem = page.getByRole("menuitem", { name: "Plans & billing" });
  const iconSurface = plansItem.locator("svg").locator("..");
  expect(await iconSurface.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");

  const appearance = page.getByRole("menuitem", { name: "Appearance" });
  await appearance.hover();
  const appearanceMenu = page.getByRole("menu", { name: "Appearance" });
  await expect(appearanceMenu).toBeVisible();

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(profileMenu).toBeHidden();
  await profileTrigger.press("Enter");
  await expect(profileMenu).toBeVisible();
  const language = page.getByRole("menuitem", { name: "Language" });
  await language.hover();
  await expect(page.getByRole("menu", { name: "Language" }).getByRole("menuitem", { name: "English (US)" })).toBeVisible();

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(profileMenu).toBeHidden();
  await profileTrigger.press("Enter");
  await expect(profileMenu).toBeVisible();
  await page.getByRole("menuitem", { name: "Shortcuts" }).click();
  const shortcuts = page.getByRole("dialog", { name: "Shortcuts" });
  await expect(shortcuts).toBeVisible();
  await expect(shortcuts.getByText("Toggle portfolio privacy")).toBeVisible();
  const shortcutSwitch = shortcuts.getByRole("switch", { name: "Enable keyboard shortcuts" });
  await shortcutSwitch.click();
  await expect(shortcutSwitch).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Escape");
  await expect(shortcuts).toBeHidden();
  await page.keyboard.press("?");
  await expect(shortcuts).toBeHidden();

  await profileTrigger.press("Enter");
  await page.getByRole("menuitem", { name: "Appearance" }).hover();
  const systemTheme = page.getByRole("menu", { name: "Appearance" }).getByRole("menuitem", { name: "System" });
  await expect(systemTheme).toBeVisible();
  await systemTheme.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("financial-advisor.settings") || "{}").theme)).toBe("System");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("body")).toHaveAttribute("data-theme", "White");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveAttribute("data-theme", "Deep Space");
});

test("red theme keeps account controls transparent and primary actions flat red", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The compact account controls are desktop navigation chrome.");
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.settings", JSON.stringify({ theme: "Crimson" })));
  await page.goto("/invest");
  await waitForWorkspace(page);
  await expect(page.locator("body")).toHaveAttribute("data-theme", "Crimson");

  for (const control of [
    page.getByRole("button", { name: "Notifications", exact: true }).first(),
    page.getByRole("button", { name: "Open profile menu" }),
  ]) {
    expect(await control.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  }

  await page.getByRole("button", { name: "Open sidebar" }).click();
  const primaryAction = page.locator(".theme-accent-surface").filter({ hasText: "New chat" });
  await expect(primaryAction).toBeVisible();
  await expect.poll(() => primaryAction.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, boxShadow: style.boxShadow };
  })).toEqual({ backgroundColor: "rgb(239, 68, 68)", backgroundImage: "none", boxShadow: "none" });
});

test("central Portfolio keeps the selected position book across tabs and reloads", async ({ page }) => {
  await page.goto("/portfolio");
  await waitForWorkspace(page);

  const bookSwitch = page.getByRole("group", { name: "Portfolio book" });
  const investment = bookSwitch.getByRole("button", { name: /Investment Portfolio/ });
  const trading = bookSwitch.getByRole("button", { name: /Trade Portfolio/ });
  await expect(investment).toHaveAttribute("aria-pressed", "true");

  await trading.click();
  await expect(trading).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(({ userId }) => (
    window.localStorage.getItem(`quanfora.portfolio-book-view.user:${userId}`)
  ), { userId: E2E_USER_ID })).toBe("trading");

  await page.getByRole("navigation", { name: "Portfolio navigation" }).getByRole("link", { name: "Holdings" }).click();
  await expect(page).toHaveURL(/\/portfolio\/holdings$/);
  await expect(page.getByRole("group", { name: "Portfolio book" }).getByRole("button", { name: /Trade Portfolio/ })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await waitForWorkspace(page);
  await expect(page.getByRole("group", { name: "Portfolio book" }).getByRole("button", { name: /Trade Portfolio/ })).toHaveAttribute("aria-pressed", "true");
});

test("Invest Holdings owns the detailed Investment positions and manual recorder", async ({ page }) => {
  await page.goto("/invest/holdings");
  await waitForWorkspace(page);

  await expect(page.getByRole("heading", { name: "Investment Holdings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Record recurring purchase" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Price & record" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Portfolio book" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Invest navigation" }).getByRole("link", { name: "Holdings" })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("Investment Holdings toolbar filters, switches data sets, and opens account export", async ({ page }) => {
  await page.goto("/invest/holdings");
  await waitForWorkspace(page);

  const filterButton = page.getByRole("button", { name: "Filter holdings" });
  await filterButton.hover();
  await expect(page.getByRole("tooltip", { name: "Filter holdings" })).toBeVisible();
  await filterButton.click();
  await page.getByRole("menuitem", { name: "Needs thesis review" }).click();
  await page.getByRole("button", { name: "Group holdings" }).click();
  await page.getByRole("menuitem", { name: "Security" }).click();

  await page.getByRole("tab", { name: "Watchlist" }).click();
  await expect(page.getByRole("tab", { name: "Watchlist" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: /MU/ }).first()).toBeVisible();

  await page.getByRole("button", { name: "Download holdings" }).click();
  await expect(page.getByRole("dialog", { name: "Download holdings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeVisible();
  await page.keyboard.press("Escape");

  const addHolding = page.getByRole("button", { name: "Add investment holding" });
  await addHolding.hover();
  await expect(page.getByRole("tooltip", { name: "Add investment holding" })).toBeVisible();
  await addHolding.click();
  await expect(page.getByRole("dialog", { name: "Add investment holding" })).toBeVisible();
  await page.getByRole("button", { name: "Add holding" }).click();
  await expect(page.getByRole("alert")).toContainText("positive quantity");
  await page.keyboard.press("Escape");

  const privacyToggle = page.getByRole("button", { name: "Toggle portfolio privacy" });
  await privacyToggle.click();
  await expect(privacyToggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
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

test("auth callback preserves safe destinations and rejects encoded external paths", async ({ request }) => {
  const safeResponse = await request.get("/auth/callback?code=safe-code&next=%2Ftrade%3Fsymbol%3DAMD", { maxRedirects: 0 });
  expect(safeResponse.status()).toBe(307);
  const safeLocation = new URL(safeResponse.headers().location);
  expect(safeLocation.pathname).toBe("/login");
  expect(safeLocation.searchParams.get("next")).toBe("/trade?symbol=AMD");
  expect(safeLocation.searchParams.get("code")).toBe("safe-code");

  const unsafeResponse = await request.get("/auth/callback?code=unsafe-code&next=%252f%252fevil.example%252fcollect", { maxRedirects: 0 });
  expect(unsafeResponse.status()).toBe(307);
  const unsafeLocation = new URL(unsafeResponse.headers().location);
  expect(unsafeLocation.searchParams.get("next")).toBe("/home");
});

test("pending onboarding resumes once and restores the complete requested path", async ({ page }) => {
  await page.addInitScript(({ userId }) => {
    const storageKey = `quanfora.onboarding.user:${userId}`;
    if (window.localStorage.getItem(storageKey)) return;
    window.localStorage.setItem(storageKey, JSON.stringify({
      status: "pending",
      workspacePreference: "trading",
      currentStep: "preferences",
      investmentHorizon: "5-10-years",
      riskTolerance: "moderate",
      tradingHoldingPeriod: "swing",
      paperTradingOnly: true,
      completedAt: null,
      skippedAt: null,
      updatedAt: new Date().toISOString(),
    }));
  }, { userId: E2E_USER_ID });

  await page.goto("/trade?symbol=AMD");
  await waitForWorkspace(page);
  await expect(page).toHaveURL(/\/onboarding\?next=%2Ftrade%3Fsymbol%3DAMD$/);
  await expect(page.getByRole("heading", { name: "Set your starting guardrails" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/trade\?symbol=AMD$/);
  await expect(page.getByRole("heading", { name: "Paper Trading Desk" })).toBeVisible();

  await page.goto("/invest");
  await expect(page).toHaveURL(/\/invest$/);
  await expect(page.getByRole("heading", { name: "Investment Portfolio", exact: true })).toBeVisible();
});

test("new account onboarding preserves the Invest destination", async ({ page }) => {
  await page.goto("/onboarding?next=%2Finvest");
  await waitForWorkspace(page);
  await expect(page.getByRole("heading", { name: "How do you manage capital?" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: /Long-term investing/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Open Invest" }).click();
  await expect(page).toHaveURL(/\/invest$/);
  await expect(page.getByRole("heading", { name: "Investment Portfolio", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.keys(window.localStorage).some((key) => key.startsWith("quanfora.onboarding.user:")))).toBe(true);
  await page.goto("/trade");
  await expect(page).toHaveURL(/\/trade$/);
  await expect(page.getByRole("heading", { name: "Paper Trading Desk" })).toBeVisible();
});

test("investment review classifies a position and records a durable decision", async ({ page }) => {
  await page.goto("/invest");
  await waitForWorkspace(page);
  await expect(page.getByRole("heading", { name: "Investment Portfolio", exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Run review" }).click();
  const drawer = page.getByRole("dialog", { name: "NVDA position review" });
  await expect(drawer).toBeVisible();
  await page.getByRole("button", { name: "Classify as Investment" }).click();
  await expect(drawer.getByLabel("Thesis statement")).toBeVisible();
  await drawer.getByLabel("Thesis statement").fill("Accelerated computing demand supports durable earnings growth.");
  await page.getByRole("button", { name: "Save thesis" }).click();
  await drawer.getByLabel("Decision rationale").fill("Reduce concentration while preserving long-term ownership.");
  await drawer.getByRole("button", { name: "Trim", exact: true }).click();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("Trim decision recorded")).toBeVisible();
});

test("investment policy persists and validates recorded positions", async ({ page }) => {
  await page.goto("/invest/policy");
  await waitForWorkspace(page);

  await page.getByLabel("Maximum single-position weight").fill("12");
  await page.getByRole("button", { name: "Save and validate" }).click();

  await expect(page.getByText("1 breaches")).toBeVisible();
  await expect(page.getByText("MSFT exceeds the maximum position weight.")).toBeVisible();
  await page.getByRole("link", { name: "Back to Invest" }).click();
  await expect(page.getByRole("heading", { name: "Investment Portfolio", exact: true })).toBeVisible();
  await expect(page.getByText("MSFT exceeds the maximum position weight.")).toBeVisible();
});

test("Investment display state persists across workspace routes and the review drawer restores focus", async ({ page }) => {
  await page.goto("/invest");
  await waitForWorkspace(page);
  const performance = page.locator("#performance");
  const portfolioLegend = performance.getByText("Portfolio", { exact: true }).locator("..");
  const benchmarkLegend = performance.getByText("SPY", { exact: true }).locator("..");
  await expect(portfolioLegend.locator(".bg-emerald-400")).toHaveCount(1);
  await expect(benchmarkLegend.locator(".bg-slate-400")).toHaveCount(1);
  await performance.locator("canvas").first().hover({ position: { x: 280, y: 140 }, force: true });
  await expect(performance.locator('[role="tooltip"]')).toContainText("Portfolio");
  await expect(performance.locator('[role="tooltip"]')).toContainText("SPY");
  await page.getByRole("button", { name: "6M" }).click();
  await page.getByRole("button", { name: "returns" }).click();
  await expect.poll(() => page.evaluate(({ userId }) => window.localStorage.getItem(`quanfora.investment-overview.user:${userId}`), { userId: E2E_USER_ID })).toContain('"period":"6M"');

  await page.getByRole("navigation", { name: "Invest navigation" }).getByRole("link", { name: "Holdings" }).click();
  await page.getByRole("link", { name: "Investment overview" }).click();
  await expect(page.getByRole("button", { name: "6M" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "returns" })).toHaveAttribute("aria-pressed", "true");

  const trigger = page.getByRole("button", { name: "Run review" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "NVDA position review" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "NVDA position review" })).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("Investment privacy and rail sorting persist into Performance Insights", async ({ page }) => {
  await page.goto("/invest");
  await waitForWorkspace(page);

  const privacyToggle = page.getByRole("button", { name: "Toggle portfolio privacy" });
  await privacyToggle.click();
  await expect(privacyToggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(({ userId }) => (
    window.localStorage.getItem(`quanfora.investment-overview.user:${userId}`)
  ), { userId: E2E_USER_ID })).toContain('"privacyMode":true');

  await page.getByRole("button", { name: "Sort investment list: Value" }).click();
  await page.getByRole("menuitem", { name: "Today's return" }).click();
  await expect(page.getByRole("button", { name: "Sort investment list: 1D" })).toBeVisible();

  await page.getByRole("link", { name: /Performance insights/ }).click();
  await expect(page).toHaveURL(/\/invest\/performance$/);
  await expect(page.getByRole("heading", { name: "Performance insights" })).toBeVisible();
  const persistedPrivacyToggle = page.getByRole("button", { name: "Toggle portfolio privacy" });
  await expect(persistedPrivacyToggle).toHaveAttribute("aria-pressed", "true");
  await expect(persistedPrivacyToggle).toContainText("Show values");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("paper trade requires review and creates a simulated fill", async ({ page }) => {
  await page.goto("/trade");
  await waitForWorkspace(page);
  await expect(page.getByRole("heading", { name: "Paper Trading Desk" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Policy passed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Order type" })).toContainText("Limit");
  await expect(page.getByRole("button", { name: "Time in force" })).toContainText("Day");
  await page.getByRole("button", { name: "15m" }).click();
  await expect(page.getByRole("button", { name: "15m" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Signals", exact: true }).click();
  await expect(page.getByText(/Momentum setup active for AMD/)).toBeVisible();
  const reviewButton = page.getByRole("button", { name: "Review paper order" });
  await expect.poll(() => reviewButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, boxShadow: style.boxShadow };
  })).toEqual({ backgroundColor: "rgb(99, 102, 241)", backgroundImage: "none", boxShadow: "none" });
  await reviewButton.click();
  const review = page.getByRole("alertdialog", { name: "Buy 100 AMD" });
  await expect(review).toBeVisible();
  await expect(review.getByText("Limit · DAY")).toBeVisible();
  await page.getByRole("button", { name: "Submit paper order" }).click();
  await expect(page.getByRole("cell", { name: "AMD" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "limit · DAY · Paper", exact: true })).toBeVisible();
  await expect(page.getByText("Paper order submitted")).toBeVisible();
  await page.goto("/journal");
  await expect(page.getByText("AMD · Paper order filled")).toBeVisible();
});

test("consequential paper review traps focus, closes with Escape, and restores its trigger", async ({ page }) => {
  await page.goto("/trade");
  await waitForWorkspace(page);
  const trigger = page.getByRole("button", { name: "Review paper order" });
  await trigger.click();
  const dialog = page.getByRole("alertdialog", { name: "Buy 100 AMD" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to edit" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("paper workspace links watchlist selection to chart, plan, signals, and persistence", async ({ page }) => {
  await page.goto("/trade");
  await waitForWorkspace(page);
  await page.getByRole("option", { name: /NVDA/ }).click();
  await expect(page.getByText("Linked to NVDA")).toBeVisible();
  await expect(page.getByText("NVDA remains above the short-term trend")).toBeVisible();
  const chartWidget = page.locator("section").filter({ has: page.getByRole("heading", { name: "Price Chart" }) });
  await expect(chartWidget.getByText("NVDA", { exact: true })).toBeVisible();
  await page.reload();
  await waitForWorkspace(page);
  await expect(page.getByText("Linked to NVDA")).toBeVisible();
});

test("paper watchlist removes symbols safely and uses themed trade-plan menus", async ({ page }) => {
  await page.goto("/trade");
  await waitForWorkspace(page);
  await page.getByRole("option", { name: /NVDA/ }).click();
  await page.getByRole("button", { name: "Remove NVDA from watchlist" }).click();
  await expect(page.getByRole("option", { name: /NVDA/ })).toBeHidden();
  await expect(page.getByText("Linked to AMD")).toBeVisible();

  await page.getByRole("button", { name: "Order type" }).click();
  const orderTypeMenu = page.getByTestId("order-type-options-menu");
  await expect(orderTypeMenu).toBeVisible();
  await orderTypeMenu.getByRole("menuitem", { name: "Stop market" }).click();
  await expect(page.getByRole("button", { name: "Order type" })).toContainText("Stop market");

  await page.reload();
  await waitForWorkspace(page);
  await expect(page.getByRole("option", { name: /NVDA/ })).toBeHidden();
});

test("paper policy blocks invalid levels before review", async ({ page }) => {
  await page.goto("/trade");
  await waitForWorkspace(page);
  await page.getByRole("spinbutton", { name: "Stop" }).fill("175");
  await expect(page.locator("#stop-error")).toHaveText("Stop must be below entry for a long trade.");
  await expect(page.getByText("Policy blocked", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review paper order" })).toBeDisabled();
});

test("layout editing hides, restores, cancels, and saves widgets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Freeform layout editing is desktop-only.");
  await page.goto("/trade");
  await waitForWorkspace(page);
  await page.getByRole("button", { name: "Edit layout" }).click();
  await expect(page.getByRole("button", { name: "Save layout" })).toBeVisible();
  const signalsWidget = page.locator("section").filter({ has: page.getByRole("heading", { name: "Active Signals" }) });
  await signalsWidget.getByTitle("Hide widget").click();
  await expect(page.getByRole("heading", { name: "Active Signals" })).toBeHidden();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Active Signals" })).toBeVisible();

  await page.getByRole("button", { name: "Edit layout" }).click();
  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Active Signals" }) }).getByTitle("Hide widget").click();
  await page.getByRole("button", { name: "Add widget" }).click();
  const widgetMenu = page.getByTestId("add-widget-menu");
  await expect(widgetMenu).toBeVisible();
  await widgetMenu.getByRole("menuitem", { name: /Active Signals.*Restore/ }).click();
  await page.getByRole("button", { name: "Save layout" }).click();
  await page.reload();
  await waitForWorkspace(page);
  await expect(page.getByRole("heading", { name: "Active Signals" })).toBeVisible();
});

test("empty workspaces expose compact presets, navigation, and confirmed deletion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Workspace layout controls are desktop-only.");
  await page.goto("/trade");
  await waitForWorkspace(page);
  await page.getByRole("button", { name: "Workspace actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Duplicate current layout" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Duplicate current layout" }).click();
  await expect(page.getByRole("button", { name: /Paper Trading Desk copy/ })).toBeVisible();

  await page.getByRole("button", { name: /Paper Trading Desk copy/ }).click();
  const selector = page.getByRole("menu", { name: "Workspace selector" });
  await expect(selector.getByRole("menuitem", { name: /Paper Trading Desk copy/ })).toBeVisible();
  await selector.getByRole("button", { name: "New trading workspace" }).click();
  await expect(page.getByRole("heading", { name: "Start from a template", exact: true })).toBeVisible();
  await expect(page.getByText("Chart spotlight", { exact: true })).toBeVisible();
  await expect(page.getByText("Market monitoring", { exact: true })).toBeVisible();
  await expect(page.getByText("Options trading", { exact: true })).toBeVisible();
  await expect(page.getByText("Positions analysis", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByRole("button", { name: "Presets" }).click();
  const presets = page.getByTestId("workspace-presets-menu");
  await expect(presets).toBeVisible();
  await expect(presets.getByTestId("preset-preview")).toHaveCount(9);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Workspace actions" }).click();
  await page.getByRole("menuitem", { name: "Delete workspace" }).click();
  const warning = page.getByRole("alertdialog", { name: /Delete Untitled trading workspace/ });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Paper orders and journal records will not be deleted");
  await warning.getByRole("button", { name: "Delete workspace" }).click();
  await expect(page.getByRole("button", { name: "Paper Trading Desk" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start from a template", exact: true })).toBeHidden();
});

test("workspace library exposes professional templates and focused widgets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Workspace layout controls are desktop-only.");
  await page.goto("/trade");
  await waitForWorkspace(page);
  await page.getByRole("button", { name: "Workspace actions" }).click();
  await page.getByRole("menuitem", { name: "New empty workspace" }).click();

  await page.getByRole("button", { name: "Add widget" }).click();
  const widgets = page.getByTestId("add-widget-menu");
  for (const name of ["Price Chart", "Account", "Options Chain", "Watchlist", "Recent Orders", "Positions"]) await expect(widgets.getByRole("menuitem", { name: new RegExp(`^${name}`) })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Presets" }).click();
  const presets = page.getByTestId("workspace-presets-menu");
  for (const name of ["Stock trading", "Options trading", "Advanced options trading", "Chart spotlight", "Positions analysis", "Positions monitoring", "Watchlist monitoring", "Market monitoring"]) await expect(presets.getByText(name, { exact: true })).toBeVisible();
  await presets.getByRole("menuitem", { name: /^Options trading/ }).click();
  await expect(page.getByRole("button", { name: "Options Trading" })).toBeVisible();
  for (const name of ["Account", "Price Chart", "Options Chain", "Watchlist", "Positions", "Recent Orders"]) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("Illustrative chain", { exact: false })).toBeVisible();
});

test("desktop widget drag uses grid tracks and does not overlap the chart", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Freeform layout editing is desktop-only.");
  await page.goto("/trade");
  await waitForWorkspace(page);
  await page.getByRole("button", { name: "Edit layout" }).click();
  const signals = page.locator('[data-widget-type="active_signals"]');
  const canvas = page.locator("[data-workspace-canvas]");
  const before = await signals.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(before).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  const handle = signals.getByRole("button", { name: "Move Active Signals" });
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + 40, canvasBox!.y + canvasBox!.height - 24, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await signals.boundingBox())?.y ?? 0).toBeGreaterThan(before!.y + 100);
  const chart = await page.locator('[data-widget-type="price_chart"]').boundingBox();
  const moved = await signals.boundingBox();
  expect(chart).not.toBeNull(); expect(moved).not.toBeNull();
  expect(moved!.y >= chart!.y + chart!.height || moved!.x + moved!.width <= chart!.x || moved!.x >= chart!.x + chart!.width).toBe(true);
});

test("desktop resize snaps to rows and cannot cross another widget", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Freeform layout editing is desktop-only.");
  await page.goto("/trade");
  await waitForWorkspace(page);
  await page.getByRole("button", { name: "Edit layout" }).click();
  const policy = page.locator('[data-widget-type="policy_check"]');
  const handle = policy.getByRole("button", { name: "Resize Policy Check" });
  await handle.scrollIntoViewIfNeeded();
  const before = await policy.boundingBox();
  const handleBox = await handle.boundingBox();
  expect(before).not.toBeNull(); expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2 + 64, { steps: 6 });
  await expect.poll(async () => (await policy.boundingBox())?.height ?? 0).toBeGreaterThan(before!.height + 30);
  await page.mouse.up();
  await expect.poll(async () => (await policy.boundingBox())?.height ?? 0).toBeGreaterThan(before!.height + 30);
});

test("paper workspace uses functional chart tools and a stacked mobile layout", async ({ page }, testInfo) => {
  await page.goto("/trade");
  await waitForWorkspace(page);
  const chartWidget = page.locator('[data-widget-type="price_chart"]');
  const chartCanvas = chartWidget.locator("canvas").first();
  await chartCanvas.hover({ position: { x: 240, y: 160 }, force: true });
  await expect(chartWidget.getByText("AMD close", { exact: false })).toBeVisible();
  await expect(chartWidget.getByText(/SMA 20 \d/)).toBeVisible();
  await expect(chartWidget.getByText("Entry 170.00", { exact: true })).toBeVisible();
  await expect(chartWidget.getByText("Stop 164.00", { exact: true })).toBeVisible();
  await expect(chartWidget.getByText("Target 182.00", { exact: true })).toBeVisible();
  await expect(chartWidget.getByText(/Volume [\d,]+/)).toBeVisible();
  const indicators = page.getByRole("button", { name: "Indicators" });
  await expect(indicators).toHaveAttribute("aria-pressed", "true");
  if (testInfo.project.name === "mobile") await indicators.focus();
  else await indicators.hover();
  await expect(page.getByRole("tooltip", { name: "Indicators" })).toBeVisible();
  await indicators.click();
  await expect(indicators).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Chart type" }).click();
  await expect(page.getByRole("button", { name: "Measure range" })).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await expect(page.getByRole("button", { name: "Edit layout" })).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test("Strategy Studio validates changes, versions a draft, and records paper approval", async ({ page }) => {
  await page.goto("/trade/strategies");
  await waitForWorkspace(page);
  await page.getByRole("link", { name: /Daily Trend Discipline/ }).click();
  await expect(page.getByRole("heading", { name: "Visual Strategy Tree" })).toBeVisible();

  await page.getByRole("button", { name: "Remove Risk budget" }).click();
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByRole("tabpanel", { name: "validation" })).toContainText("Add a deterministic risk rule before validation.");
  await page.getByRole("button", { name: "Undo" }).click();

  const architectTab = page.getByRole("tab", { name: "architect" });
  if (await architectTab.isVisible()) await architectTab.click();
  await page.getByRole("button", { name: "Accept change" }).click();
  await page.getByRole("button", { name: "Save version" }).click();
  await page.getByRole("button", { name: "Paper deploy" }).click();
  await expect(page.getByRole("alertdialog", { name: /Deploy Daily Trend Discipline/ })).toBeVisible();
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

test("Strategy Studio keeps its editing surface within desktop and mobile viewports", async ({ page }) => {
  await page.goto("/trade/strategies/trading-starter");
  await waitForWorkspace(page);
  await expect(page.getByRole("heading", { name: "Visual Strategy Tree" })).toBeVisible();

  const panelTabs = page.getByRole("tablist", { name: "Studio panels" });
  if (!(await panelTabs.isVisible())) {
    await expect(page.getByRole("heading", { name: "Strategy Architect" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Backtest Preview" })).toBeVisible();
  } else {
    await page.getByRole("tab", { name: "preview" }).click();
    await expect(page.getByRole("heading", { name: "Backtest Preview" })).toBeVisible();
  }

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("custom Studio tabs support keyboard navigation", async ({ page }) => {
  await page.goto("/trade/strategies/trading-starter");
  await waitForWorkspace(page);

  if (await page.getByRole("tablist", { name: "Studio panels" }).isVisible()) {
    const treeTab = page.getByRole("tab", { name: "tree" });
    await treeTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "preview" })).toHaveAttribute("aria-selected", "true");
  }

  const overview = page.getByRole("tab", { name: "overview" });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "backtest" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "backtest" })).toContainText("Deterministic handoff");
});

test("light theme and reduced motion preserve the authenticated workspace", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.settings", JSON.stringify({ theme: "White" })));
  await page.goto("/home");
  await waitForWorkspace(page);
  await expect(page.locator("body")).toHaveAttribute("data-theme", "White");
  await expect(page.getByRole("heading", { name: "Good morning" })).toBeVisible();
  await expect.poll(() => page.locator("a").first().evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.00001);
});

test("Architect proposals can be dismissed without changing strategy rules", async ({ page }) => {
  await page.goto("/trade/strategies/trading-starter");
  await waitForWorkspace(page);
  const architectTab = page.getByRole("tab", { name: "architect" });
  if (await architectTab.isVisible()) await architectTab.click();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Proposal dismissed");
  await expect(page.getByText("Volatility guard", { exact: true })).toHaveCount(0);
});
