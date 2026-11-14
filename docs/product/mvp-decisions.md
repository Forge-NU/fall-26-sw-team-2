# MVP Product Decisions

Status: Decided, for review
Issue: #33 (DOC-1)
Decided: 2026-10-11 and 2026-10-12
Updated: 2026-11-13, shared trips, buckets, saved places and notifications (#129 DOC-3)

## Overview

This doc is the single source of truth for the product rules in the Yuji MVP. If a ticket, wireframe, or the design notebook disagrees with this doc, this doc wins. To change a rule, open a PR against this file instead of changing it in a feature PR.

The data model behind these rules is in [`docs/architecture/data-model.md`](../architecture/data-model.md).

## Accounts

- Clerk handles sign-up, sign-in, and sessions. Yuji creates its `users` row from Clerk's `user.created` webhook.
- The `users` row stores the Clerk user ID, email, first name, last name, username, and avatar. This replaces the design notebook's rule that no personal information is stored in Postgres.
- Usernames:
  - 3 to 30 characters.
  - Only letters, numbers, `_` and `.`.
  - Unique regardless of capitalization, so `Duke` and `duke` can't both exist.
- There's no bio in the MVP.

### Account deletion

Deleting an account deletes everything, permanently. Nothing is kept or anonymized. That covers:
- the Clerk user,
- the `users` row,
- the user's trips, posts, and stories, and the S3 objects for all of their media and avatar,
- their follows in both directions,
- their likes, saves (including saved places), and comments, including comments on other people's posts,
- their trip memberships, the invites they sent or received, their notifications, and the bucket places they added to other people's trips (see [Shared trips](#shared-trips)).

Deleting an account deletes the user's own trips for everyone, including their collaborators. Ownership can't be transferred in the MVP.

## Visibility

Everything is public. There are no private accounts, follower-only posts, or follow requests.

"Public" applies to published content only. A trip and its posts stay hidden from everyone except the owner and the trip's collaborators until the trip is published (see [Trips](#trips) and [Shared trips](#shared-trips)).

Two things are never public: what you've saved (see [Saves](#saves)) and a trip's bucket, which only the trip's members can see, even after the trip is published.

## Trips

A trip is the main unit of content: a dated itinerary made of posts.

| Field | Rule |
|---|---|
| Title | Required, up to 100 characters |
| Destination | Required free text, up to 100 characters, for example "Tokyo, Japan". It's only displayed, so the map and search don't use it. |
| Description | Optional, up to 1,000 characters |
| Start and end dates | Both required when the trip is created. The end date can't be before the start date. Past and future dates are both allowed. |

### Lifecycle

A trip is either a **draft** or **published**.

- **Draft:** only the owner and the trip's collaborators can see the trip and its posts. It shows on the owner's own profile as in progress. No one but the owner can like, save, or comment on it, collaborators included.
- **Published:** the owner taps Publish. From then on, the trip and all its posts are visible to everyone: in followers' feeds, on the owner's profile, on the map, and in search.
- A trip needs at least one post before it can be published.
- Publishing can't be undone in the MVP. There's no unpublish.
- After publishing, the owner can still edit the trip's details and add, edit, or delete posts. Changes show up right away.

### Active trip

A trip is **active** when it's a draft **and** today falls between its start and end dates, inclusive. Publishing a trip ends its active period, even if the end date hasn't passed yet.

Only active trips can have stories linked to them (see [Stories](#stories)). While a trip is a draft, stories are how followers follow along live.

### Deleting a trip

The owner can delete a trip after a confirmation prompt. This permanently deletes the trip, all of its posts and their media (including the S3 objects), every story linked to it, and every like, save, and comment on it or its posts. It also deletes the trip's members, invites, bucket, and the notifications about it, for everyone on the trip.

## Shared trips

A trip's owner can invite other people to plan it with them. The people on a trip are its **members**: one **owner** (the person who created it) and up to 9 **collaborators**, so 10 people in all.

Collaborators plan with the owner. They don't post: the trip's posts are still the owner's.

### Roles

| Action | Owner | Collaborator | Everyone else |
|---|---|---|---|
| See the trip, its posts and stories while it's a draft | Yes | Yes, read-only | No |
| Like, save, or comment while it's a draft | Yes | No | No |
| See the trip's bucket | Yes | Yes | No, even after publishing |
| Add places to the bucket | Yes | Yes | No |
| Edit the note on, or remove, a bucket place they added | Yes | Yes | No |
| Remove any bucket place | Yes | No | No |
| Edit the trip's details, add, edit, or delete posts | Yes | No | No |
| Publish or delete the trip | Yes | No | No |
| Invite people, cancel invites, remove collaborators | Yes | No | No |
| Leave the trip | No | Yes | No |

Once the trip is published, everyone sees it the way they see any published trip: as the owner's trip.

### Invites

- The owner can invite anyone by username. Following isn't required, because everything in Yuji is public.
- The invite arrives in the invitee's notifications, where they accept or decline it. Accepting makes them a collaborator.
- Declining doesn't notify the owner. The owner can invite the same person again later.
- There's at most one pending invite per person per trip. Invites don't expire, and the owner can cancel a pending one.
- Pending invites count toward the 10-person cap.
- The owner gets a notification when someone accepts.

### Bucket

Every trip has a **bucket**: a list of places its members want to go. It's where a group collects ideas for a trip, kept apart from the trip's posts, which are what the owner shares publicly.

- Each bucket place is a place, the member who added it, and an optional note of up to 280 characters.
- A place can be in a bucket only once. A bucket holds at most 200 places.
- Only places with a location row can be added: Mapbox places and dropped pins (#94 LOC-2), not custom names without a pin (see [Locations](#locations)).
- The bucket is an unordered list. Bucket places aren't scheduled onto days of the trip.
- When a collaborator leaves or is removed, the places they added stay in the bucket.

### Planning list

The Trips section of the Saved tab has a **Planning** list of the trips you own or have joined. Each one opens to its bucket. Trips you've joined don't show on your profile.

## Posts

A post is media within a trip, with a caption and a location.

- Every post belongs to exactly one trip, and posts can't exist without a trip. A post's author is always its trip's owner.
- Each post has one location. It's required, and it can be a Mapbox place or a custom name (see [Locations](#locations)).
- Each post has a date (the day it happened). It's required, it must fall within the trip's dates, and it defaults to today if today is within them, otherwise to the trip's start date.
- A trip shows its posts in date order, oldest first. Posts on the same date are shown in the order they were added.
- Media: 1 to 30 photos or videos per post, in the order the user picked them (see [Media limits](#media-limits)).
- Caption: optional, up to 2,200 characters.
- Only the trip's owner can add, edit, or delete posts in it. Collaborators on a shared trip can't (see [Shared trips](#shared-trips)). Deleting a post permanently deletes its media (including the S3 objects), likes, saves, and comments.
- A post isn't created until every upload has succeeded. If an upload fails, the app keeps the post as a local draft with a Retry option.

Cut from the MVP: interest tags, tagging other users in posts, several locations per post, and trip ratings.

## Locations

- A location is either a **Mapbox place** (picked from search, stored with its Mapbox ID, name, and coordinates) or a **custom location** (a name the user typed when search had no result).
- Custom locations have no coordinates, so they show on the post but not on the map.
- Two posts tagged at the same Mapbox place share one location row. That shared row is what lets the map and place search group posts by place.
- **Mapbox storage terms** (confirmed for #37 LOC-1, checked 2026-10-17):
  - **Search Box API:** results are for temporary use only and can't be stored. Storing them needs a separate agreement with Mapbox sales. ([Search Box API](https://docs.mapbox.com/api/search/search-box/))
  - **Geocoding API:** results can be stored indefinitely only when requested with `permanent=true`. That needs a credit card on file (or an enterprise contract), is billed separately per 1,000 requests with no free tier, and is for our own use only (no redistribution). ([Geocoding API](https://docs.mapbox.com/api/search/geocoding/), [temporary vs. permanent](https://docs.mapbox.com/help/dive-deeper/understand-temporary-vs-permanent-geocoding/), [pricing](https://www.mapbox.com/pricing))
  - **Permanent geocoding has no POIs.** It covers addresses, places, neighborhoods and so on, but not restaurants, landmarks or shops.
  - **Open decision, escalated:** the MVP stores POI rows (name and coordinates) picked from search, and neither API allows that as-is. Until the team decides (ask Mapbox sales, limit stored places to permanent-geocoding results, or change provider), the `locations` table and the resolve endpoint (`docs/architecture/locations.md`) are built against the current design.

## Stories

- A story is one photo, with optional text (up to 200 characters) and an optional location. Video stories aren't in the MVP.
- Linking a trip is optional. A story can only be linked to one of the user's **active** trips. The app suggests the active trip if there is one.
- Every story is visible to everyone for 24 hours, in the stories bar at the top of the feed, including when its trip is still a draft. The server enforces the 24-hour expiry, not the app.
- When creating a story linked to a trip, the user can choose **Add to trip**. A kept story stays on the trip page after it expires. It's visible there to others once the trip is published.
- A story that isn't kept is deleted after 24 hours, including its S3 object.
- The owner can delete a story at any time. Deleting a trip deletes all of its stories.

## Social

### Follows

- Follows go one way. A mutual follow is two follows.
- You can't follow yourself.
- Follow and unfollow are idempotent: tapping twice never creates a duplicate or an error.

### Likes

- Likes are on posts. One like per user per post. Liking and unliking are idempotent.
- Anyone can see a post's like count and the list of who liked it.

### Saves

- Users can save whole trips, individual posts, and places. Saving and unsaving are idempotent.
- A saved place needs a location row: a Mapbox place or a dropped pin (#94 LOC-2). Custom names without a pin can't be saved.
- Saving a place to your account is separate from adding it to a trip's bucket (see [Shared trips](#shared-trips)). Your saved places are your own, and a bucket belongs to the trip's members.
- Saved items show in the Saved tab on your own profile. Only you can see what you've saved.

### Notifications

- Notifications live in an in-app inbox, opened from a bell in the header that shows an unread count. Opening the inbox marks everything as read.
- The MVP has two kinds: a trip invite (with Accept and Decline) and "someone accepted your invite." An invite shows its current state, so one answered or cancelled elsewhere never offers Accept again.
- You're never notified about your own actions.
- There are no push notifications in the MVP.

### Comments

- Comments are on posts. They're 1 to 500 characters.
- Replies go one level deep, like Instagram. Replying to a reply attaches the new comment to the same top-level comment, with an @mention of the person being replied to.
- You can delete your own comments. Deleting a top-level comment deletes its replies.
- There's no comment editing in the MVP.

## Feed and navigation

- The tab bar is **Feed, Map, Create, Profile**. Saved is a tab inside your own profile, not its own tab.
- The stories bar sits at the top of the feed and shows active stories from people you follow.
- The feed has a **Friends** tab: published trips from people you follow, newest publish first. Each trip appears once, as a trip card, when it's published. Posts added to a trip after publishing show on that trip's card and page, but don't put the trip back at the top of the feed.
- There's no School tab, because we don't store schools.
- The Local tab is post-MVP. The feed API accepts `local` but returns an empty page for now.

## Map and search

- The map shows posts from published trips that have a Mapbox location, within the visible area.
- Tapping a location shows the published posts and trips tagged there.
- People search matches usernames and first and last names.
- Place search matches locations that have published posts.
- Searches need at least 2 characters.
- Natural-language search is post-MVP.

## Media limits

| Media | Limits |
|---|---|
| Post photos | Up to 30 photos and videos per post in total. The app resizes each photo so its longest edge is at most 2,048 px and saves it as JPEG at about 80% quality before uploading. The server rejects anything that isn't JPEG or is over 10 MB. |
| Post videos | Up to 60 seconds, MP4, and at most 100 MB. Video upload is its own ticket (#53 MEDIA-2). |
| Story | One photo, with the same rules as post photos. |
| Avatar | One photo, with the same rules as post photos, cropped to a square. |

## Text limits

| Text | Limit |
|---|---|
| Username | 3 to 30 characters, letters, numbers, `_` and `.` |
| First and last name | 1 to 50 characters each |
| Trip title | 1 to 100 characters |
| Trip destination | 1 to 100 characters |
| Trip description | Up to 1,000 characters |
| Post caption | Up to 2,200 characters |
| Comment | 1 to 500 characters |
| Story text | Up to 200 characters |

## Post-MVP

- Private accounts, follower-only content, and follow requests
- The Local feed tab and the social algorithm (#5)
- Natural-language search
- Interest tags, tagging users in posts, and several locations per post
- Trip ratings and leaderboards
- Video stories and story viewer tracking
- Notifications for likes, comments, and follows (the inbox exists, but only for trip invites)
- Push notifications
- Collaborators adding their own posts to a shared trip
- Scheduling bucket places onto days of a trip
- Transferring a trip's ownership
- Unpublishing a trip
- Editing comments

## Changes to the design notebook

These use cases in `SW TEAM 2 - Design Notebook` need to be updated to match this doc:

- **Use Case 1 (Create account):**
  - Replace "personal information stays in Clerk and is never stored in the app database" with: the `users` row stores email, first name, and last name.
  - Replace "display name" with first and last name.
  - Add the username rules from [Accounts](#accounts).
- **Use Case 2 (Create trip):**
  - Step 6: posts appear in followers' feeds once the trip is published, not as soon as each post is created.
  - Add Publish to the basic flow.
  - Resolve the open issue: everything is public once published.
  - Set the limits: 30 photos or videos per post, and the file sizes in [Media limits](#media-limits).
- **Use Case 5 (Post story):**
  - Replace "Each story belongs to exactly one trip" with: linking a trip is optional, and only an active trip can be linked.
  - "No active trip" extension: the user can post without a trip, or quickly create a trip that includes today. Picking a trip that isn't active isn't allowed.
  - After 24 hours, a story stays on the trip page only if Add to trip was chosen.
  - Resolve the open issues: no viewer tracking and no video stories in the MVP.
- **Use Case 6 (Like, comment, save):**
  - Likes and comments are on posts.
  - Saves cover both trips and posts.
  - Resolve the open issues: users can save both, comments have one level of replies, and there are no notifications for likes or comments in the MVP.
  - Saves also cover places (see [Saves](#saves)).
- **New use case (Plan a shared trip):** the owner invites collaborators, they accept from their notifications, and everyone adds places to the trip's bucket. The rules are in [Shared trips](#shared-trips) and [Notifications](#notifications).
