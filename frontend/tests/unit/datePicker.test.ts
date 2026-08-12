import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCalendarMonth,
  clampCalendarDate,
  formatDateValue,
  moveCalendarDate,
  parseDateValue,
  shiftCalendarMonth,
} from "../../src/lib/date-picker.ts";

test("parses and formats date-only values without timezone conversion", () => {
  const date = parseDateValue("2026-07-28");
  assert.ok(date);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 6);
  assert.equal(date.getDate(), 28);
  assert.equal(formatDateValue(date), "2026-07-28");
  assert.equal(parseDateValue("2026-02-30"), null);
  assert.equal(parseDateValue("07/28/2026"), null);
});

test("builds a stable six-week calendar grid", () => {
  const days = buildCalendarMonth(new Date(2026, 6, 1, 12));
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 0);
  assert.equal(formatDateValue(days[0]), "2026-06-28");
  assert.equal(formatDateValue(days.at(-1)!), "2026-08-08");
});

test("moves calendar focus by day, week, boundary, and month", () => {
  const date = new Date(2026, 6, 28, 12);
  assert.equal(formatDateValue(moveCalendarDate(date, "ArrowLeft")!), "2026-07-27");
  assert.equal(formatDateValue(moveCalendarDate(date, "ArrowDown")!), "2026-08-04");
  assert.equal(formatDateValue(moveCalendarDate(date, "Home")!), "2026-07-26");
  assert.equal(formatDateValue(moveCalendarDate(date, "End")!), "2026-08-01");
  assert.equal(formatDateValue(moveCalendarDate(date, "PageUp")!), "2026-06-28");
  assert.equal(moveCalendarDate(date, "Enter"), null);
});

test("clamps dates and preserves valid month-end dates", () => {
  const january31 = new Date(2026, 0, 31, 12);
  assert.equal(formatDateValue(shiftCalendarMonth(january31, 1)), "2026-02-28");
  const min = new Date(2026, 2, 1, 12);
  const max = new Date(2026, 8, 30, 12);
  assert.equal(clampCalendarDate(january31, min, max), min);
  assert.equal(clampCalendarDate(new Date(2027, 0, 1, 12), min, max), max);
});
