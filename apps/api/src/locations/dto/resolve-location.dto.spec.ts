import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResolveLocationDto } from './resolve-location.dto';

// Same options as the global ValidationPipe in main.ts
async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(ResolveLocationDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((e) => e.property) };
}

const mapbox = {
  kind: 'mapbox',
  mapboxId: 'dXJuOm1ieHBvaTpwYXN0ZWlz',
  name: 'Pastéis de Belém',
  latitude: 38.697464,
  longitude: -9.203213,
};

describe('ResolveLocationDto', () => {
  it('accepts a Mapbox place with only the required fields', async () => {
    await expect(errorsFor(mapbox)).resolves.toMatchObject({ fields: [] });
  });

  it('accepts a Mapbox place with every field and uppercases countryCode', async () => {
    const { dto, fields } = await errorsFor({
      ...mapbox,
      address: 'R. de Belém 84-92, 1300-085 Lisboa',
      city: 'Lisbon',
      region: 'Lisbon',
      countryCode: 'pt',
    });

    expect(fields).toEqual([]);
    expect(dto.countryCode).toBe('PT');
  });

  it('accepts a custom location and trims its name', async () => {
    const { dto, fields } = await errorsFor({
      kind: 'custom',
      name: "  Tia Rosa's kitchen  ",
    });

    expect(fields).toEqual([]);
    expect(dto.name).toBe("Tia Rosa's kitchen");
  });

  it('rejects an unknown kind', async () => {
    const { fields } = await errorsFor({ kind: 'google', name: 'x' });
    expect(fields).toContain('kind');
  });

  it.each(['mapboxId', 'latitude', 'longitude'])(
    'rejects a Mapbox place without %s',
    async (field) => {
      const body: Record<string, unknown> = { ...mapbox };
      delete body[field];

      const { fields } = await errorsFor(body);
      expect(fields).toContain(field);
    },
  );

  it.each([
    ['latitude', 90.1],
    ['latitude', -90.1],
    ['longitude', 180.1],
    ['longitude', -180.1],
    ['latitude', '38.69'],
  ])('rejects %s = %p', async (field, value) => {
    const { fields } = await errorsFor({ ...mapbox, [field]: value });
    expect(fields).toContain(field);
  });

  it('rejects a countryCode that is not two letters', async () => {
    const { fields } = await errorsFor({ ...mapbox, countryCode: 'PRT' });
    expect(fields).toContain('countryCode');
  });

  it.each(['', '   '])('rejects an empty name (%p)', async (name) => {
    const { fields } = await errorsFor({ kind: 'custom', name });
    expect(fields).toContain('name');
  });

  it('rejects a custom name over 100 characters', async () => {
    const { fields } = await errorsFor({
      kind: 'custom',
      name: 'a'.repeat(101),
    });
    expect(fields).toContain('name');
  });

  it('accepts a custom name of exactly 100 characters', async () => {
    const { fields } = await errorsFor({
      kind: 'custom',
      name: 'a'.repeat(100),
    });
    expect(fields).toEqual([]);
  });

  // Postgres VARCHAR(100) counts code points; '❤️' is two (U+2764 U+FE0F)
  it('counts a custom name in code points, like Postgres', async () => {
    const hearts = await errorsFor({ kind: 'custom', name: '❤️'.repeat(60) });
    expect(hearts.fields).toContain('name');

    const emoji = await errorsFor({ kind: 'custom', name: '😀'.repeat(100) });
    expect(emoji.fields).toEqual([]);
  });

  it('allows a Mapbox name over 100 characters', async () => {
    const { fields } = await errorsFor({ ...mapbox, name: 'a'.repeat(101) });
    expect(fields).toEqual([]);
  });

  it.each([
    ['name', 257],
    ['mapboxId', 257],
    ['address', 513],
    ['city', 257],
    ['region', 257],
  ])('rejects %s over its length cap', async (field, length) => {
    const { fields } = await errorsFor({
      ...mapbox,
      [field]: 'a'.repeat(length),
    });
    expect(fields).toContain(field);
  });

  it('trims address, city and region and turns blank ones into null', async () => {
    const { dto, fields } = await errorsFor({
      ...mapbox,
      address: '',
      city: '  Lisbon  ',
      region: '   ',
    });

    expect(fields).toEqual([]);
    expect(dto.address).toBeNull();
    expect(dto.city).toBe('Lisbon');
    expect(dto.region).toBeNull();
  });

  it('rejects a blank Mapbox field sent with a custom location', async () => {
    const { fields } = await errorsFor({
      kind: 'custom',
      name: "Tia Rosa's kitchen",
      address: '',
    });
    expect(fields).toContain('kind');
  });

  it('rejects Mapbox fields sent with a custom location', async () => {
    const { fields } = await errorsFor({
      kind: 'custom',
      name: "Tia Rosa's kitchen",
      latitude: 38.7,
    });
    expect(fields).toContain('kind');
  });

  it('rejects unknown fields', async () => {
    const { fields } = await errorsFor({ ...mapbox, rating: 5 });
    expect(fields).toContain('rating');
  });
});
