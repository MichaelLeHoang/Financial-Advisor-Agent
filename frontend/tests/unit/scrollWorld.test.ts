import test from "node:test";
import assert from "node:assert/strict";

import {
  buildScrollWorldSegments,
  getScrollWorldSceneTarget,
  lingerEase,
  resolveScrollWorldState,
} from "../../src/lib/scroll-world.ts";

const scenes = [
  { scroll: 1.2, linger: 0.35 },
  { scroll: 0.8, linger: 0 },
  { scroll: 1, linger: 0.2 },
];

test("normalizes weighted scenes into one continuous journey", () => {
  const segments = buildScrollWorldSegments(scenes);
  assert.equal(segments[0].start, 0);
  assert.equal(segments.at(-1)?.end, 1);
  assert.ok(segments[0].weight > segments[1].weight);
});

test("maps section-relative progress to the correct scene", () => {
  assert.equal(resolveScrollWorldState(0, scenes).sceneIndex, 0);
  assert.equal(resolveScrollWorldState(0.5, scenes).sceneIndex, 1);
  assert.equal(resolveScrollWorldState(1, scenes).sceneIndex, 2);
  assert.equal(resolveScrollWorldState(-1, scenes).journeyProgress, 0);
  assert.equal(resolveScrollWorldState(2, scenes).journeyProgress, 1);
});

test("keeps linger endpoints frame-safe while slowing the midpoint", () => {
  assert.equal(lingerEase(0, 0.5), 0);
  assert.equal(lingerEase(0.5, 0.5), 0.5);
  assert.equal(lingerEase(1, 0.5), 1);
  assert.ok(lingerEase(0.4, 0.5) > 0.4);
  assert.ok(lingerEase(0.6, 0.5) < 0.6);
});

test("returns the normalized center used by route controls", () => {
  const segments = buildScrollWorldSegments(scenes);
  assert.equal(getScrollWorldSceneTarget(1, scenes), segments[1].start + segments[1].weight / 2);
  assert.equal(getScrollWorldSceneTarget(99, scenes), segments[2].start + segments[2].weight / 2);
});
