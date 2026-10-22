import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../explore/theme';
import { SavedPlacesList } from './SavedPlacesList';

/** Simple Saved tab. Only use this if saved.tsx is still a placeholder. */
export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Saved</Text>
      <SavedPlacesList />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  title: { fontSize: 30, fontWeight: '700', color: colors.forest, paddingHorizontal: 16, marginBottom: 4 },
});
