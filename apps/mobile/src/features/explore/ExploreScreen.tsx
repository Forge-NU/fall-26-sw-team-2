import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { savedPlaces, useSavedPlaces } from '../saved/savedPlaces';
import { AudienceToggle } from './components/AudienceToggle';
import { FiltersMenu } from './components/FiltersMenu';
import { AroundCard } from './components/MapCards';
import { MapControls } from './components/MapControls';
import { PlaceActions, PlaceDetailBody } from './components/PlaceDetail';
import { RatingPin } from './components/RatingPin';
import { SearchBar } from './components/SearchBar';
import { SearchResults } from './components/SearchResults';
import { Sheet } from './components/Sheet';
import { mapStyle } from './mapStyle';
import { LISBON_REGION } from './mockData';
import { colors, formatCount, radius, shadow } from './theme';
import type { LatLng, Person, PinItem, Place, SearchResult } from './types';
import { useExplore } from './useExplore';

interface Props {
  /** Open the Post flow prefilled with this place. */
  onLogVisit?: (place: Place) => void;
  /** Open another person's trip. */
  onViewTrip?: (person: Person) => void;
}

const SEARCH_BAR_HEIGHT = 56;

export default function ExploreScreen({ onLogVisit, onViewTrip }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(LISBON_REGION);
  const [sheetHeight] = useState(() => new Animated.Value(0));
  const [screenH, setScreenH] = useState(700);
  const [idleStackH, setIdleStackH] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [locationOn, setLocationOn] = useState(false);

  const ex = useExplore(LISBON_REGION);
  const saved = useSavedPlaces();
  const { setSelectedId, setQuery, onRegionChange } = ex;

  const headerTop = insets.top + 8;
  const half = Math.round(screenH * 0.52);
  const full = Math.max(half + 1, Math.round(screenH - headerTop - SEARCH_BAR_HEIGHT - 10));
  const snapPoints = useMemo(() => [half, full], [half, full]);

  const mode = ex.selected ? 'detail' : ex.query.trim() ? 'results' : 'idle';

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

  const flyTo = useCallback((c: LatLng, delta: number, leaveRoomForSheet = false) => {
    mapRef.current?.animateToRegion(
      {
        latitude: c.latitude - (leaveRoomForSheet ? delta * 0.22 : 0),
        longitude: c.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      450,
    );
  }, []);

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

  const openResult = (r: SearchResult) => {
    if (r.target.type === 'place') {
      selectPlace(r.target.place);
      return;
    }
    Keyboard.dismiss();
    setQuery('');
    flyTo(r.target.area.coordinate, 0.06);
  };

  const zoomBy = (factor: number) => {
    const r = regionRef.current;
    mapRef.current?.animateToRegion(
      {
        ...r,
        latitudeDelta: Math.min(150, Math.max(0.002, r.latitudeDelta * factor)),
        longitudeDelta: Math.min(300, Math.max(0.002, r.longitudeDelta * factor)),
      },
      250,
    );
  };

  const locate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      mapRef.current?.animateToRegion(LISBON_REGION, 450);
      return;
    }
    setLocationOn(true);
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    flyTo(pos.coords, 0.02);
  };

  const calloutLine = (pin: PinItem) => {
    const friends = pin.place?.stats.friends.people ?? 0;
    if (friends > 0) return `${friends} ${friends === 1 ? 'friend' : 'friends'} visited`;
    return `${formatCount(pin.place?.stats.global.reviews ?? 0)} reviews`;
  };

  const selected = ex.selected;

  return (
    <View style={styles.root} onLayout={(e) => setScreenH(e.nativeEvent.layout.height)}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={LISBON_REGION}
        customMapStyle={mapStyle}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        showsUserLocation={locationOn}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsCompass={false}
        toolbarEnabled={false}
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
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
        onLocate={locate}
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
            }
          }}
          footer={
            selected ? (
              <PlaceActions
                saved={saved.some((p) => p.id === selected.id)}
                onLogVisit={() => onLogVisit?.(selected)}
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
              onViewTrip={(pr) => onViewTrip?.(pr)}
            />
          ) : (
            <SearchResults
              query={ex.query}
              results={ex.results}
              filter={ex.kindFilter}
              onFilterChange={ex.setKindFilter}
              onSelect={openResult}
            />
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
            setSelectedId(null);
            setFiltersOpen(false);
          }}
          filtersHighlighted={filtersOpen || ex.category !== 'all'}
          onPressFilters={() => {
            Keyboard.dismiss();
            setFiltersOpen((o) => !o);
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
