import type { StorageService } from '../storage/storage.service';
import { UPLOAD_FOLDERS } from '../media/media-limits';

// users.avatar_url holds either an S3 key from MEDIA-1 (users/{id}/avatars/
// {uuid}.jpg, set through PATCH /api/me) or the Clerk image URL a profile
// starts with. Responses always send a URL: keys are turned into a signed
// read URL, the same way post and story photos are.

const AVATAR_KEY = new RegExp(
  `^users/([^/]+)/${UPLOAD_FOLDERS.avatar}/[0-9a-f-]+\\.jpg$`,
);

/** Whether `key` is an avatar upload that belongs to `userId`. */
export function isOwnAvatarKey(key: string, userId: string): boolean {
  return AVATAR_KEY.exec(key)?.[1] === userId;
}

export async function resolveAvatarUrl(
  storage: StorageService,
  avatar: string | null,
): Promise<string | null> {
  if (!avatar) return null;
  return AVATAR_KEY.test(avatar) ? storage.getReadUrl(avatar) : avatar;
}
