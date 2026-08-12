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

test("attachment picker closes when focus moves elsewhere or Escape is pressed", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
  await page.goto("/session");

  const trigger = page.getByRole("button", { name: "Add files" });
  await trigger.click();
  await expect(page.getByRole("group", { name: "Attach files" })).toBeVisible();

  await page.getByRole("textbox").click();
  await expect(page.getByRole("group", { name: "Attach files" })).toHaveCount(0);

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("group", { name: "Attach files" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("recent conversations stay inside the viewport and scroll to the final thread", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The compact recent-conversations popover is desktop-only.");
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
  const sessions = Array.from({ length: 16 }, (_, index) => ({
    session_id: `recent-${index + 1}`,
    title: `Conversation ${index + 1}`,
    message_count: 2,
    last_active: new Date(Date.UTC(2026, 7, 8, 12, 0, 16 - index)).toISOString(),
  }));
  await page.route("**/api/v1/agent/sessions", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sessions) });
  });

  await page.goto("/session");
  await page.getByRole("button", { name: "Recents" }).click();
  const menu = page.getByRole("menu", { name: "Recent conversations" });
  await expect(page.getByText("Recent conversations", { exact: true })).toBeVisible();
  const finalThread = page.getByRole("link", { name: "Conversation 16" });
  await finalThread.scrollIntoViewIfNeeded();
  await expect(finalThread).toBeVisible();
  await expect.poll(() => menu.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  })).toBe(true);

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
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
  await page.route("**/api/v1/agent/chat/jobs/orb-job?after=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        job_id: "orb-job",
        session_id: "orb-session",
        status: "queued",
        queue_position: 2,
        progress_events: [],
        activity_events: [],
      }),
    });
  });
  await page.route("**/api/v1/agent/chat/jobs/orb-job/events?after=*", async (route) => {
    const after = new URL(route.request().url()).searchParams.get("after");
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: after === "0" ? [
        "id: 1",
        "event: analysis.planned",
        `data: ${JSON.stringify({
          run_id: "orb-job",
          sequence: 1,
          occurred_at: new Date(0).toISOString(),
          type: "analysis.planned",
          mode: "single",
          planned_steps: [
            { step_id: "single_scope", category: "system", label: "Understanding the request", order: 0 },
          ],
        })}`,
        "",
        "id: 2",
        "event: analysis.queued",
        `data: ${JSON.stringify({
          run_id: "orb-job",
          sequence: 2,
          occurred_at: new Date(0).toISOString(),
          type: "analysis.queued",
          mode: "single",
          label: "Queued for analysis",
          status: "pending",
          queue_position: 2,
        })}`,
        "",
        "",
      ].join("\n") : "",
    });
  });

  await page.goto("/session");
  await page.getByRole("textbox").fill("Explain dollar-cost averaging in two sentences.");
  await page.getByRole("button", { name: "Send message" }).click();

  const orb = page.getByTestId("ai-thinking-orb");
  await expect(orb).toBeVisible();
  await expect(page.getByText("Understanding the request", { exact: true })).toHaveCount(0);
  await expect(orb).toHaveAttribute("aria-label", "Analysis in progress");
  await expect(orb).toHaveCSS("width", "20px");
  await expect(orb).toHaveCSS("height", "20px");
});

test("AI desk uses a compact completed activity row and borderless assistant response", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
  await page.route("**/api/v1/agent/memories**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ memories: [], settings: { enabled: true } }),
    });
  });
  await page.route("**/api/v1/agent/sessions/activity-layout/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session_id: "activity-layout",
        messages: [
          { id: "user-activity", role: "user", content: "How about TSLA?" },
          {
            id: "assistant-activity",
            role: "assistant",
            content: "TSLA has mixed near-term signals, with elevated volatility and limited model conviction.",
            metadata: {
              overview: {
                title: "Tesla (TSLA)",
                verdict: "hold",
                summary: "TSLA has mixed near-term signals.",
                metrics: [],
                catalysts: [],
                risks: [],
                sources: [],
                next_questions: [
                  "What would make TSLA a clearer buy?",
                  "Compare TSLA against its closest peers.",
                ],
                disclaimer: "Educational analysis, not financial advice.",
              },
              activity_trace: {
                run_id: "activity-run",
                mode: "single",
                status: "completed",
                started_at: "2026-08-02T12:00:00.000Z",
                finished_at: "2026-08-02T12:00:35.000Z",
                steps: [
                  {
                    step_id: "risk",
                    category: "risk",
                    label: "Evaluated downside risk",
                    description: "Calculated drawdown, VaR, and volatility exposure.",
                    status: "complete",
                    duration_ms: 8_000,
                  },
                  {
                    step_id: "portfolio",
                    category: "portfolio",
                    label: "Comparing portfolio impact",
                    status: "pending",
                  },
                ],
                tools: [],
                sources: [],
              },
            },
          },
        ],
      }),
    });
  });

  await page.goto("/session/activity-layout");

  const response = page.getByTestId("assistant-response");
  await expect(response).toBeVisible();
  await expect(response).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.getByText("Worked for 35s", { exact: true })).toBeVisible();
  await expect(page.getByText("Comparing portfolio impact", { exact: true })).toHaveCount(0);

  await page.getByTestId("agent-activity-summary").click();
  const drawer = page.getByTestId("agent-activity-drawer");
  await expect.poll(() => drawer.evaluate((element) => element.getAnimations().length)).toBeGreaterThan(0);
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Activity", { exact: false }).first()).toBeVisible();
  await expect(drawer.getByText("1 of 1 steps · 0 tools · 0 sources", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Evaluated downside risk", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Calculated drawdown, VaR, and volatility exposure.", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Comparing portfolio impact", { exact: true })).toHaveCount(0);
  await expect(drawer.getByText("Memory", { exact: true })).toHaveCount(0);
  await expect(drawer).toHaveAttribute("data-slot", "sheet-content");

  await page.keyboard.press("Escape");
  await expect.poll(() => drawer.evaluate((element) =>
    element.getAnimations().some((animation) => animation.playState === "running")
  )).toBe(true);
  await expect(drawer).toBeHidden();

  const followUp = page.getByRole("button", { name: "What would make TSLA a clearer buy?" });
  await expect(followUp).toBeVisible();
  await followUp.click();
  await expect(page.getByRole("textbox")).toHaveValue("What would make TSLA a clearer buy?");
});
