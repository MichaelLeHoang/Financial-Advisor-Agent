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

test("sends the per-request memory choice through direct and queued chat", async () => {
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return jsonResponse({ response: "ok", session_id: "s1", job_id: "job-1", status: "queued" });
  }) as typeof fetch;

  await api.chat("Review AMD", "s1", true, "sabi", undefined, false);
  await api.chatJob("Review AMD", "s1", true, "sabi", undefined, false);

  assert.equal(bodies[0].use_memory, false);
  assert.equal(bodies[1].use_memory, false);
});

test("uses owner-scoped memory endpoints for review and confirmation", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? "GET" });
    if ((init?.method ?? "GET") === "GET") {
      return jsonResponse({ memories: [], settings: { enabled: true } });
    }
    return jsonResponse({
      id: "memory-1",
      category: "risk_preference",
      label: "Conservative",
      value_json: { value: "Conservative" },
      status: "confirmed",
      confidence: 1,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    });
  }) as typeof fetch;

  await api.memories("candidate", "session-a");
  await api.confirmMemory("memory-1");

  assert.match(requests[0].url, /\/api\/v1\/agent\/memories\?status=candidate&session_id=session-a$/);
  assert.deepEqual(requests[1], {
    url: requests[1].url,
    method: "POST",
  });
  assert.match(requests[1].url, /\/api\/v1\/agent\/memories\/memory-1\/confirm$/);
});

