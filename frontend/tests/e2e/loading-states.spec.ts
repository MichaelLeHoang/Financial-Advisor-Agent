import { expect, test } from "@playwright/test";

test("AI Desk shows one reduced-motion-safe history skeleton before content", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("financial-advisor.coverSeen", "true"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/v1/agent/memories**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ memories: [], settings: { enabled: true } }),
    });
  });
  await page.route("**/api/v1/agent/sessions/loading-skeleton/messages", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 450));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session_id: "loading-skeleton",
        messages: [{ id: "answer-1", role: "assistant", content: "Market history is ready." }],
      }),
    });
  });

  await page.goto("/session/loading-skeleton");
  const status = page.getByRole("status").filter({ hasText: "Loading chat history…" });
  await expect(status).toBeVisible();
  await expect(status.locator(".data-skeleton").first()).toHaveCSS("animation-name", "none");
  await expect(page.getByText("Market history is ready.", { exact: true })).toBeVisible();
  await expect(status).toHaveCount(0);
});
