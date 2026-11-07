import { escapeLike, filterWords, normalizeQuery } from './search-text';

describe('SRCH-1 matching rules reused by advanced search', () => {
  it('normalizes whitespace before matching and cursor scoping', () => {
    expect(normalizeQuery('  Maya\t Chen\n')).toBe('Maya Chen');
  });
  it('escapes wildcard and escape characters literally', () => {
    expect(escapeLike('100%_\\')).toBe('100\\%\\_\\\\');
  });
  it('deduplicates words and ignores single code points for filtering', () => {
    expect(filterWords('maya c maya')).toEqual(['maya']);
    expect(filterWords('a b')).toEqual([]);
    expect(filterWords('😀')).toEqual([]);
  });
});
