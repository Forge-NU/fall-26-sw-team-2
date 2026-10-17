import { useSyncExternalStore } from 'react';

import { getStoryUploads, subscribeToStoryUploads } from '@/lib/story-upload-queue';

export function useStoryUploads() {
  return useSyncExternalStore(subscribeToStoryUploads, getStoryUploads);
}
