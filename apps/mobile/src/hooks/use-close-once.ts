import { router } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Goes back from a modal screen, at most once. The story viewer can ask to
 * close twice (the last story ending as it's deleted), and going back twice
 * would leave the screen under it too.
 */
export function useCloseOnce() {
  const closed = useRef(false);
  return useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
}
