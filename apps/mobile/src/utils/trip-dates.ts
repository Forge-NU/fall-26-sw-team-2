// Display helpers for YYYY-MM-DD trip and post dates
import { addDays } from '@/utils/local-date';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, month, day, weekday: new Date(year, month - 1, day).getDay() };
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

// "Oct 3 – 6, 2026", "Sep 29 – Oct 2, 2026" or "Dec 30, 2026 – Jan 2, 2027"
export function formatDateRange(startDate: string, endDate: string): string {
  const start = parts(startDate);
  const end = parts(endDate);
  if (start.year !== end.year) return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  const endText = start.month === end.month ? `${end.day}` : `${MONTHS[end.month - 1]} ${end.day}`;
  return `${MONTHS[start.month - 1]} ${start.day} – ${endText}, ${end.year}`;
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

export function monthName(month: number): string {
  return MONTHS[month - 1];
}
