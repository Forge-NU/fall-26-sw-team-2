// Logic for the invite screen (app/trips/[id]/invite, #138 COLLAB-4), kept free
// of React Native so the node tests can import it.
import type { TripInviteResponse } from 'shared-types';

/** What a person's row on the invite screen offers */
export type InviteRowState = 'invite' | 'invited' | 'self';

/**
 * `self` for the owner (you can't invite yourself), `invited` for someone with
 * a pending invite, otherwise `invite`. People already on the trip get a
 * `member` state once #133 COLLAB-2's members list is live; until then the
 * API's 409 says so when the owner taps Invite.
 */
export function inviteRowState(
  personId: string,
  myId: string,
  pending: Pick<TripInviteResponse, 'invitee'>[],
): InviteRowState {
  if (personId === myId) return 'self';
  if (pending.some((invite) => invite.invitee.id === personId)) return 'invited';
  return 'invite';
}

/** Adds a new invite to the cached list, newest first, without doubling it */
export function withInvite(
  pending: TripInviteResponse[] | undefined,
  invite: TripInviteResponse,
): TripInviteResponse[] {
  return [invite, ...(pending ?? []).filter((i) => i.id !== invite.id)];
}

/** Takes an invite out of the cached list, after it's cancelled */
export function withoutInvite(
  pending: TripInviteResponse[] | undefined,
  inviteId: string,
): TripInviteResponse[] {
  return (pending ?? []).filter((i) => i.id !== inviteId);
}
