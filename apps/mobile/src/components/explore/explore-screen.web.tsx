import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { YujiHeader } from '@/components/yuji-header';
import { Palette, Spacing } from '@/constants/theme';

/** react-native-maps has no web support, so the web build (and PR web preview) shows this instead. */
export default function ExploreScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <YujiHeader />
      <View style={styles.body}>
        <EmptyState
          icon="map-outline"
          title="The map is in the phone app"
          description="Open Yuji on your phone to explore places on the map."
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.warmWhite },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
});
