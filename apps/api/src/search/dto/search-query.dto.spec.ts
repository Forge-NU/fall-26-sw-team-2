import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchQueryDto } from './search-query.dto';

function toDto(query: Record<string, unknown>) {
  return plainToInstance(SearchQueryDto, { type: 'people', ...query });
}

async function errorsFor(query: Record<string, unknown>) {
  const errors = await validate(toDto(query));
  return errors.map((e) => e.property);
}

describe('SearchQueryDto', () => {
  it('normalizes the query before validating it', async () => {
    expect(toDto({ q: '  maya   chen ' }).q).toBe('maya chen');
    expect(toDto({}).q).toBeUndefined();
    expect(await errorsFor({ q: ' '.repeat(5) + 'x'.repeat(96) })).toEqual([]);
  });

  it('allows up to 100 characters, counted in code points', async () => {
    expect(await errorsFor({ q: 'x'.repeat(100) })).toEqual([]);
    expect(await errorsFor({ q: 'x'.repeat(101) })).toEqual(['q']);
    // "❤️" is 2 code points
    expect(await errorsFor({ q: '❤️'.repeat(51) })).toEqual(['q']);
  });

  it('rejects a NUL character', async () => {
    expect(await errorsFor({ q: 'ab\u0000cd' })).toEqual(['q']);
  });
});
