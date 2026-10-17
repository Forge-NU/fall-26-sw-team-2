import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateStoryDto } from './create-story.dto';

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateStoryDto, {
    s3Key: 'users/u/stories/a.jpg',
    ...body,
  });
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('CreateStoryDto', () => {
  it('accepts just a key', async () => {
    expect(await errorsFor({})).toEqual([]);
  });

  it('accepts every optional field', async () => {
    expect(
      await errorsFor({
        tripId: '11111111-1111-4111-8111-111111111111',
        keepOnTrip: true,
        text: 'Hello',
        customLocationName: 'Somewhere',
        date: '2026-10-17',
      }),
    ).toEqual([]);
  });

  it('requires a key', async () => {
    expect(await errorsFor({ s3Key: undefined })).toEqual(['s3Key']);
  });

  it('allows text up to 200 characters, counted like Postgres', async () => {
    expect(await errorsFor({ text: 'a'.repeat(200) })).toEqual([]);
    expect(await errorsFor({ text: 'a'.repeat(201) })).toEqual(['text']);
    // "❤️" is 2 characters in Postgres
    expect(await errorsFor({ text: '❤️'.repeat(101) })).toEqual(['text']);
  });

  it('rejects a blank custom location name', async () => {
    expect(await errorsFor({ customLocationName: '   ' })).toEqual([
      'customLocationName',
    ]);
  });

  it('rejects bad trip IDs, flags and dates', async () => {
    expect(
      await errorsFor({
        tripId: 'not-a-uuid',
        keepOnTrip: 'yes',
        date: '10/17/2026',
      }),
    ).toEqual(['tripId', 'keepOnTrip', 'date']);
  });
});
