import { useMutation, useQuery } from '@tanstack/react-query';
import type { PostResponse, UpdatePostRequest } from 'shared-types';

import { deletePost, getPost, updatePost } from '@/api/posts';
import { queryKeys } from '@/api/query-keys';
import { forgetDeletedPost, storeEditedPost } from '@/lib/post-cache';

export function usePost(id: string) {
  return useQuery({ queryKey: queryKeys.post(id), queryFn: ({ signal }) => getPost(id, signal) });
}

export function useUpdatePost(id: string) {
  return useMutation({
    // The edit screen shows the error itself
    meta: { toast: false },
    mutationFn: (body: UpdatePostRequest) => updatePost(id, body),
    onSuccess: storeEditedPost,
  });
}

export function useDeletePost(post: Pick<PostResponse, 'id' | 'tripId' | 'author'> | undefined) {
  return useMutation({
    meta: { toast: false },
    mutationFn: () => deletePost(post!.id),
    onSuccess: () => forgetDeletedPost(post!),
  });
}
