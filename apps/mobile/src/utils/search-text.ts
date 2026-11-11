/** Lowercase without accents, so "joao" finds "João" (used by the mock search) */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * True when `next` extends `previous` or trims it (typing or deleting at the
 * end of the same query). Search keeps showing the previous results only
 * then, so results for an unrelated earlier search never sit under a new one.
 */
export function isRefinement(previous: string | undefined, next: string): boolean {
  if (previous === undefined) return false;
  const a = normalizeSearchText(previous);
  const b = normalizeSearchText(next);
  return a.startsWith(b) || b.startsWith(a);
}
