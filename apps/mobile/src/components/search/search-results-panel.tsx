import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { PlaceSuggestion, SearchItems, SearchPerson, SearchPlace, SearchType } from 'shared-types';

import { UserRow } from '@/components/content/user-row';
import { TripCard } from '@/components/content/trip-card';
import { PostCard } from '@/components/content/post-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StarRating } from '@/components/ui/star-rating';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { useFollow } from '@/hooks/use-follow';
import type { useSearch } from '@/hooks/use-search';
import { useCurrentUser } from '@/lib/current-user';
import { ratingLabel } from '@/lib/rating';
import { SEARCH_TABS } from '@/lib/search/filters';

type Props = {
  search: ReturnType<typeof useSearch>;
  onFilters: () => void;
  onPlace: (place: SearchPlace) => void;
  onProfile: (userId: string) => void;
  onTrip: (trip: SearchItems['trips']) => void;
  onPost: (post: SearchItems['posts']) => void;
  /** Real-world places from Mapbox, listed under the app's own places (All and Places tabs). */
  world?: { places: PlaceSuggestion[]; searching: boolean; openingId: string | null; onPress: (place: PlaceSuggestion) => void };
};
const titles = { all: 'All', people: 'People', places: 'Places', trips: 'Trips', posts: 'Posts' };
const types = ['people', 'places', 'trips', 'posts'] as const;
export function SearchResultsPanel({ search, onFilters, onPlace, onProfile, onTrip, onPost, world }: Props) {
  const render = (type: SearchType, item: SearchItems[SearchType]) => {
    if (type === 'people') return <Person person={item as SearchPerson} onPress={() => onProfile(item.id)} />;
    if (type === 'places') return <Place place={item as SearchPlace} onPress={() => onPlace(item as SearchPlace)} />;
    if (type === 'trips') {
      const trip = item as SearchItems['trips'];
      return <TripCard trip={trip} onPress={() => onTrip(trip)} onUserPress={() => onProfile(trip.owner.id)} />;
    }
    const post = item as SearchItems['posts'];
    return <PostCard post={post} onPress={() => onPost(post)} onUserPress={() => onProfile(post.author.id)} />;
  };
  const header = <View style={styles.header}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {SEARCH_TABS.map(tab => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: search.tab === tab }}
        onPress={() => search.setTab(tab)} style={[styles.tab, search.tab === tab && styles.selected]}>
        <AppText variant="label">{titles[tab]}</AppText>
      </Pressable>)}
    </ScrollView>
    <Button title={`Filters${search.activeFilterCount ? ` · ${search.activeFilterCount}` : ''}`} size="compact" onPress={onFilters} />
  </View>;
  const error = search.validationError ?? (search.status === 'error' ? 'Couldn’t load search results.' : null);
  const empty = <View style={styles.state}>
    <AppText accessibilityLiveRegion="polite">{error ?? (search.status === 'idle' ? 'Enter at least 2 characters to search.' : search.activeFilterCount ? 'No matches. Try clearing your filters.' : 'No matches. Try another search.')}</AppText>
    {search.activeFilterCount > 0 && <Button title="Clear filters" size="compact" onPress={search.resetFilters} />}
    {search.status === 'error' && <Button title="Retry" size="compact" onPress={search.retry} />}
  </View>;
  const loading = <View style={styles.state} accessibilityLabel="Loading search results" accessibilityRole="progressbar">
    {[0, 1, 2].map(key => <View key={key} style={styles.skeleton}><Skeleton width="60%" /><Skeleton height={Spacing.six} /><Skeleton width="80%" /></View>)}
  </View>;
  const showWorld = world && (search.tab === 'all' || search.tab === 'places') && search.status !== 'idle' && !search.validationError;
  // A Mapbox place someone has already tagged is listed above as an app place, so leave its
  // Mapbox copy out. This only sees the places on screen; LOC-3 (#155) moves the check to the server.
  const appPlaces = search.tab === 'all' ? search.preview?.places ?? [] : search.tab === 'places' ? search.page?.items as SearchPlace[] | undefined ?? [] : [];
  const tagged = new Set(appPlaces.filter(place => place.provider === 'mapbox').map(place => place.providerPlaceId));
  const worldPlaces = showWorld ? world.places.filter(place => !tagged.has(place.mapboxId)) : [];
  const hasWorld = worldPlaces.length > 0;
  const worldSection = showWorld ? <WorldPlaces {...world} places={worldPlaces} /> : undefined;
  if (search.tab === 'all') return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
    {header}
    {search.status === 'loading' ? loading : error || !search.preview || types.every(type => !search.preview![type].length) ? (hasWorld ? undefined : empty) :
      types.map(type => <View key={type} style={styles.section}>
        <View style={styles.heading}><AppText variant="label">{titles[type]}</AppText>
          <Button title="See all" size="compact" onPress={() => search.setTab(type)} /></View>
        {search.preview![type].length ? search.preview![type].map(item => <View key={item.id}>{render(type, item)}</View>) : <AppText variant="caption">No matches</AppText>}
      </View>)}
    {worldSection}
  </ScrollView>;
  const type = search.tab;
  return <FlatList data={error ? [] : search.page?.items ?? []} keyExtractor={item => item.id}
    keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} ListHeaderComponent={header}
    renderItem={({ item }) => <View style={styles.result}>{render(type, item)}</View>}
    ListEmptyComponent={search.status === 'loading' ? loading : hasWorld ? undefined : empty}
    onEndReached={() => { void search.loadMore(); }} onEndReachedThreshold={0.4}
    ListFooterComponent={search.pageError ? <View style={styles.state}><AppText>Couldn’t load more results.</AppText><Button title="Retry" onPress={search.retry} /></View> : search.loadingMore ? <ActivityIndicator color={Palette.coral} /> : worldSection} />;
}
/** Same follow as on profiles (#31): useFollow updates the profile, counts, lists and these results. */
function Person({ person, onPress }: { person: SearchPerson; onPress: () => void }) {
  const me = useCurrentUser();
  const follow = useFollow(person.id);
  const { isFollowing } = person;
  return <UserRow user={person} onPress={onPress} action={me.id === person.id ? undefined : {
    title: isFollowing ? 'Following' : 'Follow', variant: isFollowing ? 'secondary' : 'coral',
    loading: follow.isPending, onPress: () => follow.toggle(isFollowing),
  }} />;
}
function Place({ place, onPress }: { place: SearchPlace; onPress: () => void }) {
  const area = [place.city, place.region].filter(Boolean).join(', ');
  const label = [place.name, area, ratingLabel(place.rating?.average ?? null, place.rating?.count)].filter(Boolean).join(', ');
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.place}>
    <AppText variant="label">{place.name}</AppText>
    <AppText variant="caption" color="placeholderGray">{area}</AppText>
    {place.rating
      ? <StarRating value={place.rating.average} count={place.rating.count} showLabel />
      : <AppText variant="caption" color="placeholderGray">No ratings yet</AppText>}
  </Pressable>;
}
/** Mapbox places with no posts on Yuji yet. Tapping one moves the map there. */
function WorldPlaces({ places, searching, openingId, onPress }: NonNullable<Props['world']>) {
  if (!places.length) return searching ? <ActivityIndicator color={Palette.coral} /> : null;
  return <View style={styles.section}>
    <AppText variant="label">More places</AppText>
    {places.map(place => <Pressable key={place.mapboxId} accessibilityRole="button" onPress={() => onPress(place)} style={styles.place}
      accessibilityLabel={`${place.name}${place.description ? `, ${place.description}` : ''}. Show on map`}>
      <View style={styles.worldRow}>
        <View style={styles.worldText}>
          <AppText variant="label">{place.name}</AppText>
          {place.description ? <AppText variant="caption" color="placeholderGray" numberOfLines={1}>{place.description}</AppText> : null}
          <AppText variant="caption">Show on map</AppText>
        </View>
        {openingId === place.mapboxId ? <ActivityIndicator color={Palette.coral} /> : null}
      </View>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  list: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  header: { gap: Spacing.two }, tabs: { gap: Spacing.two },
  tab: { padding: Spacing.two, borderRadius: Radii.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.peach },
  selected: { backgroundColor: Palette.peach },
  section: { gap: Spacing.three }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  place: { padding: Spacing.three, gap: Spacing.one, backgroundColor: Palette.white, borderRadius: Radii.pill, borderColor: Palette.peach, borderWidth: StyleSheet.hairlineWidth },
  state: { gap: Spacing.three, paddingVertical: Spacing.three }, skeleton: { gap: Spacing.two }, result: { marginBottom: Spacing.three },
  worldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, worldText: { flex: 1, gap: Spacing.one },
});
