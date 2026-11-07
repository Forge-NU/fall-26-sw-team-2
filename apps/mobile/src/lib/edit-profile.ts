import type { UpdateMeRequest } from '@/api/profiles';

export type ProfileDraft = {
  firstName: string;
  lastName: string;
  /** A new local photo to upload, null to remove the avatar, undefined to keep it */
  avatar?: { uri: string } | null;
};

type SavedNames = { firstName: string; lastName: string };

export const MAX_NAME_LENGTH = 50;

/** The name fields that changed, trimmed. Empty when only the avatar changed, or nothing did. */
export function nameChanges(saved: SavedNames, draft: ProfileDraft): Pick<UpdateMeRequest, 'firstName' | 'lastName'> {
  const firstName = draft.firstName.trim();
  const lastName = draft.lastName.trim();
  return {
    ...(firstName !== saved.firstName && { firstName }),
    ...(lastName !== saved.lastName && { lastName }),
  };
}

export function hasChanges(saved: SavedNames, draft: ProfileDraft): boolean {
  return draft.avatar !== undefined || Object.keys(nameChanges(saved, draft)).length > 0;
}

/** What's wrong with a name, or undefined when it's fine. Last name is optional. */
export function nameError(value: string, required: boolean): string | undefined {
  const name = value.trim();
  if (required && !name) return 'Add your first name';
  if (name.length > MAX_NAME_LENGTH) return `Keep it under ${MAX_NAME_LENGTH} characters`;
  return undefined;
}
