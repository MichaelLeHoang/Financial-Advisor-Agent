const DATE_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateValue(value: string): Date | null {
  const match = DATE_VALUE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 12);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

export function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfCalendarMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function addCalendarDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function shiftCalendarMonth(date: Date, amount: number): Date {
  const targetMonth = new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
  const finalDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 12).getDate();
  targetMonth.setDate(Math.min(date.getDate(), finalDay));
  return targetMonth;
}

export function buildCalendarMonth(date: Date): Date[] {
  const first = startOfCalendarMonth(date);
  const gridStart = addCalendarDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(gridStart, index));
}

export function isSameCalendarDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function clampCalendarDate(date: Date, min?: Date | null, max?: Date | null): Date {
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
}

export function moveCalendarDate(date: Date, key: string): Date | null {
  if (key === "ArrowLeft") return addCalendarDays(date, -1);
  if (key === "ArrowRight") return addCalendarDays(date, 1);
  if (key === "ArrowUp") return addCalendarDays(date, -7);
  if (key === "ArrowDown") return addCalendarDays(date, 7);
  if (key === "Home") return addCalendarDays(date, -date.getDay());
  if (key === "End") return addCalendarDays(date, 6 - date.getDay());
  if (key === "PageUp") return shiftCalendarMonth(date, -1);
  if (key === "PageDown") return shiftCalendarMonth(date, 1);
  return null;
}
