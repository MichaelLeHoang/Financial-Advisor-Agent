import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../../src/lib/api.ts";

const originalFetch = globalThis.fetch;

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  api.setAuthToken(null);
  api.invalidateReadCache();
});

test("deduplicates concurrent account reads and reuses the short-lived result", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return jsonResponse([]);
  }) as typeof fetch;
  api.setAuthToken("cache-test-user-a");

  const [first, second] = await Promise.all([api.portfolios(), api.portfolios()]);
  const third = await api.portfolios();

  assert.deepEqual(first, []);
  assert.deepEqual(second, []);
  assert.deepEqual(third, []);
  assert.equal(calls, 1);
});

test("invalidates account reads after writes and when auth identity changes", async () => {
  let portfolioReads = 0;
  globalThis.fetch = (async (input, init) => {
    const method = init?.method ?? "GET";
    if (method === "POST") {
      return jsonResponse({ id: "portfolio-new", name: "New", base_currency: "USD" });
    }
    if (String(input).endsWith("/api/v1/portfolios")) portfolioReads += 1;
    return jsonResponse([]);
  }) as typeof fetch;
  api.setAuthToken("cache-test-user-a");

  await api.portfolios();
  await api.createPortfolio("New");
  await api.portfolios();
  api.setAuthToken("cache-test-user-b");
  await api.portfolios();

  assert.equal(portfolioReads, 3);
});
