// YYYY-MM-DD dates in the user's local time zone, and how we show them.
// Months are 1-12 everywhere in this file, same as in the date strings.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parts(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, month, day, weekday: new Date(year, month - 1, day).getDay() };
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Local midnight on that day
export function parseIsoDate(isoDate: string): Date {
  const { year, month, day } = parts(isoDate);
  return new Date(year, month - 1, day);
}

export function todayLocalIso(now = new Date()): string {
  return toIsoDate(now);
}

export function addDays(isoDate: string, days: number): string {
  const { year, month, day } = parts(isoDate);
  return toIsoDate(new Date(year, month - 1, day + days));
}

// Inclusive. YYYY-MM-DD strings compare fine as text.
export function isDateWithin(isoDate: string, startDate: string, endDate: string): boolean {
  return startDate <= isoDate && isoDate <= endDate;
}

// "Oct 3, 2026"
export function formatDate(isoDate: string): string {
  const { year, month, day } = parts(isoDate);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// "Sat, Oct 5"
export function formatWeekdayDate(isoDate: string): string {
  const { month, day, weekday } = parts(isoDate);
  return `${WEEKDAYS[weekday]}, ${MONTHS[month - 1]} ${day}`;
}

// "Oct 3, 2026", "Oct 3 – 6, 2026", "Sep 29 – Oct 2, 2026" or "Dec 30, 2026 – Jan 2, 2027"
export function formatDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatDate(startDate);
  const start = parts(startDate);
  const end = parts(endDate);
  if (start.year !== end.year) return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  const endText = start.month === end.month ? `${end.day}` : `${MONTHS[end.month - 1]} ${end.day}`;
  return `${MONTHS[start.month - 1]} ${start.day} – ${endText}, ${end.year}`;
}

// "Oct"
export function monthName(month: number): string {
  return MONTHS[month - 1];
}

// "October 2026"
export function formatMonth(year: number, month: number): string {
  return `${MONTHS_LONG[month - 1]} ${year}`;
}

// Inclusive, so a one-day trip has 1 day
export function tripDayCount(startDate: string, endDate: string): number {
  const start = parts(startDate);
  const end = parts(endDate);
  const ms = Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day);
  return Math.round(ms / 86_400_000) + 1;
}

// Day 1 is the start date
export function tripDayNumber(startDate: string, isoDate: string): number {
  return tripDayCount(startDate, isoDate);
}

export function tripDays(startDate: string, endDate: string): string[] {
  const count = tripDayCount(startDate, endDate);
  return Array.from({ length: Math.max(count, 0) }, (_, i) => addDays(startDate, i));
}

// Monday-first weeks for a month. `null` pads the days outside the month.
export function monthGrid(year: number, month: number): (string | null)[][] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${pad(month)}-${pad(day)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
