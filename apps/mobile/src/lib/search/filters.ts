import type { SearchRequest, SearchSort, SearchType } from 'shared-types';

export type SearchTab = 'all' | SearchType;
export type Coordinate = { latitude: number; longitude: number };
export type DistanceSource = 'nearMe' | 'mapCenter';
export type LocationPermission = 'undetermined' | 'granted' | 'denied';
export type SearchFilters = {
  from: string | null;
  to: string | null;
  minRating: 3 | 4 | 4.5 | null;
  radiusKm: 1 | 5 | 10 | 50 | null;
  distanceSource: DistanceSource;
  sort: SearchSort;
};
export type SearchCenters = {
  nearMe?: Coordinate | null;
  mapCenter?: Coordinate | null;
  permission: LocationPermission;
};

export const SEARCH_TABS = ['all', 'people', 'places', 'trips', 'posts'] as const;
export function defaultSearchFilters(): SearchFilters {
  return { from: null, to: null, minRating: null, radiusKm: null, distanceSource: 'mapCenter', sort: 'relevance' };
}

export function applicableFilters(tab: SearchTab) {
  return {
    dates: tab === 'all' || tab === 'trips' || tab === 'posts',
    rating: tab === 'all' || tab === 'places' || tab === 'posts',
    distance: tab !== 'people',
  };
}

// One date range is one filter; selecting a distance source alone isn't a filter.
export function activeFilterCount(filters: SearchFilters, tab: SearchTab) {
  const visible = applicableFilters(tab);
  return Number(visible.dates && Boolean(filters.from || filters.to))
    + Number(visible.rating && filters.minRating !== null)
    + Number(visible.distance && filters.radiusKm !== null)
    + Number(filters.sort !== 'relevance');
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

export function filterError(filters: SearchFilters, tab: SearchTab, centers: SearchCenters): string | null {
  const visible = applicableFilters(tab);
  if (visible.dates) {
    if ((filters.from && !isDate(filters.from)) || (filters.to && !isDate(filters.to))) return 'Choose valid dates.';
    if (filters.from && filters.to && filters.from > filters.to) return 'End date must be on or after start date.';
  }
  if (visible.distance && filters.radiusKm !== null) {
    if (filters.distanceSource === 'nearMe' && centers.permission !== 'granted') {
      return centers.permission === 'denied'
        ? 'Location access is off. Use the map’s center instead.'
        : 'Allow location access to use Near me.';
    }
    const center = centers[filters.distanceSource];
    if (!center) return filters.distanceSource === 'nearMe' ? 'Your location is not available yet.' : 'Choose a center on the map first.';
    if (!Number.isFinite(center.latitude) || Math.abs(center.latitude) > 90
      || !Number.isFinite(center.longitude) || Math.abs(center.longitude) > 180) return 'Choose a valid location.';
  }
  return null;
}

export function buildSearchRequest(q: string, tab: SearchTab, filters: SearchFilters, centers: SearchCenters): SearchRequest {
  const error = filterError(filters, tab, centers);
  if (error) throw new Error(error);
  const visible = applicableFilters(tab);
  const request: SearchRequest = { q: q.trim().replace(/\s+/g, ' '), sort: filters.sort };
  if (tab !== 'all') request.type = tab;
  if (visible.dates && filters.from) request.from = filters.from;
  if (visible.dates && filters.to) request.to = filters.to;
  if (visible.rating && filters.minRating !== null) request.minRating = filters.minRating;
  if (visible.distance && filters.radiusKm !== null) {
    const center = centers[filters.distanceSource]!;
    request.lat = center.latitude;
    request.lng = center.longitude;
    request.radiusKm = filters.radiusKm;
  }
  return request;
}

export function hasSearchWords(q: string) {
  return [...q.trim()].length >= 2;
}
