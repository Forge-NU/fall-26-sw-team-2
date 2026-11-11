import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AREA_BY_ID } from '@/components/explore/mock-data';
import { colors, radius } from '@/components/explore/explore-theme';
import { savedPlaces, useSavedPlaces } from '@/components/saved/saved-places';
import { EmptyState } from '@/components/ui/empty-state';

/** List of places saved from the Maps tab. */
export function SavedPlacesList() {
  const places = useSavedPlaces();

  return (
    <FlatList
      data={places}
      keyExtractor={(p) => p.id}
      contentContainerStyle={places.length === 0 ? styles.emptyWrap : styles.list}
      ListEmptyComponent={
        <EmptyState
          icon="bookmark-outline"
          title="No saved places yet"
          description="Tap Save place on any spot in Maps and it shows up here."
        />
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.icon}>
            <MaterialCommunityIcons name="map-marker-outline" size={22} color={colors.forest} />
          </View>
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.type} · {item.neighborhood}, {AREA_BY_ID[item.areaId].name}
            </Text>
          </View>
          <View style={styles.rating}>
            <MaterialCommunityIcons name="star" size={14} color={colors.star} />
            <Text style={styles.ratingText}>{item.stats.global.rating.toFixed(1)}</Text>
          </View>
          <Pressable
            onPress={() => savedPlaces.remove(item.id)}
            hitSlop={10}
            accessibilityLabel={`Remove ${item.name} from saved`}
          >
            <MaterialCommunityIcons name="bookmark" size={24} color={colors.coral} />
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sageIcon,
  },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 14, fontWeight: '700', color: colors.forest },
});
