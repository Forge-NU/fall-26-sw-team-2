import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

// Dropped pins (#94 LOC-2): locations rows with provider = 'custom'. Each one
// belongs to the user who dropped it and to the one post or story that uses
// it. The delete_unused_custom_location trigger (migration
// 20261112120000_custom_location_pins) deletes a pin once its post or story
// stops using it, so nothing here deletes an attached pin.

export const CUSTOM_PROVIDER = 'custom';

// How long a pin nobody attached is kept, so a composer left open (or a post
// draft waiting on uploads) can still use it. The cleanup job deletes older ones.
export const UNUSED_PIN_LIFETIME_HOURS = 24;

// Checks that `userId` can put `locationId` on a post or story. A Mapbox place
// is shared, so anyone can. A pin only by the user who dropped it, and only
// while no other post or story uses it. `using` is the post or story being
// edited, which can keep its own pin.
//
// Call it inside the transaction that writes the post or story. A pin is
// locked FOR UPDATE, so two requests attaching the same pin run one at a time
// and the second sees the first's post. Mapbox places aren't locked, since
// popular places would serialize every post there.
export async function assertCanAttachLocation(
  tx: Prisma.TransactionClient,
  userId: string,
  locationId: string,
  using: { postId?: string; storyId?: string } = {},
): Promise<void> {
  const location = await tx.location.findUnique({
    where: { id: locationId },
    select: { provider: true },
  });
  if (!location) {
    throw new BadRequestException('Location not found');
  }
  if (location.provider !== CUSTOM_PROVIDER) return;

  const [pin] = await tx.$queryRaw<{ created_by: string | null }[]>`
    SELECT created_by FROM locations WHERE id = ${locationId}::uuid FOR UPDATE`;
  // Deleted since the read above (its post went, or the cleanup job ran)
  if (!pin) {
    throw new BadRequestException('Location not found');
  }
  if (pin.created_by !== userId) {
    throw new BadRequestException(
      'Only the person who dropped a pin can use it',
    );
  }

  const [post, story] = await Promise.all([
    tx.post.findFirst({
      where: {
        locationId,
        ...(using.postId && { id: { not: using.postId } }),
      },
      select: { id: true },
    }),
    tx.story.findFirst({
      where: {
        locationId,
        ...(using.storyId && { id: { not: using.storyId } }),
      },
      select: { id: true },
    }),
  ]);
  if (post || story) {
    throw new BadRequestException(
      'This pin is already on another post or story. Drop a new one.',
    );
  }
}

// The user's pins that no post or story uses, for account deletion. Their
// attached pins go with their posts and stories (the trigger), and these
// would otherwise wait for the cleanup job with created_by set to NULL.
export async function deleteUnusedPinsOf(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.location.deleteMany({
    where: {
      createdBy: userId,
      provider: CUSTOM_PROVIDER,
      posts: { none: {} },
      stories: { none: {} },
    },
  });
}
