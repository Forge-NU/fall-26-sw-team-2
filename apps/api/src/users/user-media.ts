import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

// Every S3 key that belongs to the user, for account deletion (DELETE /api/me
// and Clerk's user.deleted webhook). Uploads all live under users/{id}/, so
// listing that prefix also finds avatars and uploads that never made it into
// a post or story. The rows' keys are added in case any were stored elsewhere.
export async function findUserMediaKeys(
  prisma: PrismaService,
  storage: StorageService,
  userId: string,
): Promise<string[]> {
  const [media, stories, prefixKeys] = await Promise.all([
    prisma.postMedia.findMany({
      where: { post: { trip: { ownerId: userId } } },
      select: { s3Key: true },
    }),
    prisma.story.findMany({
      where: { ownerId: userId },
      select: { s3Key: true },
    }),
    storage.listKeys(`users/${userId}/`),
  ]);
  return [
    ...new Set([
      ...media.map((item) => item.s3Key),
      ...stories.map((story) => story.s3Key),
      ...prefixKeys,
    ]),
  ];
}
