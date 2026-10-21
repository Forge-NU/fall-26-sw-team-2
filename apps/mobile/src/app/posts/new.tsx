// STAND-IN for POST-2 (#42): the post composer replaces this screen.
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';

export default function NewPostScreen() {
  return (
    <Screen>
      <ScreenHeader
        title="Add post"
        left={{ icon: 'close', label: 'Close', onPress: () => router.back() }}
      />
      <View style={styles.center}>
        <EmptyState
          icon="images-outline"
          title="Post composer coming soon"
          description="Adding posts lands with the post composer (#42)."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
