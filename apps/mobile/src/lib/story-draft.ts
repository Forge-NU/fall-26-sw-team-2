import type { CreateStoryRequest } from '@/api/types';
import type { PickedPhoto } from '@/lib/media/pick-photo';

export const STORY_TEXT_MAX = 200;

// A place from the location picker (POST-2, #42), or a name the user typed.
export type StoryLocation = { locationId: string } | { customLocationName: string };

// What the composer hands to the upload queue.
export type StoryDraft = {
  photo: PickedPhoto; // already prepared (resized, JPEG)
  text: string;
  location: StoryLocation | null;
  tripId: string | null;
  keepOnTrip: boolean;
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
  const request: CreateStoryRequest = { s3Key, date: today };

  if (text) request.text = text;
  if (draft.location && 'locationId' in draft.location) {
    request.locationId = draft.location.locationId;
  } else if (draft.location) {
    const name = draft.location.customLocationName.trim();
    if (name) request.customLocationName = name;
  }
  if (draft.tripId) {
    request.tripId = draft.tripId;
    request.keepOnTrip = draft.keepOnTrip;
  }
  return request;
}
