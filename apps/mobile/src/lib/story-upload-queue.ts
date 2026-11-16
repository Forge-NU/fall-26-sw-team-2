// Posts stories in the background: upload the photo (MEDIA-1, #38), then
// create the story. Retries skip steps that already succeeded.
//
// The queue lives in memory only. If the app is killed while a story is
// uploading or waiting for Retry, that story is lost and the user has to post
// it again. Persisting the queue is out of scope for now (#101).
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import { createStory } from '@/api/stories';
import { uploadPhoto } from '@/lib/media/upload-photo';
import { queryClient } from '@/lib/query-client';
import { isRetryableError, RETRY_DELAYS_MS, sleep } from '@/lib/retry';
import { toCreateStoryRequest, type StoryDraft } from '@/lib/story-draft';
import { showToast } from '@/lib/toast';
import { todayLocalIso } from '@/utils/local-date';

export type StoryUploadStatus = 'uploading' | 'waiting-to-retry' | 'failed';

export type StoryUpload = {
  id: string;
  draft: StoryDraft;
  status: StoryUploadStatus;
  attempt: number;
};

type Progress = {
  // Set once the photo is in S3
  s3Key: string | null;
  // A create failed with no response, so it may have gone through
  createOutcomeUnknown: boolean;
  running: boolean;
};

let uploads: StoryUpload[] = [];
const progress = new Map<string, Progress>();
const listeners = new Set<() => void>();
let nextId = 1;

function emit() {
  for (const listener of listeners) listener();
}

function update(id: string, changes: Partial<StoryUpload>) {
  uploads = uploads.map((upload) => (upload.id === id ? { ...upload, ...changes } : upload));
  emit();
}

function remove(id: string) {
  uploads = uploads.filter((upload) => upload.id !== id);
  progress.delete(id);
  emit();
}

export function subscribeToStoryUploads(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Pending and failed stories (posted ones are removed)
export function getStoryUploads(): StoryUpload[] {
  return uploads;
}

export function postStory(draft: StoryDraft): string {
  const id = `story-upload-${nextId++}`;
  uploads = [...uploads, { id, draft, status: 'uploading', attempt: 0 }];
  progress.set(id, { s3Key: null, createOutcomeUnknown: false, running: false });
  emit();
  void run(id);
  return id;
}

export function retryStoryUpload(id: string) {
  const job = uploads.find((upload) => upload.id === id);
  if (job?.status === 'failed') void run(id);
}

export function discardStoryUpload(id: string) {
  remove(id);
}

async function run(id: string) {
  const state = progress.get(id);
  if (!state || state.running) return;
  state.running = true;

  try {
    for (let attempt = 1; ; attempt++) {
      const job = uploads.find((upload) => upload.id === id);
      if (!job) return; // discarded

      update(id, { status: 'uploading', attempt });
      try {
        await attemptOnce(job.draft, state);
        remove(id);
        refreshStories(job.draft);
        showToast({ message: 'Story posted', variant: 'success' });
        return;
      } catch (error) {
        if (!uploads.some((upload) => upload.id === id)) return; // discarded
        const retriesLeft = attempt <= RETRY_DELAYS_MS.length;
        if (!retriesLeft || !isRetryableError(error)) {
          update(id, { status: 'failed' });
          notifyFailed(error);
          return;
        }
        update(id, { status: 'waiting-to-retry' });
        await sleep(RETRY_DELAYS_MS[attempt - 1]);
      }
    }
  } finally {
    state.running = false;
  }
}

async function attemptOnce(draft: StoryDraft, state: Progress) {
  if (!state.s3Key) {
    try {
      // One attempt, since run() does the retries
      state.s3Key = await uploadPhoto(draft.photo.uri, 'story', { retryDelaysMs: [] });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        // Presigned URL expired. Every attempt gets a new one, so retry
        // (plain Error so isRetryableError says yes).
        throw new Error('Upload URL expired');
      }
      throw error;
    }
  }

  try {
    await createStory(toCreateStoryRequest(draft, state.s3Key, todayLocalIso()));
  } catch (error) {
    // Key already used by the earlier create, so the story did post
    if (state.createOutcomeUnknown && error instanceof ApiError && error.status === 400) return;
    if (!(error instanceof ApiError)) state.createOutcomeUnknown = true;
    throw error;
  }
}

// The new story shows in the bar, and on the trip page if it's kept there
function refreshStories(draft: StoryDraft) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.storiesFeed });
  if (draft.tripId && draft.keepOnTrip) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tripStories(draft.tripId) });
  }
}

// The toast can't hold buttons, so Retry / Discard live on the upload pill
// in the stories row (StoryUploadPill)
function notifyFailed(error: unknown) {
  showToast({ message: `Your story didn't post. ${failureMessage(error)}`, variant: 'error' });
}

function failureMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'You were signed out. Sign in again, then retry it from your feed.';
  }
  if (isRetryableError(error)) return 'Check your connection, then retry it from your feed.';
  return "Something in this story can't be posted, for example its trip is no longer active.";
}
