import { useSyncExternalStore } from 'react';

import { getStoryUploads, subscribeToStoryUploads, type StoryUpload } from '@/lib/story-upload-queue';

// The web build pre-renders pages, and nothing is uploading then
const NO_UPLOADS: StoryUpload[] = [];
const getServerUploads = () => NO_UPLOADS;

export function useStoryUploads() {
  return useSyncExternalStore(subscribeToStoryUploads, getStoryUploads, getServerUploads);
}
