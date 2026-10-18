// Posts stories in the background: get an upload URL, upload the photo, then
// create the story. Retries skip steps that already succeeded. Kept in memory
// only, so pending stories are lost if the app is killed.
import { Alert } from 'react-native';

import { ApiError } from '@/api/client';
import { createStory } from '@/api/stories';
import type { CreateUploadResponse } from '@/api/types';
import { createUpload, putObject } from '@/api/uploads';
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
  upload: CreateUploadResponse | null;
  uploaded: boolean;
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
  progress.set(id, { upload: null, uploaded: false, createOutcomeUnknown: false, running: false });
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
        showToast({ message: 'Story posted', variant: 'success' });
        return;
      } catch (error) {
        if (!uploads.some((upload) => upload.id === id)) return; // discarded
        const retriesLeft = attempt <= RETRY_DELAYS_MS.length;
        if (!retriesLeft || !isRetryableError(error)) {
          update(id, { status: 'failed' });
          notifyFailed(id, error);
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
  if (!state.upload) {
    state.upload = await createUpload('story');
  }

  if (!state.uploaded) {
    try {
      await putObject(state.upload.uploadUrl, draft.photo.uri);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        // Presigned URL expired: get a new one next attempt (plain Error so it retries)
        state.upload = null;
        throw new Error('Upload URL expired');
      }
      throw error;
    }
    state.uploaded = true;
  }

  try {
    await createStory(toCreateStoryRequest(draft, state.upload.s3Key, todayLocalIso()));
  } catch (error) {
    // Key already used by the earlier create, so the story did post
    if (state.createOutcomeUnknown && error instanceof ApiError && error.status === 400) return;
    if (!(error instanceof ApiError)) state.createOutcomeUnknown = true;
    throw error;
  }
}

// An alert rather than a toast, since the toast can't hold Retry / Discard buttons
function notifyFailed(id: string, error: unknown) {
  Alert.alert("Your story didn't post", failureMessage(error), [
    { text: 'Discard', style: 'destructive', onPress: () => discardStoryUpload(id) },
    { text: 'Retry', onPress: () => retryStoryUpload(id) },
  ]);
}

function failureMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'You were signed out. Sign in again, then retry.';
  }
  if (isRetryableError(error)) return 'Check your connection and try again.';
  return "Something in this story can't be posted, for example its trip is no longer active.";
}
