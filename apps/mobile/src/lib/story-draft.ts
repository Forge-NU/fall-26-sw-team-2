import type { CreateStoryRequest } from 'shared-types';

import { toLocationFields, type PickedLocation } from '@/components/location/location-picker';
import type { PickedPhoto } from '@/lib/media/pick-photo';

export const STORY_TEXT_MAX = 200;

// What #86's LocationPicker returns: a Mapbox location row or a custom name
export type StoryLocation = PickedLocation;

// What the composer hands to the upload queue.
export type StoryDraft = {
  photo: PickedPhoto; // already prepared (resized, JPEG)
  text: string;
  location: StoryLocation | null;
  tripId: string | null;
  keepOnTrip: boolean;
  storyDate: string; // YYYY-MM-DD
};

export function canKeepOnTrip(tripId: string | null): boolean {
  return tripId !== null;
}

export function toCreateStoryRequest(
  draft: StoryDraft,
  s3Key: string,
  today: string,
): CreateStoryRequest {
  const text = draft.text.trim();
  const request: CreateStoryRequest = {
    s3Key,
    date: today,
    ...(draft.location && toLocationFields(draft.location)),
  };

  if (text) request.text = text;
  if (draft.tripId) {
    request.tripId = draft.tripId;
    request.keepOnTrip = draft.keepOnTrip;
    // Without a trip the server only accepts today, which is its default
    request.storyDate = draft.storyDate;
  }
  return request;
}
