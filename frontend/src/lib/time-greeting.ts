const NOON = 12;
const EVENING = 18;

export function greetingForDate(date: Date): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = date.getHours();
  if (hour < NOON) return "Good morning";
  if (hour < EVENING) return "Good afternoon";
  return "Good evening";
}

export function millisecondsUntilNextGreeting(date: Date): number {
  const nextBoundary = new Date(date);
  if (date.getHours() < NOON) nextBoundary.setHours(NOON, 0, 0, 0);
  else if (date.getHours() < EVENING) nextBoundary.setHours(EVENING, 0, 0, 0);
  else {
    nextBoundary.setDate(nextBoundary.getDate() + 1);
    nextBoundary.setHours(0, 0, 0, 0);
  }
  return Math.max(1_000, nextBoundary.getTime() - date.getTime());
}
