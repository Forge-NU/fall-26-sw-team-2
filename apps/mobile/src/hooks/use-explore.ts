import { useCallback, useMemo, useState } from 'react';

import { aggregate } from '@/components/explore/explore-stats';
import { formatCount } from '@/components/explore/explore-theme';
import { AREA_BY_ID, AREAS, COUNTRIES, COUNTRY_BY_ID, PLACES } from '@/components/explore/mock-data';
import type {
  Audience,
  CategoryFilter,
  LatLng,
  PinItem,
  Stats,
  ZoomLevel,
} from '@/components/explore/types';
import { logWeight, type MapRegion as Region, nearest, zoomLevelFor } from '@/lib/map-zoom';

export interface AroundItem {
  key: string;
  name: string;
  rating: number;
  pin: PinItem;
}

/** "1 friend", "3 friends", "1.2k travelers" */
const count = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`;

export function aroundSubtitle(audience: Audience, st: Stats) {
  if (audience === 'me') {
    return st.logs > 0 ? `${count(st.logs, 'travel log')} from you` : 'You haven’t logged anything here yet';
  }
  if (audience === 'friends') return `${count(st.logs, 'travel log')} from ${count(st.people, 'friend')}`;
  return `${count(st.logs, 'travel log')} from ${count(st.people, 'traveler')}`;
}

export function useExplore(initialRegion: Region) {
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState<Audience>('friends');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<{ level: ZoomLevel; center: LatLng }>(() => ({
    level: zoomLevelFor(initialRegion.latitudeDelta),
    center: { latitude: initialRegion.latitude, longitude: initialRegion.longitude },
  }));

  const onRegionChange = useCallback((r: Region) => {
    setView({ level: zoomLevelFor(r.latitudeDelta), center: { latitude: r.latitude, longitude: r.longitude } });
  }, []);

  // Category filters apply to places. The API should also return filtered area/country averages.
  const places = useMemo(
    () => PLACES.filter((pl) => category === 'all' || pl.category === category),
    [category],
  );

  // Ratings for areas and countries come from their places, so a pin only
  // shows a rating when there are places behind it (and filters apply too).
  const areaStats = useMemo(
    () => Object.fromEntries(AREAS.map((a) => [a.id, aggregate(places.filter((pl) => pl.areaId === a.id), audience)])),
    [places, audience],
  );
  const countryStats = useMemo(
    () =>
      Object.fromEntries(
        COUNTRIES.map((c) => [
          c.id,
          aggregate(places.filter((pl) => AREA_BY_ID[pl.areaId].countryId === c.id), audience),
        ]),
      ),
    [places, audience],
  );

  const pins = useMemo<PinItem[]>(() => {
    let items: PinItem[];
    if (view.level === 'world') {
      items = COUNTRIES.map((c) => ({
        key: `country-${c.id}`, kind: 'country', id: c.id, name: c.name,
        coordinate: c.coordinate, stats: countryStats[c.id], zoomDelta: c.zoomDelta,
      }));
    } else if (view.level === 'region') {
      items = AREAS.map((a) => ({
        key: `area-${a.id}`, kind: 'area', id: a.id, name: a.name,
        coordinate: a.coordinate, stats: areaStats[a.id], zoomDelta: 0.08,
      }));
    } else {
      items = places.map((pl) => ({
        key: `place-${pl.id}`, kind: 'place', id: pl.id, name: pl.name,
        coordinate: pl.coordinate, stats: pl.stats[audience], zoomDelta: 0.014, place: pl,
      }));
    }
    return items.filter((i) => i.stats.reviews > 0);
  }, [view.level, places, audience, areaStats, countryStats]);

  const weightOf = useMemo(() => logWeight(pins.map((pn) => pn.stats.reviews)), [pins]);

  const nearestArea = useMemo(() => nearest(AREAS, view.center) ?? AREAS[0], [view.center]);
  const nearestCountry = COUNTRY_BY_ID[nearestArea.countryId];

  const around = useMemo(() => {
    if (view.level === 'world') {
      return { title: 'Around the world', subtitle: aroundSubtitle(audience, aggregate(places, audience)) };
    }
    return { title: `Around ${nearestArea.name}`, subtitle: aroundSubtitle(audience, areaStats[nearestArea.id]) };
  }, [view.level, audience, nearestArea, places, areaStats]);

  // Highest-rated things in view, shown when the "Around" card is expanded.
  const topItems = useMemo<AroundItem[]>(() => {
    let candidates = pins;
    if (view.level === 'region') {
      candidates = pins.filter((pn) => AREA_BY_ID[pn.id]?.countryId === nearestArea.countryId);
    } else if (view.level === 'city') {
      candidates = pins.filter((pn) => pn.place?.areaId === nearestArea.id);
    }
    return [...candidates]
      .sort((a, b) => b.stats.rating - a.stats.rating || b.stats.reviews - a.stats.reviews)
      .slice(0, 3)
      .map((pn) => ({ key: pn.key, name: pn.name, rating: pn.stats.rating, pin: pn }));
  }, [pins, view.level, nearestArea]);

  const locationLabel =
    view.level === 'world'
      ? 'World'
      : view.level === 'region'
        ? nearestCountry.name
        : `${nearestArea.name} · ${nearestCountry.name}`;

  const selected = PLACES.find((pl) => pl.id === selectedId) ?? null;
  const selectedArea = selected ? AREA_BY_ID[selected.areaId] : null;

  return {
    onRegionChange,
    query, setQuery,
    audience, setAudience,
    category, setCategory,
    selected, selectedArea, setSelectedId,
    pins, weightOf,
    around, topItems, locationLabel,
  };
}
