/**
 * Cursor-based pagination helper
 *
 * Encodes/decodes cursors and provides Prisma query helpers
 */

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Encodes a cursor value to a base64 string
 */
export function encodeCursor(value: string | number): string {
  return Buffer.from(String(value)).toString('base64');
}

/**
 * Decodes a cursor string to its original value
 */
export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf-8');
}

/**
 * Builds a paginated response from query results
 */
export function buildPaginatedResponse<T>(
  items: T[],
  hasMore: boolean,
  cursorExtractor: (item: T) => string | number,
): PaginatedResult<T> {
  const nextCursor = hasMore && items.length > 0
    ? encodeCursor(cursorExtractor(items[items.length - 1]))
    : null;

  return {
    items,
    nextCursor,
  };
}
