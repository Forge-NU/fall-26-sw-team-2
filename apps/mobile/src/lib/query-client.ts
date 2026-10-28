import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError, getErrorMessage } from '@/api/client';
import { showToast } from '@/lib/toast';

declare module '@tanstack/react-query' {
  interface Register {
    // true always toasts, false never does
    queryMeta: { toast?: boolean };
    mutationMeta: { toast?: boolean };
  }
}

function toastError(error: unknown) {
  showToast({ message: getErrorMessage(error), variant: 'error' });
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // A first load that fails shows the screen's own error state, so by default
    // only a refetch that fails while older data is still on screen toasts.
    onError: (error, query) => {
      if (query.meta?.toast ?? query.state.data !== undefined) toastError(error);
    },
  }),
  mutationCache: new MutationCache({
    // Pass meta: { toast: false } when the screen shows the error itself
    onError: (error, _variables, _onMutateResult, mutation) => {
      if (mutation.meta?.toast !== false) toastError(error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A 4xx won't change on a retry
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
});
