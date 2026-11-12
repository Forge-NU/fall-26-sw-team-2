import type { ReactElement } from 'react';
import { FlatList, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AREA_BY_ID } from '@/components/explore/mock-data';
import { ListEmpty } from '@/components/content/list-states';
import { Icon } from '@/components/icon';
import { savedPlaces, useSavedPlaces } from '@/components/saved/saved-places';
import { AppText } from '@/components/ui/app-text';
import { IconButton } from '@/components/ui/icon-button';
import { Palette, Radii, Spacing } from '@/constants/theme';

type SavedPlacesListProps = {
  /** Shown above the list, like the Trips and Posts tabs' intro line */
  header?: ReactElement;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** List of places saved from the Maps tab. */
export function SavedPlacesList({ header, contentContainerStyle }: SavedPlacesListProps) {
  const places = useSavedPlaces();

  return (
    <FlatList
      data={places}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={header}
      contentContainerStyle={contentContainerStyle}
      ListEmptyComponent={
        <ListEmpty
          icon="bookmark-outline"
          title="No saved places yet"
          description="Tap Save place on any spot in Maps and it shows up here."
        />
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.icon}>
            <Icon name="map-pin" size={Spacing.four} />
          </View>
          <View style={styles.text}>
            <AppText variant="label" numberOfLines={1}>
              {item.name}
            </AppText>
            <AppText variant="caption" color="placeholderGray" numberOfLines={1}>
              {item.type} · {item.neighborhood}, {AREA_BY_ID[item.areaId].name}
            </AppText>
          </View>
          <View style={styles.rating}>
            <Icon name="star" size={Spacing.three} color="coral" />
            <AppText variant="label">{item.stats.global.rating.toFixed(1)}</AppText>
          </View>
          <IconButton
            icon="bookmark"
            selectedIcon="bookmark-filled"
            selected
            accessibilityLabel={`Remove ${item.name} from saved`}
            onPress={() => savedPlaces.remove(item.id)}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  // Same card as a trip row on a profile
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    backgroundColor: Palette.white,
    borderColor: Palette.peach,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.pill,
  },
  icon: {
    width: Spacing.five + Spacing.two,
    height: Spacing.five + Spacing.two,
    borderRadius: Radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.lightTeal,
  },
  text: { flex: 1, minWidth: 0, gap: Spacing.half },
  rating: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
