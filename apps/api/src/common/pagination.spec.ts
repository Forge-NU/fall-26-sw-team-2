import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PaginationQueryDto,
  buildPage,
  decodeCursor,
  encodeCursor,
  keyset,
  pageLimit,
} from './pagination';

type Row = { id: string; createdAt: Date; score: number };

const date = new Date('2026-10-12T09:30:00.123Z');

describe('pagination', () => {
  describe('cursors', () => {
    it('round-trips the sort key', () => {
      const cursor = encodeCursor('trips:user_1', [date, 4.5, 'id_1']);
      expect(
        decodeCursor(cursor, 'trips:user_1', ['date', 'number', 'string']),
      ).toEqual([date, 4.5, 'id_1']);
    });

    it('is URL-safe', () => {
      const cursor = encodeCursor('list', ['???>>>~~~', date]);
      expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('returns undefined for the first page', () => {
      expect(decodeCursor(undefined, 'list', ['string'])).toBeUndefined();
    });

    it('rejects a cursor from another list', () => {
      const cursor = encodeCursor('trips:user_1', ['id_1']);
      expect(() => decodeCursor(cursor, 'trips:user_2', ['string'])).toThrow(
        BadRequestException,
      );
    });

    it.each([
      ['not base64 JSON', 'garbage!'],
      ['empty', ''],
      ['a raw row id', '9b2f3c1e-1111-4222-8333-444455556666'],
      ['JSON that is not a cursor', Buffer.from('[1,2]').toString('base64url')],
      ['the wrong number of values', encodeCursor('list', ['a', 'b'])],
      ['a number where a string goes', encodeCursor('list', [1])],
      ['an empty id', encodeCursor('list', [''])],
    ])('rejects %s', (_, cursor) => {
      expect(() => decodeCursor(cursor, 'list', ['string'])).toThrow(
        'Invalid cursor',
      );
    });

    it('rejects a date that does not parse', () => {
      const cursor = encodeCursor('list', ['not a date']);
      expect(() => decodeCursor(cursor, 'list', ['date'])).toThrow(
        'Invalid cursor',
      );
    });
  });

  describe('buildPage', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    it('drops the extra row and returns a cursor for the last item', () => {
      expect(buildPage(rows, 2, (row) => `after:${row.id}`)).toEqual({
        items: [{ id: 'a' }, { id: 'b' }],
        nextCursor: 'after:b',
      });
    });

    it('returns no cursor on the last page', () => {
      expect(buildPage(rows, 3, (row) => row.id)).toEqual({
        items: rows,
        nextCursor: null,
      });
      expect(buildPage([], 3, (row: { id: string }) => row.id)).toEqual({
        items: [],
        nextCursor: null,
      });
    });
  });

  describe('keyset', () => {
    const list = keyset<Row, unknown, unknown>([
      { field: 'score', direction: 'desc', type: 'number' },
      { field: 'createdAt', direction: 'asc', type: 'date' },
      { field: 'id', direction: 'asc', type: 'string' },
    ]);

    it('orders by every field, in order', () => {
      expect(list.orderBy).toEqual([
        { score: 'desc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ]);
    });

    it('matches everything on the first page', () => {
      expect(list.after(undefined)).toEqual({});
    });

    it('matches rows after the key, with < for descending fields', () => {
      expect(list.after([4, date, 'b'])).toEqual({
        OR: [
          { score: { lt: 4 } },
          { score: 4, createdAt: { gt: date } },
          { score: 4, createdAt: date, id: { gt: 'b' } },
        ],
      });
    });

    it("encodes a row's sort key, which decode reads back", () => {
      const cursor = list.cursor('ratings', {
        id: 'b',
        createdAt: date,
        score: 4,
      });
      expect(list.decode(cursor, 'ratings')).toEqual([4, date, 'b']);
      expect(() => list.decode(cursor, 'other')).toThrow('Invalid cursor');
    });
  });

  describe('PaginationQueryDto', () => {
    it('defaults to 20 and converts numeric query strings', async () => {
      expect(pageLimit(plainToInstance(PaginationQueryDto, {}))).toBe(20);
      const query = plainToInstance(PaginationQueryDto, { limit: '50' });
      expect(pageLimit(query)).toBe(50);
      expect(await validate(query)).toEqual([]);
    });

    it.each(['0', '-1', '51', '1.5', 'abc', ''])(
      'rejects limit %s',
      async (limit) => {
        const query = plainToInstance(PaginationQueryDto, { limit });
        expect((await validate(query)).length).toBeGreaterThan(0);
      },
    );

    it('rejects a cursor longer than any real one', async () => {
      const query = plainToInstance(PaginationQueryDto, {
        cursor: 'a'.repeat(513),
      });
      expect((await validate(query)).length).toBeGreaterThan(0);
    });
  });
});
