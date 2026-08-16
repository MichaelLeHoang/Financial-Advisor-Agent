export const SKELETON_APPEARANCE_DELAY_MS = 150;
export const SKELETON_MINIMUM_VISIBLE_MS = 180;

export function remainingSkeletonTime(
  visibleAt: number,
  now: number,
  minimumVisibleMs = SKELETON_MINIMUM_VISIBLE_MS,
) {
  return Math.max(0, minimumVisibleMs - Math.max(0, now - visibleAt));
}

export function isKeyedRequestPending(requestKey: string, settledRequestKey: string) {
  return Boolean(requestKey) && requestKey !== settledRequestKey;
}
