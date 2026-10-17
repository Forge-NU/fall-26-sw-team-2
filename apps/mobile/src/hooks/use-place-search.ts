import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { searchPlaces } from '@/api/locations';

export const MIN_PLACE_QUERY = 2;
const DEBOUNCE_MS = 250;

// Place search for the location picker. Waits for typing to pause and for at
// least 2 characters (DOC-1) before calling Mapbox.
export function usePlaceSearch(query: string, sessionToken: string) {
  const [debounced, setDebounced] = useState(query.trim());

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const enabled = debounced.length >= MIN_PLACE_QUERY;
  const result = useQuery({
    queryKey: ['places', 'search', debounced, sessionToken],
    queryFn: () => searchPlaces(debounced, sessionToken),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    suggestions: enabled ? (result.data ?? []) : [],
    searching: enabled && (result.isFetching || debounced !== query.trim()),
    error: enabled ? result.error : null,
  };
}
