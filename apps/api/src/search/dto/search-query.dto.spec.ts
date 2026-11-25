import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { SearchQueryDto, assertSearchQuery } from './search-query.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const metadata: ArgumentMetadata = { type: 'query', metatype: SearchQueryDto };
async function parse(input: Record<string, unknown>) {
  const query = (await pipe.transform(input, metadata)) as SearchQueryDto;
  assertSearchQuery(query);
  return query;
}
describe('Search query validation', () => {
  it('trims text and converts numeric filters', async () => {
    await expect(
      parse({
        q: ' Lisbon ',
        lat: '38',
        lng: '-9',
        radiusKm: '10',
        minRating: '4.5',
      }),
    ).resolves.toMatchObject({
      q: 'Lisbon',
      lat: 38,
      lng: -9,
      radiusKm: 10,
      minRating: 4.5,
    });
  });
  it.each([
    {},
    { q: ['Lisbon'] },
    { q: 'Li', type: 'invalid' },
    { q: 'Li', radiusKm: '10' },
    { q: 'Li', lat: '38' },
    { q: 'Li', lat: '91', lng: '0' },
    { q: 'Li', from: '2026-02-30' },
    { q: 'Li', from: '2026-10-01', to: '2026-09-01' },
    { q: 'Li', minRating: '0' },
    { q: 'Li', minRating: '6' },
    { q: 'Li', minRating: '' },
    { q: 'Li', radiusKm: 'NaN' },
    { q: 'Li', lat: '', lng: '', radiusKm: '10' },
    { q: 'Li', lat: ' ', lng: '0' },
    { q: 'Li', radiusKm: '' },
    { q: 'Li', limit: '' },
    { q: 'Li', limit: '51' },
    { q: 'Li', cursor: 'abc' },
  ])('rejects invalid query %j', async (input) => {
    await expect(parse(input)).rejects.toThrow();
  });
  it('allows short text and one-sided date ranges', async () => {
    await expect(parse({ q: 'L', to: '2026-09-01' })).resolves.toMatchObject({
      q: 'L',
    });
  });
});
