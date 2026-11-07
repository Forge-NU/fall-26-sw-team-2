import { Prisma } from '../generated/prisma/client';

// SRCH-1's matching rules, extracted from Grace's implementation so all four
// result types share normalization, literal wildcard escaping and word matching.
export const MIN_QUERY_LENGTH = 2;
export function normalizeQuery(q: string | undefined): string {
  return (q ?? '').trim().replace(/\s+/g, ' ');
}
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}
export function filterWords(q: string): string[] {
  return [...new Set(q.split(' '))].filter(
    (word) => [...word].length >= MIN_QUERY_LENGTH,
  );
}
export function allWordsMatch(
  words: string[],
  columns: Prisma.Sql[],
): Prisma.Sql {
  if (!words.length) return Prisma.sql`FALSE`;
  return Prisma.join(
    words.map((word) => {
      const pattern = `%${escapeLike(word)}%`;
      return Prisma.sql`(${Prisma.join(
        columns.map((column) => Prisma.sql`${column} ILIKE ${pattern}`),
        ' OR ',
      )})`;
    }),
    ' AND ',
  );
}
