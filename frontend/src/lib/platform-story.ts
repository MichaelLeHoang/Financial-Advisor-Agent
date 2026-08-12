export const PLATFORM_STORY_PHASES = [
  { id: "route", label: "Route the question", start: 0, end: 0.12 },
  { id: "specialists", label: "Run five specialists", start: 0.12, end: 0.62 },
  { id: "consensus", label: "Calculate consensus", start: 0.62, end: 0.8 },
  { id: "synthesis", label: "Synthesize the answer", start: 0.8, end: 1 },
] as const;

export const PLATFORM_SPECIALISTS = [
  "Quant Researcher",
  "Quant Analyst",
  "Data Scientist",
  "Risk Analyst",
  "Portfolio Analytics",
] as const;

export type PlatformStoryPhaseId = (typeof PLATFORM_STORY_PHASES)[number]["id"];
export type SpecialistStatus = "queued" | "active" | "complete";

export interface PlatformStoryState {
  progress: number;
  phaseIndex: number;
  phaseId: PlatformStoryPhaseId;
  phaseProgress: number;
  activeSpecialistIndex: number | null;
  specialistStatuses: SpecialistStatus[];
}

export function clampPlatformStoryProgress(progress: number) {
  return Math.min(1, Math.max(0, progress));
}

export function resolvePlatformStoryState(progress: number): PlatformStoryState {
  const normalized = clampPlatformStoryProgress(progress);
  const phaseIndex = PLATFORM_STORY_PHASES.findIndex((phase) => normalized < phase.end);
  const resolvedPhaseIndex = phaseIndex === -1 ? PLATFORM_STORY_PHASES.length - 1 : phaseIndex;
  const phase = PLATFORM_STORY_PHASES[resolvedPhaseIndex];
  const phaseProgress = clampPlatformStoryProgress(
    (normalized - phase.start) / Math.max(phase.end - phase.start, Number.EPSILON),
  );

  let activeSpecialistIndex: number | null = null;
  let completedSpecialists = 0;

  if (normalized >= PLATFORM_STORY_PHASES[1].start) {
    const specialistProgress = clampPlatformStoryProgress(
      (normalized - PLATFORM_STORY_PHASES[1].start)
        / (PLATFORM_STORY_PHASES[1].end - PLATFORM_STORY_PHASES[1].start),
    );
    const specialistPosition = specialistProgress * PLATFORM_SPECIALISTS.length;
    completedSpecialists = Math.min(PLATFORM_SPECIALISTS.length, Math.floor(specialistPosition));
    if (completedSpecialists < PLATFORM_SPECIALISTS.length) {
      activeSpecialistIndex = completedSpecialists;
    }
  }

  const specialistStatuses = PLATFORM_SPECIALISTS.map<SpecialistStatus>((_, index) => {
    if (index < completedSpecialists) return "complete";
    if (index === activeSpecialistIndex) return "active";
    return "queued";
  });

  return {
    progress: normalized,
    phaseIndex: resolvedPhaseIndex,
    phaseId: phase.id,
    phaseProgress,
    activeSpecialistIndex,
    specialistStatuses,
  };
}
