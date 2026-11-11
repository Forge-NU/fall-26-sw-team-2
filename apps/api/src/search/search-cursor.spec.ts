import { BadRequestException } from '@nestjs/common';
import {
  buildSearchPage,
  decodeSearchCursor,
  encodeSearchCursor,
  searchScope,
} from './search-cursor';

describe('Search keyset cursor adapter', () => {
  const scope = searchScope(['viewer', 'posts', 'Lisbon']);
  const cursor = { scope, key: '0.333333', id: 'last-row' };
  it('preserves the exact sort key and row id', () => {
    expect(decodeSearchCursor(encodeSearchCursor(cursor), scope)).toEqual(
      cursor,
    );
  });
  it.each([
    'bad!',
    Buffer.from('{}').toString('base64url'),
    encodeSearchCursor({ ...cursor, key: 'NaN' }),
    encodeSearchCursor({ ...cursor, scope: 'other-list' }),
  ])('rejects malformed or out-of-scope cursors: %s', (value) => {
    expect(() => decodeSearchCursor(value, scope)).toThrow(BadRequestException);
  });
  it('only emits a cursor when the extra row exists', () => {
    expect(
      buildSearchPage([cursor], 1, ['item'], (row) => row).nextCursor,
    ).toBeNull();
    expect(
      buildSearchPage(
        [cursor, { ...cursor, id: 'next' }],
        1,
        ['item'],
        (row) => row,
      ).nextCursor,
    ).toBe(encodeSearchCursor(cursor));
  });
  it('binds cursors to the viewer, filters and sort', () => {
    expect(searchScope(['viewer', 'posts', 'Lisbon'])).not.toBe(
      searchScope(['another-viewer', 'posts', 'Lisbon']),
    );
  });
});
