import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { savedPlaces, useSavedPlaces } from '@/components/saved/saved-places';
import { AudienceToggle } from '@/components/explore/audience-toggle';
import { FiltersMenu } from '@/components/explore/filters-menu';
import { AroundCard } from '@/components/explore/map-cards';
import { MapControls } from '@/components/explore/map-controls';
import { PlaceActions, PlaceDetailBody } from '@/components/explore/place-detail';
import { RatingPin } from '@/components/explore/rating-pin';
import { SearchBar } from '@/components/explore/search-bar';
import { SearchResultsPanel } from '@/components/search/search-results-panel';
import { SearchFiltersSheet } from '@/components/search/search-filters-sheet';
import { BottomSheet } from '@/components/bottom-sheet';
import { TripCard } from '@/components/content/trip-card';
import { PostCard } from '@/components/content/post-card';
import { Button } from '@/components/ui/button';
import type { SearchPlace, TripResponse, PostResponse } from 'shared-types';
import type { Coordinate, LocationPermission } from '@/lib/search/filters';
import { useSearch } from '@/hooks/use-search';
import { Sheet } from '@/components/explore/sheet';
import { mapStyle } from '@/components/explore/map-style';
import { LISBON_REGION, PLACES } from '@/components/explore/mock-data';
import { colors, formatCount, radius, shadow } from '@/components/explore/explore-theme';
import type { LatLng, PinItem, Place } from '@/components/explore/types';
import { useToast } from '@/components/ui/toast-provider';
import { useExplore } from '@/hooks/use-explore';
import { regionFor, zoomRegion } from '@/lib/map-zoom';

