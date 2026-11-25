import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Spacing, Theme } from '@/constants/theme';

export type TabBarItem<K extends string> = { key: K; label: string };

export type TabBarProps<K extends string> = {
  items: readonly TabBarItem<K>[];
  value: K;
  onChange: (key: K) => void;
};

// Tabs along the top of a list: the feed's Local / Friends / FYP, Saved's
// Trips / Posts / Places and a profile's Itineraries / Posts (UI-4 #98)
export function TabBar<K extends string>({ items, value, onChange }: TabBarProps<K>) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={styles.tab}>
            <AppText variant="label" color={active ? 'black' : 'placeholderGray'}>
              {item.label}
            </AppText>
            {active && <View style={styles.indicator} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    minHeight: Spacing.five + Spacing.three,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    backgroundColor: Theme.colors.background,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  indicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: Spacing.half,
    backgroundColor: Theme.colors.accent,
  },
});
