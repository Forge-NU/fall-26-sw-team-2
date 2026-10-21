import { BadRequestException } from '@nestjs/common';

// Local stand-in until API-1 (#28) provides the shared pagination helper.
type FollowListScope = {
  userId: string;
  direction: 'followers' | 'following';
};

export function decodeFollowCursor(
  cursor: string | undefined,
  scope: FollowListScope,
): string | undefined {
  if (cursor === undefined) return undefined;
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !('id' in decoded) ||
      typeof decoded.id !== 'string' ||
      !decoded.id ||
      !('userId' in decoded) ||
      decoded.userId !== scope.userId ||
      !('direction' in decoded) ||
      decoded.direction !== scope.direction
    ) {
      throw new Error('Invalid cursor');
    }
    return decoded.id;
  } catch {
    throw new BadRequestException('Invalid follow-list cursor');
  }
}

export function followPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  scope: FollowListScope,
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  return {
    items,
    nextCursor:
      rows.length > limit
        ? Buffer.from(
            JSON.stringify({ id: items[items.length - 1].id, ...scope }),
          ).toString('base64url')
        : null,
  };
}
