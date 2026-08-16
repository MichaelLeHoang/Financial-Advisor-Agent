import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isKeyedRequestPending,
  remainingSkeletonTime,
  SKELETON_APPEARANCE_DELAY_MS,
  SKELETON_MINIMUM_VISIBLE_MS,
} from "../../src/lib/loading-state.ts";

test("keeps keyed data pending until the current request settles", () => {
  assert.equal(isKeyedRequestPending("", ""), false);
  assert.equal(isKeyedRequestPending("MU,SNDK", ""), true);
  assert.equal(isKeyedRequestPending("MU,SNDK", "MU,SNDK"), false);
  assert.equal(isKeyedRequestPending("MU,NVDA,SNDK", "MU,SNDK"), true);
});

test("uses a short delayed appearance and stable minimum skeleton duration", () => {
  assert.equal(SKELETON_APPEARANCE_DELAY_MS, 150);
  assert.equal(SKELETON_MINIMUM_VISIBLE_MS, 180);
  assert.equal(remainingSkeletonTime(1_000, 1_040), 140);
  assert.equal(remainingSkeletonTime(1_000, 1_180), 0);
  assert.equal(remainingSkeletonTime(1_000, 900), 180);
});

test("loading regions announce once while visual bones remain decorative", () => {
  const source = readFileSync(new URL("../../src/components/ui/DataLoading.tsx", import.meta.url), "utf8");
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /aria-hidden="true"/);
});

test("skeleton motion has a static reduced-motion fallback", () => {
  const source = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /\.data-skeleton\s*\{[\s\S]*?animation:\s*none/);
  assert.doesNotMatch(source, /\.data-loading-region\s*\{[^}]*transition:\s*all/);
});
