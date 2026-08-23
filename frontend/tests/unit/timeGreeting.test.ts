import assert from "node:assert/strict";
import test from "node:test";
import { greetingForDate, millisecondsUntilNextGreeting } from "../../src/lib/time-greeting.ts";

test("selects a greeting from the local hour", () => {
  assert.equal(greetingForDate(new Date(2026, 7, 12, 0, 0)), "Good morning");
  assert.equal(greetingForDate(new Date(2026, 7, 12, 11, 59)), "Good morning");
  assert.equal(greetingForDate(new Date(2026, 7, 12, 12, 0)), "Good afternoon");
  assert.equal(greetingForDate(new Date(2026, 7, 12, 17, 59)), "Good afternoon");
  assert.equal(greetingForDate(new Date(2026, 7, 12, 18, 0)), "Good evening");
  assert.equal(greetingForDate(new Date(2026, 7, 12, 23, 59)), "Good evening");
});

test("schedules the next greeting boundary", () => {
  assert.equal(millisecondsUntilNextGreeting(new Date(2026, 7, 12, 11, 59, 30)), 30_000);
  assert.equal(millisecondsUntilNextGreeting(new Date(2026, 7, 12, 17, 59, 30)), 30_000);
  assert.equal(millisecondsUntilNextGreeting(new Date(2026, 7, 12, 23, 59, 30)), 30_000);
});
