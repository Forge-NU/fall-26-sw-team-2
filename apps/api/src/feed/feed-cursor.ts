import { BadRequestException } from '@nestjs/common';

// Opaque to clients. Carries the feed session so the next page can skip what this
// session has already been served.
export function encodeCursor(sessionId: string): string {
  return Buffer.from(JSON.stringify({ sessionId })).toString('base64url');
}

export function decodeCursor(cursor: string): string {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    const sessionId = (parsed as { sessionId?: unknown } | null)?.sessionId;
    if (
      typeof sessionId === 'string' &&
      sessionId.length > 0 &&
      sessionId.length <= 64
    ) {
      return sessionId;
    }
  } catch {
    // fall through to the error below
  }
  throw new BadRequestException('Invalid feed cursor');
}
