import { useEffect, useState } from 'react';

import { subscribeToDrafts, type PostDraft } from '@/lib/post-drafts';
import { isDraftInFlight } from '@/lib/post-upload';

// Post drafts saved on this phone for a trip, newest first. `stuck` are the ones
// that need a Retry: failed, or interrupted mid-upload when the app closed.
export function usePostDrafts(tripId?: string) {
  const [drafts, setDrafts] = useState<PostDraft[]>([]);

  useEffect(
    () =>
      subscribeToDrafts((all) =>
        setDrafts(
          all
            .filter((draft) => !tripId || draft.tripId === tripId)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        ),
      ),
    [tripId],
  );

  return {
    drafts,
    stuck: drafts.filter((draft) => draft.status === 'failed' || !isDraftInFlight(draft.id)),
  };
}
