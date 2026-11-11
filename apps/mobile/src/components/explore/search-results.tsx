import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import type { SearchPerson, SearchPlace } from 'shared-types';
import { UserRow } from '@/components/content/user-row';
import { aggregate } from '@/components/explore/explore-stats';
import { colors, formatCount, radius } from '@/components/explore/explore-theme';
import { Spacing } from '@/constants/theme';
import { AREAS, COUNTRY_BY_ID, PLACES } from '@/components/explore/mock-data';
import type { Area } from '@/components/explore/types';
import { useFollow } from '@/hooks/use-follow';
import type { SearchSection } from '@/hooks/use-search';

// Popular destinations for the empty state: the seed areas with the most logs.
// TODO: swap for a popular-destinations endpoint once the map endpoints exist (MAP-2, #46).
const POPULAR_DESTINATIONS = AREAS.map((area) => ({
  area,
  logs: aggregate(
    PLACES.filter((place) => place.areaId === area.id),
    'global',
  ).logs,
}))
  .filter((d) => d.logs > 0)
  .sort((a, b) => b.logs - a.logs)
  .slice(0, 4)
  .map((d) => d.area);

type Section =
  | { key: 'people'; title: string; data: SearchPerson[]; list: SearchSection }
  | { key: 'places'; title: string; data: SearchPlace[]; list: SearchSection };

interface Props {
  query: string;
  people: SearchSection & { items: SearchPerson[] };
  places: SearchSection & { items: SearchPlace[] };
  searching: boolean;
  tooShort: boolean;
  currentUserId: string;
  onRetry: () => void;
  onSelectPerson: (person: SearchPerson) => void;
  onSelectPlace: (place: SearchPlace) => void;
  onSelectDestination: (area: Area) => void;
}

export function SearchResults({
  query,
  people,
  places,
  searching,
  tooShort,
  currentUserId,
  onRetry,
  onSelectPerson,
  onSelectPlace,
  onSelectDestination,
}: Props) {
  const sections: Section[] = [];
  if (people.items.length) sections.push({ key: 'people', title: 'People', data: people.items, list: people });
  if (places.items.length) sections.push({ key: 'places', title: 'Places', data: places.items, list: places });
  const total = people.items.length + places.items.length;
  const more = people.hasMore || places.hasMore;
  const failed = [people.failed && 'people', places.failed && 'places'].filter(Boolean).join(' and ');

  let empty: ReactNode = null;
  if (tooShort) {
    empty = <Suggestions message="Type at least 2 characters to search people and places." onSelect={onSelectDestination} />;
  } else if (searching) {
    // Also covers a retry, so "Try again" visibly does something
    empty = <ActivityIndicator style={styles.spinner} color={colors.forest} />;
  } else if (failed) {
    empty = <SearchError onRetry={onRetry} />;
  } else {
    empty = (
      <Suggestions
        message={`No people or places match “${query.trim()}”. Try a popular destination:`}
        onSelect={onSelectDestination}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {tooShort ? 'Search' : `Results for “${query.trim()}”`}
          </Text>
          {searching && total > 0 ? (
            <ActivityIndicator size="small" color={colors.forest} />
          ) : (
            !tooShort &&
            total > 0 && (
              <Text style={styles.count}>
                {total}
                {more ? '+' : ''} {total === 1 && !more ? 'result' : 'results'}
              </Text>
            )
          )}
        </View>
      </View>

      <SectionList<SearchPerson | SearchPlace, Section>
        sections={sections}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderSectionFooter={({ section }) => <ShowMore list={section.list} label={section.title.toLowerCase()} />}
        renderItem={({ item, section }) =>
          section.key === 'people' ? (
            <PersonRow
              person={item as SearchPerson}
              isMe={item.id === currentUserId}
              onPress={() => onSelectPerson(item as SearchPerson)}
            />
          ) : (
            <PlaceRow place={item as SearchPlace} onPress={() => onSelectPlace(item as SearchPlace)} />
          )
        }
        ListEmptyComponent={<>{empty}</>}
        // One type failed but the other has results: say so, rather than look like no matches
        ListFooterComponent={total > 0 && failed && !searching ? <SearchError what={failed} onRetry={onRetry} /> : undefined}
      />
    </View>
  );
}

/** Same follow as on profiles (#31): useFollow updates the profile, counts, lists and these results. */
function PersonRow({ person, isMe, onPress }: { person: SearchPerson; isMe: boolean; onPress: () => void }) {
  const { toggle, isPending } = useFollow(person.id);
  const followers = `${formatCount(person.followerCount)} ${person.followerCount === 1 ? 'follower' : 'followers'}`;
  return (
    <View style={styles.personRow}>
      <UserRow
        user={person}
        subtitle={person.username ? `@${person.username} · ${followers}` : followers}
        onPress={onPress}
        action={
          isMe
            ? undefined
            : {
                title: person.isFollowing ? 'Following' : 'Follow',
                variant: person.isFollowing ? 'teal' : 'coral',
                onPress: () => toggle(person.isFollowing),
                loading: isPending,
              }
        }
      />
    </View>
  );
}

function PlaceRow({ place, onPress }: { place: SearchPlace; onPress: () => void }) {
  const where = [place.city, place.region].filter(Boolean).join(', ') || place.address;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.icon}>
        <MaterialCommunityIcons name="map-marker-outline" size={24} color={colors.forest} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>
        {where ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {where}
          </Text>
        ) : null}
        <PlaceRating place={place} />
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} />
    </Pressable>
  );
}

