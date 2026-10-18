import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { YujiHeader } from '@/components/yuji-header';
import { Palette, Spacing } from '@/constants/theme';

/** Stand-in for toolbar destinations that do not have wireframes yet. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <YujiHeader />
      <View style={styles.body}>
        <AppText variant="heading">
          {title}
        </AppText>
        <AppText variant="caption" color="placeholderGray">
          Wireframe coming soon.
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.warmWhite,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
  },
});
