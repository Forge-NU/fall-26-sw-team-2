import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { SearchItems, SearchPerson, SearchPlace, SearchType } from 'shared-types';

import { UserRow } from '@/components/content/user-row';
import { TripCard } from '@/components/content/trip-card';
import { PostCard } from '@/components/content/post-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { useFollow } from '@/hooks/use-follow';
import type { useSearch } from '@/hooks/use-search';
import { useCurrentUser } from '@/lib/current-user';
import { SEARCH_TABS } from '@/lib/search/filters';

type Props = {
  search: ReturnType<typeof useSearch>;
  onFilters: () => void;
  onPlace: (place: SearchPlace) => void;
  onProfile: (userId: string) => void;
  onTrip: (trip: SearchItems['trips']) => void;
  onPost: (post: SearchItems['posts']) => void;
};
const titles = { all: 'All', people: 'People', places: 'Places', trips: 'Trips', posts: 'Posts' };
const types = ['people', 'places', 'trips', 'posts'] as const;
export function SearchResultsPanel({ search, onFilters, onPlace, onProfile, onTrip, onPost }: Props) {
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
  if (search.tab === 'all') return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
    {header}
    {search.status === 'loading' ? loading : error || !search.preview || types.every(type => !search.preview![type].length) ? empty :
      types.map(type => <View key={type} style={styles.section}>
        <View style={styles.heading}><AppText variant="label">{titles[type]}</AppText>
          <Button title="See all" size="compact" onPress={() => search.setTab(type)} /></View>
        {search.preview![type].length ? search.preview![type].map(item => <View key={item.id}>{render(type, item)}</View>) : <AppText variant="caption">No matches</AppText>}
      </View>)}
  </ScrollView>;
  const type = search.tab;
  return <FlatList data={error ? [] : search.page?.items ?? []} keyExtractor={item => item.id}
    keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} ListHeaderComponent={header}
    renderItem={({ item }) => <View style={styles.result}>{render(type, item)}</View>}
    ListEmptyComponent={search.status === 'loading' ? loading : empty}
    onEndReached={() => { void search.loadMore(); }} onEndReachedThreshold={0.4}
    ListFooterComponent={search.pageError ? <View style={styles.state}><AppText>Couldn’t load more results.</AppText><Button title="Retry" onPress={search.retry} /></View> : search.loadingMore ? <ActivityIndicator color={Palette.coral} /> : undefined} />;
}
/** Same follow as on profiles (#31): useFollow updates the profile, counts, lists and these results. */
function Person({ person, onPress }: { person: SearchPerson; onPress: () => void }) {
  const me = useCurrentUser();
  const follow = useFollow(person.id);
  const { isFollowing } = person;
  return <UserRow user={person} onPress={onPress} action={me.id === person.id ? undefined : {
    title: isFollowing ? 'Following' : 'Follow', variant: isFollowing ? 'teal' : 'coral',
    loading: follow.isPending, onPress: () => follow.toggle(isFollowing),
  }} />;
}
function Place({ place, onPress }: { place: SearchPlace; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.place}>
    <AppText variant="label">{place.name}</AppText>
    <AppText variant="caption" color="placeholderGray">{[place.city, place.region].filter(Boolean).join(', ')}</AppText>
    {/* Replace this display with the shared StarRating when #92 lands. */}
    <AppText variant="caption" accessibilityLabel={place.rating ? `Rated ${place.rating.average} out of 5 from ${place.rating.count} posts` : 'No ratings yet'}>
      {place.rating ? `${place.rating.average.toFixed(1)} / 5 · ${place.rating.count} ratings` : 'No ratings yet'}
    </AppText>
  </Pressable>;
}
const styles = StyleSheet.create({
  list: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  header: { gap: Spacing.two }, tabs: { gap: Spacing.two },
  tab: { padding: Spacing.two, borderRadius: Radii.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.peach },
  selected: { backgroundColor: Palette.peach },
  section: { gap: Spacing.three }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  place: { padding: Spacing.three, gap: Spacing.one, backgroundColor: Palette.white, borderRadius: Radii.pill, borderColor: Palette.peach, borderWidth: StyleSheet.hairlineWidth },
  state: { gap: Spacing.three, paddingVertical: Spacing.three }, skeleton: { gap: Spacing.two }, result: { marginBottom: Spacing.three },
});
