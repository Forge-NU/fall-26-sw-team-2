/** Small date helpers for ISO calendar dates (yyyy-mm-dd), all in local time. */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

export function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "13 Oct 2026" */
export function formatDay(iso: string) {
  const date = parseIsoDate(iso);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** "12–16 Oct 2026", or "28 Sep – 2 Oct 2026" across months. */
export function formatRange(startIso: string, endIso: string) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${formatDay(startIso).replace(` ${start.getFullYear()}`, '')} – ${formatDay(endIso)}`;
}

/** "October 2026" */
export function formatMonth(year: number, month: number) {
  return `${MONTHS_LONG[month]} ${year}`;
}

/** ISO strings compare correctly as plain strings. */
export function isWithin(iso: string, startIso: string, endIso: string) {
  return iso >= startIso && iso <= endIso;
}

/** 1-based day number of `iso` within a trip starting on `startIso`. */
export function tripDayNumber(iso: string, startIso: string) {
  const ms = parseIsoDate(iso).getTime() - parseIsoDate(startIso).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Monday-first weeks for a month; `null` pads days outside the month. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toIsoDate(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