// TODO: use StarRating from RATE-2 (#92) once it's on main.
function PlaceRating({ place }: { place: SearchPlace }) {
  if (!place.rating) return <Text style={styles.noRating}>No ratings yet</Text>;
  const { average, count } = place.rating;
  return (
    <View
      style={styles.rating}
      accessibilityLabel={`Rated ${average.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'rating' : 'ratings'}`}
    >
      <MaterialCommunityIcons name="star" size={15} color={colors.star} />
      <Text style={styles.stats}>
        {average.toFixed(1)} · {formatCount(count)} {count === 1 ? 'rating' : 'ratings'}
      </Text>
    </View>
  );
}

function ShowMore({ list, label }: { list: SearchSection; label: string }) {
  if (list.loadingMore) return <ActivityIndicator style={styles.moreSpinner} color={colors.forest} />;
  if (!list.hasMore) return null;
  return (
    <Pressable onPress={list.loadMore} style={styles.more} accessibilityRole="button" hitSlop={6}>
      <Text style={styles.moreText}>Show more {label}</Text>
    </Pressable>
  );
}

function SearchError({ what, onRetry }: { what?: string; onRetry: () => void }) {
  return (
    <View style={styles.state}>
      <Text style={styles.stateText}>{what ? `Couldn’t load ${what}.` : 'Couldn’t search right now.'}</Text>
      <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function Suggestions({ message, onSelect }: { message: string; onSelect: (area: Area) => void }) {
  return (
    <View style={styles.state}>
      <Text style={styles.stateText}>{message}</Text>
      <View style={styles.chips}>
        {POPULAR_DESTINATIONS.map((area) => (
          <Pressable key={area.id} onPress={() => onSelect(area)} style={styles.chip} accessibilityRole="button">
            <Text style={styles.chipText}>
              {area.name}, {COUNTRY_BY_ID[area.countryId].name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Separator() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: Spacing.one },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  count: { fontSize: 14, color: colors.textMuted },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.forest, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  list: { paddingHorizontal: 20, paddingBottom: Spacing.four },
  personRow: { paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 14 },
  rowPressed: { opacity: 0.6 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sageIcon,
  },
  rowText: { flex: 1, gap: Spacing.half },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted },
  rating: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  stats: { fontSize: 14, color: colors.text },
  noRating: { fontSize: 14, color: colors.textFaint },
  sep: { height: 1, backgroundColor: colors.line },
  state: { paddingVertical: 20, gap: 14 },
  stateText: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  spinner: { paddingVertical: Spacing.four },
  moreSpinner: { paddingVertical: Spacing.two },
  more: { alignSelf: 'flex-start', paddingVertical: Spacing.two },
  moreText: { fontSize: 15, fontWeight: '700', color: colors.coral },
  retry: {
    alignSelf: 'flex-start',
    height: 40,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.forest,
  },
  retryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    height: 36,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.peachLine,
    backgroundColor: colors.peach,
  },
  chipText: { fontSize: 15, color: colors.text },
});
