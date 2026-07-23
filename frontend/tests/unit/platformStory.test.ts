import test from "node:test";
import assert from "node:assert/strict";

import {
  PLATFORM_SPECIALISTS,
  PLATFORM_STORY_PHASES,
  clampPlatformStoryProgress,
  resolvePlatformStoryState,
} from "../../src/lib/platform-story.ts";

test("clamps platform story progress and resolves all phase boundaries", () => {
  assert.equal(clampPlatformStoryProgress(-1), 0);
  assert.equal(clampPlatformStoryProgress(2), 1);

  for (const [index, phase] of PLATFORM_STORY_PHASES.entries()) {
    const state = resolvePlatformStoryState(phase.start);
    assert.equal(state.phaseIndex, index);
    assert.equal(state.phaseId, phase.id);
    assert.equal(state.phaseProgress, 0);
  }

  assert.equal(resolvePlatformStoryState(1).phaseId, "synthesis");
  assert.equal(resolvePlatformStoryState(1).phaseProgress, 1);
});

test("advances specialists in the configured sequential runtime order", () => {
  const queued = resolvePlatformStoryState(0.1);
  assert.deepEqual(queued.specialistStatuses, PLATFORM_SPECIALISTS.map(() => "queued"));

  const first = resolvePlatformStoryState(0.12);
  assert.equal(first.activeSpecialistIndex, 0);
  assert.deepEqual(first.specialistStatuses, ["active", "queued", "queued", "queued", "queued"]);

  const third = resolvePlatformStoryState(0.37);
  assert.equal(third.activeSpecialistIndex, 2);
  assert.deepEqual(third.specialistStatuses, ["complete", "complete", "active", "queued", "queued"]);

  const complete = resolvePlatformStoryState(0.62);
  assert.equal(complete.activeSpecialistIndex, null);
  assert.deepEqual(complete.specialistStatuses, PLATFORM_SPECIALISTS.map(() => "complete"));
});

test("reverse progress restores the matching earlier specialist state", () => {
  const final = resolvePlatformStoryState(0.9);
  assert.equal(final.phaseId, "synthesis");

  const reversed = resolvePlatformStoryState(0.22);
  assert.equal(reversed.phaseId, "specialists");
  assert.equal(reversed.activeSpecialistIndex, 1);
  assert.deepEqual(reversed.specialistStatuses, ["complete", "active", "queued", "queued", "queued"]);
});
