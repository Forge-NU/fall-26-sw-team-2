import { useSyncExternalStore } from 'react';

import { getStoryUploads, subscribeToStoryUploads } from '@/lib/story-upload-queue';

// Stories still uploading or failed, for showing upload status in the UI.
export function useStoryUploads() {
  return useSyncExternalStore(subscribeToStoryUploads, getStoryUploads);
}
