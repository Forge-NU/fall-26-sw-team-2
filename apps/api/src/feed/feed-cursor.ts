import { BadRequestException } from '@nestjs/common';

// Opaque to clients. Encodes an offset into the ranked list.
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString('base64url');
}

export function decodeCursor(cursor: string): number {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    const offset = (parsed as { offset?: unknown } | null)?.offset;
    if (typeof offset === 'number' && Number.isInteger(offset) && offset >= 0) {
      return offset;
    }
  } catch {
    // fall through to the error below
  }
  throw new BadRequestException('Invalid feed cursor');
}
