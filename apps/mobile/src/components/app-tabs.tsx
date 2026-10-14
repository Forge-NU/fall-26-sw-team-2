import { router } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { BottomToolbar, ToolbarItem } from '@/components/bottom-toolbar';
import { PostChooserSheet } from '@/components/post-chooser-sheet';
import { Palette } from '@/constants/theme';

export default function AppTabs() {
  const [postChooserOpen, setPostChooserOpen] = useState(false);

  return (
    <Tabs style={styles.tabs}>
      <TabSlot style={styles.slot} />
      {/* TabTriggers must be direct JSX children here: expo-router reads them to build the routes. */}
      <TabList asChild>
        <BottomToolbar>
          <TabTrigger name="feed" href="/" asChild>
            <ToolbarItem destination="feed" />
          </TabTrigger>
          <TabTrigger name="saved" href="/saved" asChild>
            <ToolbarItem destination="saved" />
          </TabTrigger>
          {/* Post opens the chooser instead of switching tabs; the composer is still a tab so it can show as active. */}
          <TabTrigger
            name="story"
            href="/story/new"
            asChild
            onPress={(event) => {
              event.preventDefault();
              setPostChooserOpen(true);
            }}>
            <ToolbarItem destination="post" />
          </TabTrigger>
          <TabTrigger name="maps" href="/maps" asChild>
            <ToolbarItem destination="maps" />
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <ToolbarItem destination="profile" />
          </TabTrigger>
        </BottomToolbar>
      </TabList>

      <PostChooserSheet
        visible={postChooserOpen}
        onClose={() => setPostChooserOpen(false)}
        onCreateItinerary={() => {
          setPostChooserOpen(false);
          Alert.alert('Create itinerary', 'Trip creation is coming in a later wireframe.');
        }}
        onPostStory={() => {
          setPostChooserOpen(false);
          router.navigate('/story/new');
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flex: 1,
    backgroundColor: Palette.surface,
  },
  slot: {
    flex: 1,
  },
});
