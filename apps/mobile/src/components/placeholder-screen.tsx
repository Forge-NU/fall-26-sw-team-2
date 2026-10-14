import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { YujiHeader } from '@/components/yuji-header';
import { Palette, ScreenGutter } from '@/constants/theme';

/** Stand-in for toolbar destinations that do not have wireframes yet. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <YujiHeader />
      <View style={styles.body}>
        <AppText variant="display" size={28}>
          {title}
        </AppText>
        <AppText size={12} color="inkMuted">
          Wireframe coming soon.
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.surface,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: ScreenGutter,
  },
});
