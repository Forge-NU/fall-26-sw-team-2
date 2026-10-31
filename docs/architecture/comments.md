# Comments

Issue: #50 (INT-2)
Product rules: [`mvp-decisions.md`](../product/mvp-decisions.md#comments) (#33 DOC-1)
Unblocks: #52 (INT-4, comments UI)

## Overview

- Comments are on posts and are 1 to 500 characters.
- Replies go one level deep, like Instagram. Replying to a reply stores the new comment under the same top-level comment, with an @mention of the person being replied to.
- You can delete your own comments, and only your own (not even the post's owner can delete someone else's). Deleting a top-level comment deletes its replies.
- There's no editing in the MVP.

## Data Model

### comments

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `post_id` | uuid FK → `posts` | Cascade |
| `author_id` | string FK → `users` | Cascade: deleting an account deletes its comments |
| `parent_comment_id` | uuid FK → `comments`, nullable | Null for a top-level comment. Cascade: deleting a top-level comment deletes its replies |
| `reply_to_user_id` | string FK → `users`, nullable | The @mention on a reply to a reply. **Set null**, not cascade (see below) |
| `body` | varchar(500) | |
| `created_at` | timestamp | |

Check constraints (raw SQL in the migration):
- `char_length(body) >= 1`. `VARCHAR(500)` caps the other end.
- `parent_comment_id <> id`

Indexes:
- `(post_id, parent_comment_id, created_at, id)` for a post's top-level comments, in order
- `(parent_comment_id, created_at, id)` for a comment's replies, in order
- `(author_id)` and `(reply_to_user_id)` for the account-deletion cascades

The database can't check that a reply's parent is a top-level comment on the same post, so the API does (see [Replies](#replies)).

**Why `reply_to_user_id` is set null:** every foreign key that means "this user owns it" cascades (#33). The mention doesn't mean Bob owns Alice's reply, so if Bob deletes his account, Alice's reply stays and loses the @mention. Bob's own comments are still deleted through `author_id`.

Prisma model: `apps/api/prisma/models/comment.prisma`.

### Replies

When a comment is created with a `parentCommentId`:

1. The parent has to exist (404) and be on the same post (400).
2. If the parent is a top-level comment, the new comment goes under it, with no mention.
3. If the parent is a reply, the new comment goes under **the parent's top-level comment**, and `replyTo` is set to the parent's author. If you're replying to your own reply, there's no mention.

So `parent_comment_id` always points at a top-level comment, and threads never nest more than one level.

The body isn't changed: the app shows `replyTo` as the @mention in front of the text.

### Deletion

| What's deleted | What happens to comments |
|---|---|
| A post (or its trip) | Its comments and replies are deleted |
| A top-level comment | Its replies are deleted |
| A reply | Only that reply |
| An account | Their comments are deleted (and replies under their top-level comments). Mentions of them become `replyTo: null` |

## Visibility

Comments follow the post's trip ([`trip-rules.ts`](../../apps/api/src/trips/trip-rules.ts)). Anyone who can see a post can read and add comments, and a draft's posts can only be commented on by the owner.

- Commenting on, or listing the comments of, a post that doesn't exist or that you can't see returns `404` with `"message": "Post not found"`. That includes a post deleted while you were writing.
- A comment on a post you can't see is `404 Comment not found`.

## API Contracts

All endpoints are under `/api` and need a Clerk session. Errors use the shared shape in [`api-conventions.md`](api-conventions.md#error-response-shape).

Lists use the cursor pagination in [`itinerary-schema.md`](itinerary-schema.md#api-contracts) (`?cursor=&limit=1-50`, default 20, `{ items, nextCursor }`). The cursor is a comment ID, and one from another list returns 400. The helper is the stand-in until API-2 (#90).

Types are in `shared-types` (`CommentResponse`, `CreateCommentRequest`) and `apps/api/src/comments/comment.types.ts`.

### `Comment`

```json
{
  "id": "uuid",
  "postId": "uuid",
  "parentCommentId": "uuid" | null,
  "author": UserSummary,
  "replyTo": UserSummary | null,
  "body": "Good tip, adding it to my list.",
  "replyCount": 2,
  "createdAt": "2026-09-18T17:05:00.000Z"
}
```

- `parentCommentId` is null for a top-level comment.
- `replyTo` is the @mention on a reply to a reply, and null otherwise.
- `replyCount` is the number of replies under a top-level comment. It's always 0 for a reply.

`Post` responses also gain `commentCount`: every comment on the post, replies included.

### `POST /api/posts/:id/comments`

Request:
```json
{ "body": "What a view", "parentCommentId": "uuid" }
```

- `body`: 1 to 500 characters after trimming, counted the way Postgres counts (so ❤️ is 2).
- `parentCommentId` (optional): the comment you're replying to. See [Replies](#replies).

Response `201`: the new `Comment`. For a reply to a reply, `parentCommentId` is the top-level comment, not the one you sent.

Errors:
- `400`: the body is empty or over 500 characters, or the parent comment is on another post
- `404`: `Post not found` (the post doesn't exist, was deleted, or you can't see it), or `Comment not found` (the parent comment doesn't exist)

### `GET /api/posts/:id/comments`

The post's top-level comments, oldest first, each with `replyCount`. Replies aren't included; load them with the endpoint below.

Response `200`: `{ "items": Comment[], "nextCursor": "uuid" | null }`

Errors: `404 Post not found`, and `400` for a cursor that isn't a top-level comment on this post.

### `GET /api/comments/:id/replies`

A top-level comment's replies, oldest first.

Response `200`: `{ "items": Comment[], "nextCursor": "uuid" | null }`

Errors: `404 Comment not found`, `400` if the comment is itself a reply (replies don't have replies), and `400` for a cursor that isn't one of its replies.

### `DELETE /api/comments/:id`

Deletes your comment. If it's a top-level comment, its replies are deleted too.

Response `204`.

Errors: `403` if it isn't your comment (even on your own post), and `404 Comment not found`.

## Seed data

`npx prisma db seed` adds a reply thread on Maya's first Lisbon post: Priya comments, Maya replies, and Alex replies to Maya's reply. That last one is stored under Priya's comment with `replyTo` set to Maya. There are a few more top-level comments elsewhere.

## Not in the MVP

- Editing comments (cut in #33)
- Notifications for comments (cut in #33)
- Letting a post's owner delete other people's comments on it
