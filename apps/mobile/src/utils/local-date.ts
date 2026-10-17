// Date-only strings (YYYY-MM-DD) in the user's local time zone. The API uses
// the user's local date for "today" in the active-trip rule.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocalIso(now = new Date()): string {
  return toIsoDate(now);
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return toIsoDate(new Date(year, month - 1, day + days));
}

// Inclusive. YYYY-MM-DD strings compare correctly as text.
export function isDateWithin(isoDate: string, startDate: string, endDate: string): boolean {
  return startDate <= isoDate && isoDate <= endDate;
}
