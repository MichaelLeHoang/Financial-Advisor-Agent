import test from "node:test";
import assert from "node:assert/strict";

import { resolveAppAppearance, resolveAppTheme } from "../../src/lib/app-theme.ts";

test("resolves color theme preferences and system mode", () => {
  assert.equal(resolveAppTheme("White", true), "White");
  assert.equal(resolveAppTheme("System", true), "Deep Space");
  assert.equal(resolveAppTheme("System", false), "White");
  assert.equal(resolveAppTheme("unknown", false), "Deep Space");
});

test("accepts the glass appearance and safely defaults unknown values", () => {
  assert.equal(resolveAppAppearance("Glass"), "Glass");
  assert.equal(resolveAppAppearance("Solid"), "Solid");
  assert.equal(resolveAppAppearance("gradient"), "Solid");
  assert.equal(resolveAppAppearance(null), "Solid");
});
