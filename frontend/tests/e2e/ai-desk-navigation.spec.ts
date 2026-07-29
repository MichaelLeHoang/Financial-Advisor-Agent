import { expect, test, type Page } from "@playwright/test";

const PROMPTS = [
  "Give me the market context for this portfolio.",
  "Which holdings contribute the most risk?",
  "How does the valuation compare with peers?",
  "What catalysts should I monitor next?",
  "Turn this into a disciplined action plan.",
];

function chatMessages(promptCount: number) {
  return PROMPTS.slice(0, promptCount).flatMap((prompt, index) => [
    { id: `user-${index + 1}`, role: "user", content: prompt },
    {
      id: `assistant-${index + 1}`,
      role: "assistant",
      content: `Response ${index + 1}. ${"Evidence, assumptions, risks, and next actions are documented here. ".repeat(28)}`,
    },
  ]);
}

async function mockConversation(page: Page, sessionId: string, promptCount: number) {
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
  await page.route("**/api/v1/agent/memories**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ memories: [], settings: { enabled: true } }),
    });
  });
  await page.route(`**/api/v1/agent/sessions/${sessionId}/messages`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session_id: sessionId, messages: chatMessages(promptCount) }),
    });
  });
}

test("prompt navigator stays hidden until the fifth user prompt", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The reference prompt rail is desktop-only.");
  await mockConversation(page, "four-prompts", 4);
  await page.goto("/session/four-prompts");

  await expect(page.getByText(PROMPTS[3], { exact: true })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Prompt navigation" })).toHaveCount(0);
});

test("prompt navigator expands and scrolls to the selected prompt", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The reference prompt rail is desktop-only.");
  await mockConversation(page, "five-prompts", 5);
  await page.goto("/session/five-prompts");

  const navigator = page.getByRole("complementary", { name: "Prompt navigation" });
  const trigger = navigator.getByRole("button", { name: "Open prompt navigator" });
  const scroller = page.getByTestId("chat-scroll-container");
  await expect(trigger).toBeVisible();

  const initialScrollTop = await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(initialScrollTop).toBeGreaterThan(0);

  await trigger.hover();
  const menu = page.getByRole("navigation", { name: "Conversation prompts" });
  await expect(menu).toBeVisible();
  const secondPrompt = menu.getByRole("button", { name: `Prompt 2: ${PROMPTS[1]}` });
  await secondPrompt.click();
  await expect(secondPrompt).toHaveAttribute("aria-current", "location");

  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeLessThan(initialScrollTop);
  await expect.poll(async () => {
    const [containerBox, promptBox] = await Promise.all([
      scroller.boundingBox(),
      page.locator('[data-chat-prompt="user-2"]').boundingBox(),
    ]);
    return containerBox && promptBox ? Math.abs(promptBox.y - containerBox.y - 24) : Number.POSITIVE_INFINITY;
  }).toBeLessThan(4);

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("prompt navigation removes movement for reduced-motion users", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The reference prompt rail is desktop-only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockConversation(page, "reduced-prompts", 5);
  await page.goto("/session/reduced-prompts");

  const trigger = page.getByRole("button", { name: "Open prompt navigator" });
  await trigger.focus();
  const menu = page.getByRole("navigation", { name: "Conversation prompts" });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS("opacity", "1");
  await expect(menu).toHaveCSS("transform", "none");
});

test("AI desk shows a thinking orb while an analysis is queued", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
  await page.route("**/api/v1/agent/chat/jobs", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ job_id: "orb-job", session_id: "orb-session", status: "queued" }),
    });
  });
  await page.route("**/api/v1/agent/chat/jobs/orb-job", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        job_id: "orb-job",
        session_id: "orb-session",
        status: "queued",
        queue_position: 2,
        progress_events: [],
      }),
    });
  });

  await page.goto("/session");
  await page.getByRole("textbox").fill("Explain dollar-cost averaging in two sentences.");
  await page.getByRole("button", { name: "Send message" }).click();

  const orb = page.getByTestId("ai-thinking-orb");
  await expect(orb).toBeVisible();
  await expect(orb).toHaveAttribute("aria-label", "Waiting to begin analysis");
  await expect(orb).toHaveCSS("width", "20px");
  await expect(orb).toHaveCSS("height", "20px");
});
