import type { CreateStoryRequest, ResolveLocationResponse } from '@/api/types';
import type { PickedPhoto } from '@/lib/media/pick-photo';

export const STORY_TEXT_MAX = 200;

// Same shape as PickedLocation from POST-2's location picker (#65)
export type StoryLocation = ResolveLocationResponse;

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
  // TODO: use toLocationFields from the location picker once #65 merges
  if (draft.location?.kind === 'mapbox') {
    request.locationId = draft.location.location.id;
  } else if (draft.location?.kind === 'custom') {
    const name = draft.location.name.trim();
    if (name) request.customLocationName = name;
  }
  if (draft.tripId) {
    request.tripId = draft.tripId;
    request.keepOnTrip = draft.keepOnTrip;
  }
  return request;
}
