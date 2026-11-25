import type { UserSummary } from './index.js';
import type { TripResponse } from './content.js';
import type { LocationResponse } from './locations.js';

// Shared trips, buckets, saved places and notifications (#131 COLLAB-1).
// Rules: docs/product/mvp-decisions.md (#129 DOC-3). Every endpoint, with its
// errors and the issue that builds it: docs/architecture/shared-trips.md.
//
// Lists marked "paginated" take ?cursor=&limit= (1-50, default 20) and return
// PaginatedResponse<T>. Members and invites are capped at MAX_TRIP_PEOPLE, so
// they come back whole as { items }.

// Roles and members (#133 COLLAB-2)

/** 'owner' is the trip's creator; everyone they invite who accepts is a 'collaborator' */
export type TripRole = 'owner' | 'collaborator';

/** One person on a trip. Used by GET /api/trips/:id/members. */
export type TripMemberResponse = UserSummary & {
  role: TripRole;
  /** When they accepted the invite. For the owner, when they created the trip. */
  joinedAt: string;
};

/** GET /api/trips/:id/members: the owner first, then collaborators by joinedAt. Members only. */
export type TripMembersResponse = {
  items: TripMemberResponse[];
};

/**
 * One row of GET /api/me/trips/planning (paginated): trips you own or joined,
 * by startDate, soonest first. Drafts and published trips both appear.
 */
export type PlanningTripResponse = TripResponse & {
  myRole: TripRole;
  /** Everyone on the trip, including the owner */
  memberCount: number;
  bucketCount: number;
};

// Invites (#134 COLLAB-3)

export type TripInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

/**
 * Returned by POST /api/trips/:id/invites, DELETE /api/invites/:id (cancel)
 * and POST /api/invites/:id/accept and /decline
 */
export type TripInviteResponse = {
  id: string;
  tripId: string;
  inviter: UserSummary;
  invitee: UserSummary;
  status: TripInviteStatus;
  createdAt: string;
  /** When it was accepted, declined or cancelled. Null while pending. */
  respondedAt: string | null;
};

/** GET /api/trips/:id/invites: the trip's pending invites, newest first. Owner only. */
export type TripInvitesResponse = {
  items: TripInviteResponse[];
};

/** Body of POST /api/trips/:id/invites. Anyone can be invited; following isn't required. */
export type CreateTripInviteRequest = {
  username: string;
};

// Notifications (#132 NOTIF-1)

/** More types (likes, comments, follows) can be added later on the same table */
export type NotificationType = 'trip_invite' | 'trip_invite_accepted';

/** The trip a notification is about */
export interface NotificationTrip {
  id: string;
  title: string;
  /** YYYY-MM-DD, like TripResponse */
  startDate: string;
  endDate: string;
}

/** An invite's current state, so one answered or cancelled elsewhere never offers Accept again */
export interface NotificationInvite {
  id: string;
  status: TripInviteStatus;
}

/** One row of GET /api/me/notifications (paginated), newest first */
export interface NotificationResponse {
  id: string;
  type: NotificationType;
  /** Who did it: the inviter for trip_invite, the person who joined for trip_invite_accepted */
  actor: UserSummary;
  /** Null only for later types that aren't about a trip */
  trip: NotificationTrip | null;
  /** Set for trip_invite, null otherwise */
  invite: NotificationInvite | null;
  readAt: string | null;
  createdAt: string;
}

/** GET /api/me/notifications/unread-count */
export interface UnreadCountResponse {
  count: number;
}

// Saved places (#135 PLACE-1)

/** One row of GET /api/me/saved/places (paginated), newest save first */
export type SavedPlaceResponse = {
  location: LocationResponse;
  savedAt: string;
};

/** Returned by POST and DELETE /api/locations/:id/save. Place saves are private, so there's no count. */
export type PlaceSaveStatusResponse = {
  saved: boolean;
};

// Buckets (#136 BUCKET-1)

/** One place in a trip's bucket. Members only. */
export type BucketItemResponse = {
  id: string;
  location: LocationResponse;
  addedBy: UserSummary;
  /** Up to 280 characters */
  note: string | null;
  createdAt: string;
};

/** Body of POST /api/trips/:id/bucket. locationId is a Mapbox place from POST /api/locations/resolve. */
export type CreateBucketItemRequest = {
  locationId: string;
  note?: string | null;
};

/** Body of PATCH /api/bucket-items/:id. null clears the note. */
export type UpdateBucketItemRequest = {
  note: string | null;
};

/** One of your Planning trips, and whether this place is in its bucket */
export type PlaceSavedInTrip = {
  id: string;
  title: string;
  inBucket: boolean;
};

/** GET /api/locations/:id/saved-in: where you've saved a place, for the save sheet */
export type PlaceSavedInResponse = {
  savedByMe: boolean;
  trips: PlaceSavedInTrip[];
};
