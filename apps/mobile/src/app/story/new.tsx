import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryComposer } from '@/components/story/story-composer';
import { YujiHeader } from '@/components/yuji-header';
import { Palette } from '@/constants/theme';

export default function NewStoryScreen() {
  // Bumping the key gives the next story a fresh draft.
  const [draftKey, setDraftKey] = useState(0);

  const leave = () => {
    setDraftKey((key) => key + 1);
    router.navigate('/');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <YujiHeader />
        <StoryComposer
          key={draftKey}
          onDismiss={leave}
          onPosted={() => {
            leave();
            Alert.alert('Story posted', 'Mock only — nothing was uploaded.');
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.surface,
  },
});
