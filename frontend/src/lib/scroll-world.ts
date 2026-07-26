export interface ScrollWorldCta {
  primary: string;
  secondary?: string;
}

export interface ScrollWorldScene {
  id: string;
  label: string;
  accent: string;
  eyebrow: string;
  title: string;
  body: string;
  tags: string[];
  scroll: number;
  linger: number;
  still: string;
  stillMobile?: string;
  clip: string;
  clipMobile?: string;
  cta?: ScrollWorldCta;
}

export interface ScrollWorldConfig {
  scenes: ScrollWorldScene[];
  embedded: true;
  showTopbar: false;
}

export interface ScrollWorldController {
  destroy(): void;
}

export interface ScrollWorldSegment {
  index: number;
  start: number;
  end: number;
  weight: number;
}

export interface ScrollWorldState {
  sceneIndex: number;
  sceneProgress: number;
  journeyProgress: number;
}

export function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function lingerEase(progress: number, linger: number) {
  const x = clamp(progress);
  const amount = clamp(linger);
  const centered = x - 0.5;
  return (1 - amount) * x + amount * (4 * centered * centered * centered + 0.5);
}

export function buildScrollWorldSegments(scenes: Pick<ScrollWorldScene, "scroll">[]): ScrollWorldSegment[] {
  const total = scenes.reduce((sum, scene) => sum + Math.max(scene.scroll, 0.01), 0);
  let offset = 0;

  return scenes.map((scene, index) => {
    const weight = Math.max(scene.scroll, 0.01) / total;
    const segment = { index, start: offset, end: offset + weight, weight };
    offset += weight;
    return segment;
  });
}

export function resolveScrollWorldState(
  journeyProgress: number,
  scenes: Pick<ScrollWorldScene, "scroll" | "linger">[],
): ScrollWorldState {
  const progress = clamp(journeyProgress);
  const segments = buildScrollWorldSegments(scenes);
  const fallback = segments.at(-1) ?? { index: 0, start: 0, end: 1, weight: 1 };
  const segment = segments.find((candidate) => progress < candidate.end) ?? fallback;
  const linearProgress = clamp((progress - segment.start) / segment.weight);
  const scene = scenes[segment.index];

  return {
    sceneIndex: segment.index,
    sceneProgress: scene ? lingerEase(linearProgress, scene.linger) : linearProgress,
    journeyProgress: progress,
  };
}

export function getScrollWorldSceneTarget(
  sceneIndex: number,
  scenes: Pick<ScrollWorldScene, "scroll">[],
) {
  const segments = buildScrollWorldSegments(scenes);
  const segment = segments[clamp(Math.round(sceneIndex), 0, Math.max(segments.length - 1, 0))];
  return segment ? segment.start + segment.weight / 2 : 0;
}
