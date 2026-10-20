// Uploads photos and tracks how it's going, for screens that don't need their
// own queue or drafts (e.g. the avatar on Edit profile):
//
//   const avatar = usePhotoUpload('avatar');
//   const [uploaded] = (await avatar.upload([photo])) ?? [];
//   if (uploaded) await updateMe({ avatarKey: uploaded.s3Key });
//
// upload() resolves to every photo with its key once all of them succeed, or
// null if any failed. retry() then redoes only the failed ones.
import { useCallback, useMemo, useRef, useState } from 'react';
import type { UploadPurpose } from '@/api/types';

import type { PickedPhoto } from '@/lib/media/pick-photo';
import { uploadPhoto } from '@/lib/media/upload-photo';

export type PhotoUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export type PhotoUploadItem = PickedPhoto & {
  status: PhotoUploadStatus;
  // 0 to 1
  progress: number;
  s3Key: string | null;
  error: unknown;
};

export type UploadedPhoto = PickedPhoto & { s3Key: string };

export type PhotoUploadState = 'idle' | 'uploading' | 'uploaded' | 'failed';

function toItem(photo: PickedPhoto): PhotoUploadItem {
  return { ...photo, status: 'pending', progress: 0, s3Key: null, error: null };
}

export function usePhotoUpload(purpose: UploadPurpose) {
  const [items, setItems] = useState<PhotoUploadItem[]>([]);
  const itemsRef = useRef<PhotoUploadItem[]>([]);
  const running = useRef(false);

  const commit = useCallback((next: PhotoUploadItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (index: number, changes: Partial<PhotoUploadItem>) => {
      commit(itemsRef.current.map((item, i) => (i === index ? { ...item, ...changes } : item)));
    },
    [commit],
  );

  // Uploads every item that isn't uploaded yet, one at a time
  const run = useCallback(async (): Promise<UploadedPhoto[] | null> => {
    if (running.current) throw new Error('An upload is already running');
    running.current = true;
    try {
      for (const [index, item] of itemsRef.current.entries()) {
        if (item.status === 'uploaded') continue;
        patch(index, { status: 'uploading', progress: 0, error: null });
        try {
          const s3Key = await uploadPhoto(item.uri, purpose, {
            onProgress: (progress) => patch(index, { progress }),
          });
          patch(index, { status: 'uploaded', progress: 1, s3Key });
        } catch (error) {
          patch(index, { status: 'failed', error });
        }
      }
      const done = itemsRef.current;
      if (done.some((item) => item.status !== 'uploaded')) return null;
      return done.map(({ uri, width, height, s3Key }) => ({ uri, width, height, s3Key: s3Key! }));
    } finally {
      running.current = false;
    }
  }, [patch, purpose]);

  const upload = useCallback(
    (photos: PickedPhoto[]) => {
      if (running.current) throw new Error('An upload is already running');
      commit(photos.map(toItem));
      return run();
    },
    [commit, run],
  );

  const reset = useCallback(() => {
    if (!running.current) commit([]);
  }, [commit]);

  const summary = useMemo(() => {
    const total = items.length;
    const uploaded = items.filter((item) => item.status === 'uploaded').length;
    const failed = items.filter((item) => item.status === 'failed').length;
    const busy = items.some((item) => item.status === 'uploading' || item.status === 'pending');
    const state: PhotoUploadState =
      total === 0 ? 'idle' : busy ? 'uploading' : failed > 0 ? 'failed' : 'uploaded';
    // Overall 0 to 1, counting the photo in progress by how far along it is
    const progress = total === 0 ? 0 : items.reduce((sum, item) => sum + item.progress, 0) / total;
    return { state, total, uploaded, failed, progress };
  }, [items]);

  return { items, ...summary, upload, retry: run, reset };
}
