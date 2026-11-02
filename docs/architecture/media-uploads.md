# Media Uploads

Status: Built (backend and mobile)
Issue: #38 (MEDIA-1)

## Overview

Photos go straight from the app to S3 through a presigned PUT URL. The API never handles the file itself. The app asks the API for an upload URL, uploads the file to it, and then sends the returned `s3Key` to the post, story, or profile endpoint.

Posts, stories, and avatars all use this one endpoint. Video is #53 (MEDIA-2).

```mermaid
sequenceDiagram
    participant App
    participant API
    participant S3
    App->>API: POST /api/media/uploads { purpose, contentType, fileSize }
    API-->>App: { s3Key, uploadUrl, expiresAt }
    App->>S3: PUT uploadUrl (Content-Type, Content-Length must match)
    S3-->>App: 200
    App->>API: POST /api/posts { media: [{ s3Key, ... }] }
```

## Limits

From DOC-1 ([`docs/product/mvp-decisions.md`](../product/mvp-decisions.md)). Stories and avatars use the post photo rules.

| | Rule |
|---|---|
| Type | `image/jpeg` only |
| Size | 1 byte to 10 MB (10,485,760 bytes) |
| URL expiry | 15 minutes |

The app resizes each photo so its longest edge is at most 2,048 px and saves it as JPEG at about 80% quality before asking for a URL. The server enforces the type and size, not just the app:

1. The API rejects a request with any other `contentType` or a `fileSize` over 10 MB (`400`).
2. The content type and size are signed into the URL, so S3 rejects (`403`) an upload whose `Content-Type` or `Content-Length` header doesn't match the request.

## Key scheme

```
users/{userId}/posts/{uuid}.jpg
users/{userId}/stories/{uuid}.jpg
users/{userId}/avatars/{uuid}.jpg
```

- The server picks the key. The app can't choose one.
- The post and story endpoints check that each key starts with the current user's prefix (`users/{userId}/posts/` or `users/{userId}/stories/`), so a user can't attach someone else's upload.
- Everything a user uploads is under `users/{userId}/`, so account deletion can remove it all with one prefix delete (see [`data-model.md`](data-model.md#s3-objects)).

## Endpoint

### `POST /api/media/uploads`

Signed-in users only.

Request:
```json
{ "purpose": "post", "contentType": "image/jpeg", "fileSize": 2483021 }
```

- `purpose`: `post`, `story`, or `avatar`. Picks the folder in the key.
- `contentType`: `image/jpeg`.
- `fileSize`: the size in bytes of the file the app will upload, 1 to 10,485,760.

Response `201`:
```json
{
  "s3Key": "users/user_123/posts/6f1c2a4e-8b0d-4c57-9f3e-2d7a1b9c0e55.jpg",
  "uploadUrl": "https://<bucket>.s3.us-east-1.amazonaws.com/users/user_123/posts/...",
  "expiresAt": "2026-10-20T12:15:00.000Z"
}
```

Errors: `400` for an invalid body (see [API conventions](api-conventions.md)), `401` when not signed in.

Types are `CreateUploadRequest` and `CreateUploadResponse` in `shared-types`.

### Uploading to the URL

```
PUT {uploadUrl}
Content-Type: image/jpeg
Content-Length: {fileSize}

<file bytes>
```

- Both headers must match the request exactly.
- A URL is for one file. To retry an upload whose URL has expired, ask for a new one.
- Locally, without `S3_BUCKET_NAME` set, `uploadUrl` points at `https://media.invalid/<key>`, which never accepts an upload.

## Mobile

Every photo goes pick → prepare → upload:

```ts
import { choosePhoto } from '@/lib/media/pick-photo';     // or takePhoto, or choosePhotos (multi-select)
import { preparePhoto } from '@/lib/media/prepare-photo';
import { uploadPhoto } from '@/lib/media/upload-photo';

const picked = await choosePhoto();
if (picked.status !== 'picked') return;
const photo = await preparePhoto(picked.photo);            // JPEG, longest edge 2,048 px, ~80%
const s3Key = await uploadPhoto(photo.uri, 'post', {
  onProgress: (fraction) => setProgress(fraction),         // 0 to 1
});
```

- **`preparePhoto` is required.** Library photos are often HEIC or PNG, and the server only takes JPEG. Don't fall back to the original photo if it fails.
- **`uploadPhoto(uri, purpose, options)`** reads the file, asks the API for a URL with the file's exact size, and PUTs it to S3 with progress. Network errors and 5xx responses are retried 2 s, 8 s and 30 s apart. Pass `retryDelaysMs: []` for a single attempt when the caller has its own retry loop, like the story queue. An expired URL (S3 `403`) gets a new one on the next attempt. A file over 10 MB throws `PhotoTooLargeError`, and a file that isn't a JPEG throws `NotJpegError`, both without asking for a URL.
- **`uploadPhotos(uris, purpose, { onProgress })`** uploads several photos one at a time and returns a result for each, in order. One failure doesn't stop the rest, so a retry only needs the failed ones.
- **`usePhotoUpload(purpose)`** is a hook for screens without their own queue or drafts, like the avatar on Edit profile. `upload(photos)` resolves to the photos with their keys, or `null` if any failed. `retry()` redoes only the failed ones. It also returns `items` (status and progress for each photo), `state`, and overall `progress`.
- **Avatars:** pass `{ square: true }` to `choosePhoto` / `takePhoto` and to `preparePhoto`. The picker only enforces the crop on Android, so `preparePhoto` center-crops too.
- **Mock mode** (`USE_MOCK_API`) fakes the URL and the upload, with progress. It's off unless `EXPO_PUBLIC_USE_MOCK_API=true` is in `.env`, so never set that in a build. Set `EXPO_PUBLIC_MOCK_UPLOAD_FAILURE_RATE=1` to make every upload fail.
- The S3 PUT uses `XMLHttpRequest`, not the API client: `fetch` can't report upload progress, and an `Authorization` header would make S3 reject the request.

## Bucket setup (INF-1, #34)

The code needs no changes once the bucket exists. Set these on the API:

- `S3_BUCKET_NAME`: the media bucket.
- `AWS_REGION`: the bucket's region.

The API's credentials (the ECS task role on staging, or your AWS profile locally) need `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/users/*`. A presigned URL can only do what the credentials that signed it can do.

The bucket stays private. The app uploads from native code, so the bucket doesn't need CORS for uploads. It only needs CORS if the app's web build uploads too.

## Orphaned uploads

An upload that never ends up in a post, story, or profile stays in S3. Nothing cleans these up yet. They're under the user's prefix, so account deletion still removes them.
