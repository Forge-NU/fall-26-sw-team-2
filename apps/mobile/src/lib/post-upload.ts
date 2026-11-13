// Uploads a post draft's photos, then creates the post. The draft is saved
// after every step, so a failure (or the app closing) never loses work and a
// retry skips photos that already uploaded.
import type { PostResponse } from 'shared-types';

import { ApiError } from '@/api/client';
import { resolveLocation } from '@/api/locations';
import { createPost } from '@/api/posts';
import { isExpiredPinError, toLocationFields, type PickedLocation } from '@/lib/picked-location';
import { uploadPhoto } from '@/lib/media/upload-photo';
import { deleteDraft, saveDraft, type PostDraft } from '@/lib/post-drafts';
import { RETRY_DELAYS_MS } from '@/lib/retry';

// current: 1-based photo being uploaded. fraction: 0 to 1, for that photo.
export type UploadProgress = {
  current: number;
  uploaded: number;
  total: number;
  fraction: number;
  creating: boolean;
};

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
    for (const [index, photo] of draft.photos.entries()) {
      if (photo.s3Key) continue;
      const report = (fraction: number) =>
        onProgress({ current: index + 1, uploaded: countUploaded(), total, fraction, creating: false });
      report(0);
      try {
        photo.s3Key = await uploadPhoto(photo.uri, 'post', {
          retryDelaysMs: PHOTO_RETRY_DELAYS_MS,
          onProgress: report,
        });
        await saveDraft(draft);
      } catch {
        // Keep going, so one bad photo doesn't stop the rest from uploading
      }
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

    onProgress({ current: total, uploaded: total, total, fraction: 1, creating: true });
    const create = (location: PickedLocation) =>
      createPost({
        tripId: draft.tripId,
        visitedOn: draft.visitedOn,
        caption: draft.caption.trim() || null,
        ...toLocationFields(location),
        media: draft.photos.map((p) => ({
          s3Key: p.s3Key!,
          mediaType: 'image' as const,
          width: Math.round(p.width),
          height: Math.round(p.height),
        })),
      });
    try {
      let post: PostResponse;
      try {
        post = await create(draft.location!);
      } catch (error) {
        const location = draft.location!;
        if (!(error instanceof ApiError && isExpiredPinError(location, error.status, error.message))) throw error;
        // The draft sat long enough for the unused pin to be cleaned up: drop it again
        const pin = await resolveLocation({
          kind: 'pin',
          name: location.location.name,
          latitude: location.location.latitude,
          longitude: location.location.longitude,
        });
        draft = { ...draft, location: pin };
        await saveDraft(draft);
        post = await create(pin);
      }
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
