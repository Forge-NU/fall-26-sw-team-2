// Local drafts for the post composer. DOC-1: a post isn't created until every
// upload succeeds, and a failed upload keeps the post as a local draft with Retry.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PickedLocation } from '@/components/location/location-picker';

const STORAGE_KEY = 'yuji.post-drafts.v1';

export type DraftPhoto = {
  uri: string; // local JPEG, already resized
  width: number;
  height: number;
  s3Key: string | null; // set once this photo has uploaded
};

export type PostDraft = {
  id: string;
  tripId: string;
  visitedOn: string;
  caption: string;
  location: PickedLocation | null;
  photos: DraftPhoto[];
  status: 'uploading' | 'failed';
  error: string | null;
  updatedAt: string;
};

type Listener = (drafts: PostDraft[]) => void;
const listeners = new Set<Listener>();
let cache: PostDraft[] | null = null;

async function readAll(): Promise<PostDraft[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as PostDraft[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function writeAll(drafts: PostDraft[]): Promise<void> {
  cache = drafts;
  for (const listener of listeners) listener(drafts);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function newDraftId(): string {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listDrafts(): Promise<PostDraft[]> {
  return readAll();
}

export async function getDraft(id: string): Promise<PostDraft | null> {
  return (await readAll()).find((draft) => draft.id === id) ?? null;
}

export async function saveDraft(draft: PostDraft): Promise<void> {
  const drafts = await readAll();
  const next = { ...draft, updatedAt: new Date().toISOString() };
  await writeAll([...drafts.filter((d) => d.id !== draft.id), next]);
}

export async function deleteDraft(id: string): Promise<void> {
  const drafts = await readAll();
  await writeAll(drafts.filter((d) => d.id !== id));
}

export function subscribeToDrafts(listener: Listener): () => void {
  listeners.add(listener);
  void readAll().then(listener);
  return () => {
    listeners.delete(listener);
  };
}
