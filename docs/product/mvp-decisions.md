# MVP Product Decisions

Status: Decided, for review
Issue: #33 (DOC-1)
Decided: 2026-10-11 and 2026-10-12
Updated: 2026-11-13, decisions since DOC-1 (#119 DOC-2) and shared trips, buckets, saved places and notifications (#129 DOC-3)

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

### Trip page

- The trip page shows a cover photo: the first photo of the trip's first post. A trip with no posts shows its destination instead.
- There's no map on the trip page in the MVP. The trip map from wireframe 02 is post-MVP.

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
- Only Mapbox places can be added. Custom locations can't, with or without a dropped pin, because a pin belongs to the one post or story that made it (see [Locations](#locations)).
- The bucket is an unordered list. Bucket places aren't scheduled onto days of the trip.
- When a collaborator leaves or is removed, the places they added stay in the bucket.

### Planning list

The Trips section of the Saved tab has a **Planning** list of the trips you own or have joined. Each one opens to its bucket. Trips you've joined don't show on your profile.

## Posts

A post is media within a trip, with a caption and a location.

- Every post belongs to exactly one trip, and posts can't exist without a trip. A post's author is always its trip's owner.
- A post can have one location, and it's optional. It can be a Mapbox place, a custom name, or nothing (see [Locations](#locations)). A post with no location shows no location row, isn't on the map, and can't be rated. The owner can add, change, or remove it later.
- Each post has a date (the day it happened). It's required, it must fall within the trip's dates, and it defaults to today if today is within them, otherwise to the trip's start date.
- A trip shows its posts in date order, oldest first. Posts on the same date are shown in the order they were added.
- Media: 1 to 30 photos or videos per post, in the order the user picked them (see [Media limits](#media-limits)).
- Caption: optional, up to 2,200 characters.
- Rating: optional, 1 to 5 stars, rating the post's place (#91 RATE-1, #92 RATE-2). Only a post with a Mapbox place or a dropped pin can be rated. A custom name without a pin, or no location, can't, and switching to either clears the rating.
- Only the trip's owner can add, edit, or delete posts in it. Collaborators on a shared trip can't (see [Shared trips](#shared-trips)). Deleting a post permanently deletes its media (including the S3 objects), likes, saves, and comments.
- A post isn't created until every upload has succeeded. If an upload fails, the app keeps the post as a local draft with a Retry option.

Cut from the MVP: interest tags, tagging other users in posts, several locations per post, and trip ratings.

## Locations

- A location is either a **Mapbox place** (picked from search, stored with its Mapbox ID, name, and coordinates) or a **custom location** (a name the user typed when search had no result).
- A custom location can have a **dropped pin** (#94 LOC-2). The user places it on a map, and the app warns that anyone can see the pin.
  - A pinned custom location gets coordinates, so it shows on the map, appears in post and trip distance filters, and can be rated.
  - Each pin is its own location row and belongs to the one post or story that made it. Pins are never merged, and deleting the post or story, or changing its location, deletes the pin.
  - Pins stay out of place search, saved places and trip buckets, because they're personal spots rather than shared places.
- A custom name without a pin has no coordinates, so it shows on the post but not on the map, and it can't be rated.
- Two posts tagged at the same Mapbox place share one location row. That shared row is what lets the map and place search group posts by place.
- A place's rating is the average of the ratings on posts at that place in published trips, shown with how many ratings it has (#91 RATE-1).
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
- Only Mapbox places can be saved. Custom locations can't, with or without a dropped pin (see [Locations](#locations)).
- Saving a place to your account is separate from adding it to a trip's bucket (see [Shared trips](#shared-trips)). Your saved places are your own, and a bucket belongs to the trip's members.
- Saved items show in the Saved tab in the bottom bar (see [Feed and navigation](#feed-and-navigation)), with sections for trips, posts and places. Only you can see what you've saved.

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

- The bottom bar is **Feed, Saved, Post, Map, Profile** (decided 2026-10-27, matching #81 and #51 INT-3).
  - Saved is its own tab, not a tab inside your profile. There's one Saved, and the profile has no Saved tab.
  - Post opens a chooser for a new post or a new story, instead of switching tabs.
- The header has a notifications bell (see [Notifications](#notifications)). Its Leaderboard button stays hidden until leaderboards exist (#97 UI-3, see [Post-MVP](#post-mvp)).
- The stories bar sits at the top of the feed and shows active stories from people you follow.
- **Friends** is the only feed tab in the MVP: published trips from people you follow, newest publish first. Each trip appears once, as a trip card, when it's published. Posts added to a trip after publishing show on that trip's card and page, but don't put the trip back at the top of the feed.
- There's no School tab, because we don't store schools.
- The FYP and Local tabs are post-MVP (#118 FEED-3, #59, #66). The feed API accepts `local` but returns an empty page for now.

## Map and search

- The map shows posts from published trips that have coordinates (a Mapbox place or a dropped pin), within the visible area.
- Tapping a location shows the published posts and trips tagged there.
- Search covers people, places, published trips and posts (#93 SRCH-3, #96 SRCH-4):
  - **People** match on username and first and last name.
  - **Places** are locations with posts in published trips, with their post count and rating. Dropped pins are left out.
  - **Trips** are published trips, matched on title, destination and description.
  - **Posts** are posts in published trips, matched on caption and location name.
- Search results can be filtered:

  | Filter | Applies to | Matches when |
  |---|---|---|
  | Dates | Trips, posts | The trip's dates overlap the range, or the post's date is inside it |
  | Minimum rating | Places, posts | The place's average rating is at least this |
  | Distance | Places, posts, trips | The location is within the distance. A trip matches if any of its posts' locations is. |

- Results sort by relevance (the default) or newest.
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
- The FYP feed tab (#118 FEED-3), the Local feed tab, and the social algorithm (#5)
- Natural-language search
- Interest tags, tagging users in posts, and several locations per post
- Trip ratings and leaderboards. Post ratings of places are in the MVP (see [Posts](#posts)), and the header's Leaderboard button stays hidden until leaderboards exist.
- A map on the trip page (wireframe 02)
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
  - A post's location is optional (see [Posts](#posts)).
  - Posts can rate their place, 1 to 5 stars, and a custom location can have a dropped pin (see [Posts](#posts) and [Locations](#locations)).
  - The trip page shows a cover photo and no trip map (see [Trip page](#trip-page)).
- **Use Case 5 (Post story):**
  - Replace "Each story belongs to exactly one trip" with: linking a trip is optional, and only an active trip can be linked.
  - "No active trip" extension: the user can post without a trip, or quickly create a trip that includes today. Picking a trip that isn't active isn't allowed.
  - After 24 hours, a story stays on the trip page only if Add to trip was chosen.
  - Resolve the open issues: no viewer tracking and no video stories in the MVP.
- **Use Case 6 (Like, comment, save):**
  - Likes and comments are on posts.
  - Saves cover both trips and posts.
  - Resolve the open issues: users can save both, comments have one level of replies, and there are no notifications for likes or comments in the MVP.
  - Saves also cover places (see [Saves](#saves)), and saved items are in the Saved tab in the bottom bar, not on the profile.
- **Search and feed use cases:** search covers people, places, published trips and posts with date, rating and distance filters, and Friends is the only feed tab (see [Map and search](#map-and-search) and [Feed and navigation](#feed-and-navigation)).
- **New use case (Plan a shared trip):** the owner invites collaborators, they accept from their notifications, and everyone adds places to the trip's bucket. The rules are in [Shared trips](#shared-trips) and [Notifications](#notifications).