const SEARCH_BAR_HEIGHT = 56;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const mapRef = useRef<MapView>(null);
  // Where the map is heading: set when we animate it, and reset to the real region
  // once it settles, so taps made mid-animation build on the region it's going to.
  const targetRegionRef = useRef<Region>(LISBON_REGION);
  const [sheetHeight] = useState(() => new Animated.Value(0));
  const [screenH, setScreenH] = useState(700);
  const [screenW, setScreenW] = useState(390);
  const [idleStackH, setIdleStackH] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [locationOn, setLocationOn] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focused, setFocused] = useState(true);
  const [searchFiltersOpen, setSearchFiltersOpen] = useState(false);
  const [permission, setPermission] = useState<LocationPermission>('undetermined');
  const [nearMe, setNearMe] = useState<Coordinate | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinate>(LISBON_REGION);
  const [locating, setLocating] = useState(false);
  const [previewContent, setPreviewContent] = useState<{ trip: TripResponse } | { post: PostResponse } | null>(null);

  const ex = useExplore(LISBON_REGION);
  const saved = useSavedPlaces();
  const { setSelectedId, setQuery, onRegionChange } = ex;

  const headerTop = insets.top + 8;
  const half = Math.round(screenH * 0.52);
  const full = Math.max(half + 1, Math.round(screenH - headerTop - SEARCH_BAR_HEIGHT - 10));
  const snapPoints = useMemo(() => [half, full], [half, full]);

  const mode = ex.selected ? 'detail' : searchOpen || ex.query.trim() ? 'results' : 'idle';
  const searchActive = focused && mode === 'results';
  const search = useSearch({ active: searchActive, centers: { permission, nearMe, mapCenter } });
  const setSearchQuery = search.setQuery;
  useEffect(() => { if (searchActive) setSearchQuery(ex.query); }, [ex.query, searchActive, setSearchQuery]);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => { setFocused(false); setSearchOpen(false); setSearchFiltersOpen(false); setQuery(''); };
  }, [setQuery]));

  useEffect(() => {
    if (mode === 'idle') sheetHeight.setValue(0);
  }, [mode, sheetHeight]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Controls ride on top of the sheet, then fade once it's dragged past half height.
  const lift = sheetHeight.interpolate({ inputRange: [0, half], outputRange: [0, -half], extrapolate: 'clamp' });
  const fadeWithSheet = sheetHeight.interpolate({
    inputRange: [half + 20, half + 90],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const animateTo = useCallback((region: Region, duration: number) => {
    targetRegionRef.current = region;
    mapRef.current?.animateToRegion(region, duration);
  }, []);

  const aspect = screenW / screenH;
  const flyTo = useCallback(
    (c: LatLng, delta: number, leaveRoomForSheet = false) => {
      const center = { latitude: c.latitude - (leaveRoomForSheet ? delta * 0.22 : 0), longitude: c.longitude };
      animateTo(regionFor(center, delta, aspect), 450);
    },
    [animateTo, aspect],
  );

  const selectPlace = useCallback(
    (place: Place) => {
      Keyboard.dismiss();
      setFiltersOpen(false);
      flyTo(place.coordinate, 0.014, true);
      setSelectedId(place.id);
    },
    [flyTo, setSelectedId],
  );

  // Countries and areas zoom in one level; places open their details.
  const onPinPress = useCallback(
    (pin: PinItem) => {
      if (pin.place) selectPlace(pin.place);
      else flyTo(pin.coordinate, pin.zoomDelta);
    },
    [flyTo, selectPlace],
  );

  const openSearchPlace = (place: SearchPlace) => {
    Keyboard.dismiss();
    setQuery(''); setSearchOpen(false);
    const known = PLACES.find(item => item.id === place.id);
    if (known) selectPlace(known);
    else flyTo(place, 0.014, true);
  };

  const zoomBy = (factor: number) => animateTo(zoomRegion(targetRegionRef.current, factor), 250);

  const locate = async (forSearch = false) => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status === 'granted' ? 'granted' : 'denied');
      if (status !== 'granted') {
        if (forSearch) search.setFilters({ ...search.filters, distanceSource: 'mapCenter' });
        showToast({ message: 'Allow location access in Settings to see where you are.', variant: 'error' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationOn(true);
      setNearMe({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (!forSearch) flyTo(pos.coords, 0.02);
    } catch {
      if (forSearch) search.setFilters({ ...search.filters, distanceSource: 'mapCenter' });
      // Location Services off, or the position request failed or timed out
      showToast({ message: 'Couldn’t find your location. Check that Location Services is on.', variant: 'error' });
    } finally { setLocating(false); }
  };

  const calloutLine = (pin: PinItem) => {
    const friends = pin.place?.stats.friends.people ?? 0;
    if (friends > 0) return `${friends} ${friends === 1 ? 'friend' : 'friends'} visited`;
    return `${formatCount(pin.place?.stats.global.reviews ?? 0)} reviews`;
  };

  const selected = ex.selected;

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        setScreenH(e.nativeEvent.layout.height);
        setScreenW(e.nativeEvent.layout.width);
      }}
    >
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={LISBON_REGION}
        customMapStyle={mapStyle}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        showsUserLocation={locationOn}
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}
        onRegionChangeComplete={(r) => {
          targetRegionRef.current = r;
          setMapCenter({ latitude: r.latitude, longitude: r.longitude });
          onRegionChange(r);
        }}
        onPress={(e) => {
          if (e.nativeEvent.action === 'marker-press') return;
          Keyboard.dismiss();
          setFiltersOpen(false);
          setSelectedId(null);
        }}
      >
        {ex.pins.map((pin) => (
          <RatingPin
            // Remount when selection changes so iOS doesn't keep the old pin
            // "selected" and ignore the next tap on it.
            key={`${pin.key}-${pin.kind === 'place' && selected?.id === pin.id ? 'on' : 'off'}`}
            item={pin}
            weight={ex.weightOf(pin.stats.reviews)}
            selected={pin.kind === 'place' && selected?.id === pin.id}
            calloutLine={pin.kind === 'place' ? calloutLine(pin) : undefined}
            onPress={onPinPress}
          />
        ))}
      </MapView>

      {mode === 'idle' && (
        <View style={styles.idleStack} onLayout={(e) => setIdleStackH(e.nativeEvent.layout.height)}>
          <AroundCard
            title={ex.around.title}
            subtitle={ex.around.subtitle}
            items={ex.topItems}
            onSelect={(it) => onPinPress(it.pin)}
          />
        </View>
      )}

      <MapControls
        bottom={mode === 'idle' ? idleStackH + 28 : 12}
        translateY={lift}
        opacity={fadeWithSheet}
        onZoomIn={() => zoomBy(0.5)}
        onZoomOut={() => zoomBy(2)}
        onLocate={() => { void locate(); }}
      />

      {mode !== 'idle' && (
        <Sheet
          height={sheetHeight}
          snapPoints={snapPoints}
          snapIndex={mode === 'results' && keyboardVisible ? 1 : 0}
          contentKey={selected ? `place-${selected.id}` : 'results'}
          onDismiss={() => {
            if (selected) setSelectedId(null);
            else {
              Keyboard.dismiss();
              setQuery('');
              setSearchOpen(false);
              setSearchFiltersOpen(false);
            }
          }}
          footer={
            selected ? (
              <PlaceActions
                saved={saved.some((p) => p.id === selected.id)}
                // The composer can't take a place yet, so this opens it empty
                onLogVisit={() => router.push('/posts/new')}
                onToggleSave={() => savedPlaces.toggle(selected)}
              />
            ) : undefined
          }
        >
          {selected && ex.selectedArea ? (
            <PlaceDetailBody
              place={selected}
              area={ex.selectedArea}
              audience={ex.audience}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <SearchResultsPanel search={search} onFilters={() => { Keyboard.dismiss(); setSearchFiltersOpen(true); }}
              onPlace={openSearchPlace}
              onTrip={trip => { if (trip.id.startsWith('search-trip-')) setPreviewContent({ trip }); else router.push({ pathname: '/trips/[id]', params: { id: trip.id } }); }}
              onPost={post => setPreviewContent({ post })} />
          )}
        </Sheet>
      )}

      {filtersOpen && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setFiltersOpen(false)}
          accessibilityLabel="Close filters"
        />
      )}

      <View style={[styles.header, { paddingTop: headerTop }]} pointerEvents="box-none">
        <SearchBar
          value={ex.query}
          onChangeText={(t) => {
            setQuery(t);
            setSearchOpen(true);
            setSelectedId(null);
            setFiltersOpen(false);
          }}
          filtersHighlighted={mode === 'results' ? searchFiltersOpen || search.activeFilterCount > 0 : filtersOpen || ex.category !== 'all'}
          filterCount={mode === 'results' ? search.activeFilterCount : 0}
          onFocus={() => setSearchOpen(true)}
          onPressFilters={() => {
            Keyboard.dismiss();
            if (mode === 'results') setSearchFiltersOpen(true);
            else setFiltersOpen((o) => !o);
          }}
        />
        <Animated.View style={[styles.under, { opacity: fadeWithSheet }]} pointerEvents="box-none">
          <AudienceToggle value={ex.audience} onChange={ex.setAudience} />
          <View style={styles.chip}>
            <Text style={styles.chipText}>{ex.locationLabel}</Text>
          </View>
        </Animated.View>
        {filtersOpen && (
          <View style={[styles.menu, { top: headerTop + SEARCH_BAR_HEIGHT + 10 }]}>
            <FiltersMenu
              value={ex.category}
              onApply={(c) => {
                ex.setCategory(c);
                setFiltersOpen(false);
              }}
            />
          </View>
        )}
      </View>
      <SearchFiltersSheet visible={searchFiltersOpen && searchActive} onClose={() => setSearchFiltersOpen(false)}
        tab={search.tab} value={search.filters} onChange={search.setFilters}
        centers={{ permission, nearMe, mapCenter }} locating={locating} onRequestLocation={() => { void locate(true); }} />
      <BottomSheet visible={previewContent !== null} onClose={() => setPreviewContent(null)} title="Search result">
        <ScrollView>
          {previewContent && ('trip' in previewContent ? <TripCard trip={previewContent.trip} /> : <PostCard post={previewContent.post} />)}
          {previewContent && 'post' in previewContent && !previewContent.post.tripId.startsWith('search-trip-') &&
            <Button title="View trip" onPress={() => {
              const id = previewContent.post.tripId;
              setPreviewContent(null);
              router.push({ pathname: '/trips/[id]', params: { id } });
            }} />}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#C4DDD9' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16 },
  under: { marginTop: 12, gap: 12, alignItems: 'flex-start' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    ...shadow,
  },
  chipText: { fontSize: 15, color: colors.forest },
  menu: { position: 'absolute', left: 16, right: 16 },
  idleStack: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 12 },
});
