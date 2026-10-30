// Response shapes for the save endpoints (docs/architecture/likes-and-saves.md).
// Mirrored in shared-types.

// Returned by POST and DELETE /api/trips/:id/save and /api/posts/:id/save
export type SaveStatusResponse = {
  saved: boolean;
  saveCount: number;
};
