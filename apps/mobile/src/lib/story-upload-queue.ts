// Posts stories in the background so the composer can close as soon as the
// user taps Post. Each story goes through: get an upload URL, PUT the photo
// to S3, create the story. Steps that already worked are skipped on retry.
// Retryable failures are retried with backoff (lib/retry.ts); if the story
// still doesn't post, the user is told and can retry or discard it.
//
// The queue lives in memory: it keeps going while the app is open, but a
// story still uploading is lost if the app is force-closed.
import { Alert } from 'react-native';

import { ApiError } from '@/api/client';
import { createStory } from '@/api/stories';
import type { CreateUploadResponse } from '@/api/types';
import { createUpload, putObject } from '@/api/uploads';
import { isRetryableError, RETRY_DELAYS_MS, sleep } from '@/lib/retry';
import { toCreateStoryRequest, type StoryDraft } from '@/lib/story-draft';
import { todayLocalIso } from '@/utils/local-date';

export type StoryUploadStatus = 'uploading' | 'waiting-to-retry' | 'failed';

export type StoryUpload = {
  id: string;
  draft: StoryDraft;
  status: StoryUploadStatus;
  attempt: number;
};

// Progress kept between attempts, so a retry doesn't redo finished steps.
type Progress = {
  upload: CreateUploadResponse | null;
  uploaded: boolean;
  // A create request failed without a response, so the story may exist.
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

// Stories that haven't posted yet. Posted stories are removed.
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
        return;
      } catch (error) {
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
      // The presigned URL may have expired; get a new one next time.
      if (error instanceof ApiError && error.status === 403) state.upload = null;
      throw error;
    }
    state.uploaded = true;
  }

  try {
    await createStory(toCreateStoryRequest(draft, state.upload.s3Key, todayLocalIso()));
  } catch (error) {
    // If an earlier create reached the server but its response was lost, the
    // retry is rejected because the key is already used: the story posted.
    if (state.createOutcomeUnknown && error instanceof ApiError && error.status === 400) return;
    if (!(error instanceof ApiError)) state.createOutcomeUnknown = true;
    throw error;
  }
}

// TODO: switch to the toast from #60 (ui-theme-components) once it merges.
function notifyFailed(id: string, error: unknown) {
  const message = isRetryableError(error)
    ? 'Check your connection and try again.'
    : "Something in this story can't be posted, for example its trip is no longer active.";

  Alert.alert("Your story didn't post", message, [
    { text: 'Discard', style: 'destructive', onPress: () => discardStoryUpload(id) },
    { text: 'Retry', onPress: () => retryStoryUpload(id) },
  ]);
}
