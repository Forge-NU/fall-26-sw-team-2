// Upload limits from DOC-1 (docs/product/mvp-decisions.md). Posts, stories and
// avatars all use the post photo rules. Video is MEDIA-2 (#53).
export const UPLOAD_PURPOSES = ['post', 'story', 'avatar'] as const;
export const UPLOAD_CONTENT_TYPES = ['image/jpeg'] as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

// Folder under users/{userId}/ for each purpose. The post and story services
// check keys against these prefixes.
export const UPLOAD_FOLDERS = {
  post: 'posts',
  story: 'stories',
  avatar: 'avatars',
} as const;
