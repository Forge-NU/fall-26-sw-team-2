import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  assertCanAttachLocation,
  deleteUnusedPinsOf,
} from './custom-locations';

// The locking and the trigger run against Postgres in
// test/custom-locations.e2e-spec.ts. These cover the decisions.

function makeTx() {
  const tx = {
    location: { findUnique: jest.fn(), deleteMany: jest.fn() },
    post: { findFirst: jest.fn().mockResolvedValue(null) },
    story: { findFirst: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn(),
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient };
}

describe('assertCanAttachLocation', () => {
  it('lets anyone use a Mapbox place, without locking it', async () => {
    const { tx, client } = makeTx();
    tx.location.findUnique.mockResolvedValue({ provider: 'mapbox' });

    await expect(
      assertCanAttachLocation(client, 'user_a', 'loc_1'),
    ).resolves.toBeUndefined();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.post.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a location that doesn't exist", async () => {
    const { tx, client } = makeTx();
    tx.location.findUnique.mockResolvedValue(null);

    await expect(
      assertCanAttachLocation(client, 'user_a', 'loc_1'),
    ).rejects.toThrow('Location not found');
  });

  it('locks a pin, then lets the user who dropped it use it once', async () => {
    const { tx, client } = makeTx();
    tx.location.findUnique.mockResolvedValue({ provider: 'custom' });
    tx.$queryRaw.mockResolvedValue([{ created_by: 'user_a' }]);

    await expect(
      assertCanAttachLocation(client, 'user_a', 'pin_1'),
    ).resolves.toBeUndefined();

    const [[strings]] = tx.$queryRaw.mock.calls as [[string[]]];
    expect(strings.join('?')).toContain('FOR UPDATE');
    expect(tx.post.findFirst).toHaveBeenCalledWith({
      where: { locationId: 'pin_1' },
      select: { id: true },
    });
    expect(tx.story.findFirst).toHaveBeenCalledWith({
      where: { locationId: 'pin_1' },
      select: { id: true },
    });
  });

  it("rejects someone else's pin", async () => {
    const { tx, client } = makeTx();
    tx.location.findUnique.mockResolvedValue({ provider: 'custom' });
    tx.$queryRaw.mockResolvedValue([{ created_by: 'user_a' }]);

    await expect(
      assertCanAttachLocation(client, 'user_b', 'pin_1'),
    ).rejects.toThrow('Only the person who dropped a pin can use it');
  });

  it('rejects a pin whose user was deleted', async () => {
    const { tx, client } = makeTx();
    tx.location.findUnique.mockResolvedValue({ provider: 'custom' });
    tx.$queryRaw.mockResolvedValue([{ created_by: null }]);

    await expect(
      assertCanAttachLocation(client, 'user_a', 'pin_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a pin deleted between the read and the lock', async () => {
    const { tx, client } = makeTx();
    tx.location.findUnique.mockResolvedValue({ provider: 'custom' });
    tx.$queryRaw.mockResolvedValue([]);

    await expect(
      assertCanAttachLocation(client, 'user_a', 'pin_1'),
    ).rejects.toThrow('Location not found');
  });

  it.each([
    ['post', 'post'],
    ['story', 'story'],
  ] as const)(
    'rejects a pin another %s already uses',
    async (_label, table) => {
      const { tx, client } = makeTx();
      tx.location.findUnique.mockResolvedValue({ provider: 'custom' });
      tx.$queryRaw.mockResolvedValue([{ created_by: 'user_a' }]);
      tx[table].findFirst.mockResolvedValue({ id: 'other' });

      await expect(
        assertCanAttachLocation(client, 'user_a', 'pin_1'),
      ).rejects.toThrow('This pin is already on another post or story');
    },
  );

  it('lets a post keep its own pin', async () => {
    const { tx, client } = makeTx();
    tx.location.findUnique.mockResolvedValue({ provider: 'custom' });
    tx.$queryRaw.mockResolvedValue([{ created_by: 'user_a' }]);

    await assertCanAttachLocation(client, 'user_a', 'pin_1', {
      postId: 'post_1',
    });

    expect(tx.post.findFirst).toHaveBeenCalledWith({
      where: { locationId: 'pin_1', id: { not: 'post_1' } },
      select: { id: true },
    });
  });
});

describe('deleteUnusedPinsOf', () => {
  it("deletes only the user's pins that nothing uses", async () => {
    const { tx, client } = makeTx();

    await deleteUnusedPinsOf(client, 'user_a');

    expect(tx.location.deleteMany).toHaveBeenCalledWith({
      where: {
        createdBy: 'user_a',
        provider: 'custom',
        posts: { none: {} },
        stories: { none: {} },
      },
    });
  });
});
