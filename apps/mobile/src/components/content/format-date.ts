export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  if (start.slice(0, 7) === end.slice(0, 7)) {
    const month = new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${start}T00:00:00Z`));
    return `${month} ${Number(start.slice(8))}–${Number(end.slice(8))}, ${start.slice(0, 4)}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}
