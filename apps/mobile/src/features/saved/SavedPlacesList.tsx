import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AREA_BY_ID } from '../explore/mockData';
import { colors, radius } from '../explore/theme';
import { savedPlaces, useSavedPlaces } from './savedPlaces';

/** List of places saved from the Maps tab. Drop it into the Saved screen. */
export function SavedPlacesList() {
  const places = useSavedPlaces();

  return (
    <FlatList
      data={places}
      keyExtractor={(p) => p.id}
      contentContainerStyle={places.length === 0 ? styles.emptyWrap : styles.list}
      ListEmptyComponent={
        <View style={styles.empty}>
          <MaterialCommunityIcons name="bookmark-outline" size={36} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>No saved places yet</Text>
          <Text style={styles.emptyBody}>Tap Save place on any spot in Maps and it shows up here.</Text>
        </View>
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
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: 32 },
  empty: { alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  emptyBody: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
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
