import { useCallback, useMemo, useState } from 'react';

import { logWeight, nearest, zoomLevelFor } from './geo';
import { aggregate } from './stats';
import { AREA_BY_ID, AREAS, COUNTRIES, COUNTRY_BY_ID, PLACES } from './mockData';
import { formatCount } from './theme';
import type {
  Audience,
  CategoryFilter,
  KindFilter,
  LatLng,
  PinItem,
  ResultKind,
  SearchResult,
  Stats,
  ZoomLevel,
} from './types';

interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface AroundItem {
  key: string;
  name: string;
  rating: number;
  pin: PinItem;
}

const normalize = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const KIND_ORDER: Record<ResultKind, number> = { destination: 0, place: 1, activity: 2 };

function statsLine(kind: ResultKind, st: Stats, audience: Audience) {
  if (audience === 'me') return st.logs > 0 ? `${st.logs} of your logs` : 'You haven’t logged this yet';
  if (audience === 'global') return `${formatCount(st.logs)} logs · ${formatCount(st.people)} travelers`;
  const verb = kind === 'activity' ? 'tried this' : st.people === 1 ? 'has been' : 'have been';
  return `${st.logs} logs · ${st.people} ${st.people === 1 ? 'friend' : 'friends'} ${verb}`;
}

export function aroundSubtitle(audience: Audience, st: Stats) {
  if (audience === 'me') return st.logs > 0 ? `${st.logs} travel logs from you` : 'You haven’t logged anything here yet';
  if (audience === 'friends') return `${st.logs} travel logs from ${st.people} friends`;
  return `${formatCount(st.logs)} travel logs from ${formatCount(st.people)} travelers`;
}

export function useExplore(initialRegion: Region) {
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState<Audience>('friends');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
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

  const results = useMemo<SearchResult[]>(() => {
    const q = normalize(query);
    if (!q) return [];
    const matches = (...fields: string[]) => fields.some((f) => normalize(f).includes(q));

    const destinations: SearchResult[] = AREAS.filter((a) =>
      matches(a.name, COUNTRY_BY_ID[a.countryId].name),
    ).map((a) => ({
      id: `area-${a.id}`,
      kind: 'destination',
      title: `${a.name}, ${COUNTRY_BY_ID[a.countryId].name}`,
      subtitle: `Destination · ${a.label}`,
      statsLine: statsLine('destination', areaStats[a.id], audience),
      target: { type: 'area', area: a },
    }));

    const placeResults: SearchResult[] = places
      .filter((pl) => {
        const area = AREA_BY_ID[pl.areaId];
        return matches(pl.name, pl.type, pl.neighborhood, area.name, COUNTRY_BY_ID[area.countryId].name);
      })
      .map((pl) => ({
        id: `place-${pl.id}`,
        kind: pl.kind,
        title: pl.name,
        subtitle:
          pl.kind === 'activity'
            ? `Thing to do · ${pl.type} · ${AREA_BY_ID[pl.areaId].name}`
            : `Place · ${pl.type} · ${pl.neighborhood}`,
        statsLine: statsLine(pl.kind, pl.stats[audience], audience),
        target: { type: 'place', place: pl },
      }));

    const logsOf = (r: SearchResult) =>
      r.target.type === 'area' ? areaStats[r.target.area.id].logs : r.target.place.stats[audience].logs;

    return [...destinations, ...placeResults]
      .filter((r) => kindFilter === 'all' || r.kind === kindFilter)
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || logsOf(b) - logsOf(a));
  }, [query, places, kindFilter, audience, areaStats]);

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
    level: view.level,
    onRegionChange,
    query, setQuery,
    audience, setAudience,
    kindFilter, setKindFilter,
    category, setCategory,
    selected, selectedArea, setSelectedId,
    pins, weightOf, results,
    around, topItems, locationLabel,
  };
}
