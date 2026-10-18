import { useState } from 'react';

import { createTrip } from '@/api/trips';
import type { CreateTripRequest, TripResponse } from '@/api/types';
import { useActiveTrips } from '@/hooks/use-active-trips';
import { choosePhoto, takePhoto, type PickedPhoto } from '@/lib/media/pick-photo';
import { preparePhoto } from '@/lib/media/prepare-photo';
import { canKeepOnTrip, STORY_TEXT_MAX, type StoryLocation } from '@/lib/story-draft';
import { postStory } from '@/lib/story-upload-queue';
import { validateQuickTrip } from '@/lib/trips';

// The wireframe shows "Add to trip" on by default
const DEFAULT_KEEP_ON_TRIP = true;

export type PhotoStatus = 'idle' | 'preparing' | 'denied' | 'failed';

// Until the user picks, the trip follows the suggested one (which loads async)
type TripChoice = { kind: 'suggested' } | { kind: 'trip'; id: string } | { kind: 'none' };

export type QuickTripResult = { trip: TripResponse } | { error: string };

// State and actions for the post-story screen. The screen only renders this.
export function useStoryComposer() {
  const activeTrips = useActiveTrips();

  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus>('idle');
  const [text, setText] = useState('');
  // Same shape POST-2's LocationPicker (#65) takes as value/onChange
  const [location, setLocation] = useState<StoryLocation | null>(null);
  const [tripChoice, setTripChoice] = useState<TripChoice>({ kind: 'suggested' });
  const [keepOnTripChoice, setKeepOnTripChoice] = useState(DEFAULT_KEEP_ON_TRIP);

  const trip =
    tripChoice.kind === 'suggested'
      ? activeTrips.suggestedTrip
      : tripChoice.kind === 'trip'
        ? (activeTrips.trips.find((t) => t.id === tripChoice.id) ?? null)
        : null;
  const keepOnTrip = canKeepOnTrip(trip?.id ?? null) && keepOnTripChoice;

  const canPost =
    photo !== null && photoStatus !== 'preparing' && text.trim().length <= STORY_TEXT_MAX;

  async function pickPhoto(source: 'camera' | 'library') {
    const result = source === 'camera' ? await takePhoto() : await choosePhoto();
    if (result.status === 'canceled') return;
    if (result.status === 'denied') {
      setPhotoStatus('denied');
      return;
    }

    setPhotoStatus('preparing');
    try {
      setPhoto(await preparePhoto(result.photo));
      setPhotoStatus('idle');
    } catch {
      setPhotoStatus('failed');
    }
  }

  function selectTrip(tripId: string | null) {
    setTripChoice(tripId ? { kind: 'trip', id: tripId } : { kind: 'none' });
    if (!tripId) setKeepOnTripChoice(false);
  }

  function setKeepOnTrip(value: boolean) {
    if (trip) setKeepOnTripChoice(value);
  }

  async function createQuickTrip(input: CreateTripRequest): Promise<QuickTripResult> {
    const error = validateQuickTrip(input, activeTrips.today);
    if (error) return { error };

    try {
      const created = await createTrip({
        ...input,
        title: input.title.trim(),
        destination: input.destination.trim(),
      });
      activeTrips.addTrip(created);
      setTripChoice({ kind: 'trip', id: created.id });
      return { trip: created };
    } catch {
      return { error: "Couldn't create the trip. Try again." };
    }
  }

  // Hands the story to the upload queue. Returns false if there's nothing to post.
  function post(): boolean {
    if (!photo || !canPost) return false;
    postStory({ photo, text, location, tripId: trip?.id ?? null, keepOnTrip });
    return true;
  }

  return {
    today: activeTrips.today,
    photo,
    photoStatus,
    pickPhoto,
    text,
    setText,
    textMax: STORY_TEXT_MAX,
    location,
    setLocation,
    trips: activeTrips.trips,
    tripsLoading: activeTrips.loading,
    tripsError: activeTrips.error,
    reloadTrips: activeTrips.reload,
    trip,
    isSuggestedTrip: trip !== null && trip.id === activeTrips.suggestedTrip?.id,
    selectTrip,
    keepOnTrip,
    canKeepOnTrip: trip !== null,
    setKeepOnTrip,
    createQuickTrip,
    canPost,
    post,
  };
}
