import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { FollowsService } from '../src/follows/follows.service';
import type { PrismaService } from '../src/prisma/prisma.service';

// Explicitly opt in with a migrated test database; never use DATABASE_URL here.
const url = process.env.FOLLOW_TEST_DATABASE_URL;
const describeDatabase = url ? describe : describe.skip;

describeDatabase('FollowsService with PostgreSQL', () => {
  const ids = Array.from({ length: 3 }, () => `follow_test_${randomUUID()}`);
  let prisma: PrismaClient;
  let service: FollowsService;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    service = new FollowsService(prisma as PrismaService);
    await prisma.user.createMany({
      data: ids.map((id) => ({
        id,
        username: id,
        email: `${id}@example.com`,
        firstName: 'Follow',
        lastName: 'Test',
      })),
    });
  });

  afterAll(async () => {
    if (prisma) {
      try {
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  beforeEach(async () => {
    await prisma.follow.deleteMany({
      where: { followerId: { in: ids } },
    });
  });

  it('paginates without duplicates after the previous cursor relationship is deleted', async () => {
    const [alice, bob, viewer] = ids;
    await service.follow(alice, bob);
    await service.follow(viewer, bob);
    const first = await service.getFollowList(viewer, bob, 'followers', {
      limit: 1,
    });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    await service.unfollow(first.items[0].id, bob);
    const second = await service.getFollowList(viewer, bob, 'followers', {
      limit: 1,
      cursor: first.nextCursor!,
    });
    expect(second.items).toHaveLength(1);
    expect(second.items[0].id).not.toBe(first.items[0].id);
    expect(second.nextCursor).toBeNull();
  });

  it('keeps one row under concurrent follow and updates both users counts', async () => {
    const [alice, bob, viewer] = ids;
    await expect(service.getCounts(bob)).resolves.toEqual({
      followerCount: 0,
      followingCount: 0,
    });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.follow(alice, bob)),
    );
    expect(results).toHaveLength(10);
    expect(
      await prisma.follow.count({
        where: { followerId: alice, followingId: bob },
      }),
    ).toBe(1);
    await expect(service.getCounts(bob)).resolves.toEqual({
      followerCount: 1,
      followingCount: 0,
    });
    await expect(service.getCounts(alice)).resolves.toEqual({
      followerCount: 0,
      followingCount: 1,
    });

    await service.follow(viewer, alice);
    const followers = await service.getFollowList(viewer, bob, 'followers', {
      limit: 1,
    });
    expect(followers.items).toEqual([
      expect.objectContaining({ id: alice, isFollowing: true }),
    ]);
    expect(followers.nextCursor).toBeNull();
    const following = await service.getFollowList(viewer, alice, 'following', {
      limit: 1,
    });
    expect(following.items).toEqual([
      expect.objectContaining({ id: bob, isFollowing: false }),
    ]);

    await service.unfollow(alice, bob);
    await service.unfollow(alice, bob);
    await expect(service.getCounts(bob)).resolves.toEqual({
      followerCount: 0,
      followingCount: 0,
    });
    await expect(service.getCounts(alice)).resolves.toEqual({
      followerCount: 1,
      followingCount: 0,
    });
    await expect(service.getFollowStatus(alice, bob)).resolves.toEqual({
      isFollowing: false,
    });
  });
});
