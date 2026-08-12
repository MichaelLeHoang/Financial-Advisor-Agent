import test from "node:test";
import assert from "node:assert/strict";
import {
  readSessionSnapshot,
  removeSessionSnapshot,
  sessionSnapshotKey,
  writeSessionSnapshot,
} from "../../src/lib/session-data-cache.ts";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

test("restores a fresh snapshot only for its exact owner", () => {
  const storage = new MemoryStorage();
  writeSessionSnapshot({ owner: "user:alpha", key: "portfolio", data: { total: 42 }, savedAt: 1_000, storage });

  const restored = readSessionSnapshot<{ total: number }>({ owner: "user:alpha", key: "portfolio", maxAgeMs: 5_000, now: 2_000, storage });
  const otherUser = readSessionSnapshot<{ total: number }>({ owner: "user:beta", key: "portfolio", maxAgeMs: 5_000, now: 2_000, storage });

  assert.deepEqual(restored?.data, { total: 42 });
  assert.equal(otherUser, null);
  assert.notEqual(sessionSnapshotKey("user:alpha", "portfolio"), sessionSnapshotKey("user:beta", "portfolio"));
});

test("drops expired, future-dated, and malformed snapshots", () => {
  const storage = new MemoryStorage();
  writeSessionSnapshot({ owner: "user:alpha", key: "expired", data: [1], savedAt: 1_000, storage });
  writeSessionSnapshot({ owner: "user:alpha", key: "future", data: [1], savedAt: 100_001, storage });
  storage.setItem(sessionSnapshotKey("user:alpha", "malformed"), "not-json");

  assert.equal(readSessionSnapshot({ owner: "user:alpha", key: "expired", maxAgeMs: 1_000, now: 3_000, storage }), null);
  assert.equal(readSessionSnapshot({ owner: "user:alpha", key: "future", maxAgeMs: 1_000, now: 3_000, storage }), null);
  assert.equal(readSessionSnapshot({ owner: "user:alpha", key: "malformed", maxAgeMs: 1_000, now: 3_000, storage }), null);
});

test("removes a selected snapshot without touching another key", () => {
  const storage = new MemoryStorage();
  writeSessionSnapshot({ owner: "user:alpha", key: "portfolio", data: 1, storage });
  writeSessionSnapshot({ owner: "user:alpha", key: "policy", data: 2, storage });

  removeSessionSnapshot("user:alpha", "portfolio", storage);

  assert.equal(readSessionSnapshot({ owner: "user:alpha", key: "portfolio", maxAgeMs: 1_000, storage }), null);
  assert.equal(readSessionSnapshot<number>({ owner: "user:alpha", key: "policy", maxAgeMs: 1_000, storage })?.data, 2);
});
