import type { PrismaService } from '../../prisma/prisma.service';
import { RecentlyPublishedSource } from './recently-published.source';

describe('RecentlyPublishedSource', () => {
  it('returns the newest published trips as candidates', async () => {
    const publishedAt = new Date('2026-10-14T00:00:00Z');
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'trip-1',
        ownerId: 'user-1',
        publishedAt,
        createdAt: new Date('2026-10-01T00:00:00Z'),
      },
    ]);
    const source = new RecentlyPublishedSource({
      trip: { findMany },
    } as unknown as PrismaService);

    const candidates = await source.fetch(
      { viewerId: null, sessionId: 'session-1', now: publishedAt },
      50,
    );

    expect(candidates).toEqual([
      { tripId: 'trip-1', authorId: 'user-1', publishedAt },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published' },
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        take: 50,
      }),
    );
  });
});
