// Uploads a post draft's photos, then creates the post. The draft is saved
// after every step, so a failure (or the app closing) never loses work and a
// retry skips photos that already uploaded.
import { ApiError } from '@/api/client';
import { createPost } from '@/api/posts';
import type { PostResponse } from '@/api/types';
import { createUpload, putObject } from '@/api/uploads';
import { toLocationFields } from '@/components/location/location-picker';
import { deleteDraft, saveDraft, type PostDraft } from '@/lib/post-drafts';
import { isRetryableError, RETRY_DELAYS_MS, sleep } from '@/lib/retry';

export type UploadProgress = { uploaded: number; total: number; creating: boolean };

export type SubmitResult =
  | { status: 'created'; post: PostResponse }
  | { status: 'failed'; draft: PostDraft };

// One quick retry per photo in the composer. Anything longer and the user is
// better off with the draft + Retry banner.
const PHOTO_RETRY_DELAYS_MS = RETRY_DELAYS_MS.slice(0, 1);

// Drafts being uploaded right now, in this app session. A draft saved as
// 'uploading' that isn't in here was interrupted (app closed) and can be retried.
const inFlight = new Set<string>();

export function isDraftInFlight(id: string): boolean {
  return inFlight.has(id);
}

async function uploadPhoto(uri: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const { uploadUrl, s3Key } = await createUpload('post');
      await putObject(uploadUrl, uri);
      return s3Key;
    } catch (error) {
      const delay = PHOTO_RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isRetryableError(error)) throw error;
      await sleep(delay);
    }
  }
}

export async function submitPostDraft(
  input: PostDraft,
  onProgress: (progress: UploadProgress) => void,
): Promise<SubmitResult> {
  if (inFlight.has(input.id)) throw new Error('This draft is already uploading');
  inFlight.add(input.id);

  let draft: PostDraft = { ...input, photos: input.photos.map((p) => ({ ...p })), status: 'uploading', error: null };
  const total = draft.photos.length;
  const countUploaded = () => draft.photos.filter((p) => p.s3Key).length;

  try {
    await saveDraft(draft);
    onProgress({ uploaded: countUploaded(), total, creating: false });

    for (const photo of draft.photos) {
      if (photo.s3Key) continue;
      try {
        photo.s3Key = await uploadPhoto(photo.uri);
        await saveDraft(draft);
      } catch {
        // Keep going, so one bad photo doesn't stop the rest from uploading
      }
      onProgress({ uploaded: countUploaded(), total, creating: false });
    }

    const failed = total - countUploaded();
    if (failed > 0) {
      draft = {
        ...draft,
        status: 'failed',
        error: `Couldn't upload ${failed} ${failed === 1 ? 'photo' : 'photos'}.`,
      };
      await saveDraft(draft);
      return { status: 'failed', draft };
    }

    onProgress({ uploaded: total, total, creating: true });
    try {
      const post = await createPost({
        tripId: draft.tripId,
        visitedOn: draft.visitedOn,
        caption: draft.caption.trim() || null,
        ...toLocationFields(draft.location!),
        media: draft.photos.map((p) => ({
          s3Key: p.s3Key!,
          mediaType: 'image' as const,
          width: Math.round(p.width),
          height: Math.round(p.height),
        })),
      });
      await deleteDraft(draft.id);
      return { status: 'created', post };
    } catch (error) {
      draft = {
        ...draft,
        status: 'failed',
        error:
          error instanceof ApiError && error.status < 500
            ? "Couldn't save this post. Check the details and try again."
            : "Photos uploaded, but the post couldn't be saved.",
      };
      await saveDraft(draft);
      return { status: 'failed', draft };
    }
  } finally {
    inFlight.delete(input.id);
  }
}
