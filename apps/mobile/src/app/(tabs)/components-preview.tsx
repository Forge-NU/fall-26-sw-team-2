import { Redirect } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Palette } from "@/constants/palette";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast-provider";
import { EmptyState } from '@/components/ui/empty-state';
import { AvatarTokens, type AvatarSize } from '@/constants/avatar-tokens';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonTokens } from '@/constants/skeleton-tokens';
import { showToast as showApiToast } from '@/lib/toast';
import { ContentPreview } from '@/components/content/content-preview';

export default function ComponentsPreview() {
  const [pressCount, setPressCount] = useState(0);
  const [username, setUsername] = useState("");
  const { showToast, hideToast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ContentPreview />
        <AppText variant="heading">UI Components</AppText>
        <AppText variant="heading">Main Heading</AppText>
        <AppText variant="supporting">Supporting Text</AppText>
        <AppText variant="subheading">Sub Text</AppText>
        <AppText>Body Text</AppText>
        <AppText variant="label">Label Text</AppText>
        <AppText variant="caption">Caption Text</AppText>
        <AppText color="coral">Coral text</AppText>

        <AppText variant="subheading" color="coral">
          Coral Button
        </AppText>

        <Button
          title="About Us"
          onPress={() => setPressCount((count) => count + 1)}
        />

        <Button title="Disabled" disabled onPress={() => {}} />
        <Button title="Saving…" loading={loading} onPress={() => setLoading(true)} />
        <Button
          title={loading ? "Reset loading" : "Preview loading"}
          variant="teal"
          onPress={() => setLoading((value) => !value)}
        />

        <AppText variant="subheading" color="teal">
          Teal Button
        </AppText>

        <Button
          variant="teal"
          title="About Us"
          onPress={() => setPressCount((count) => count + 1)}
        />

        <Button title="Disabled teal" variant="teal" disabled onPress={() => {}} />

        <AppText>Pressed {pressCount} times</AppText>

        <AppText variant="supporting">Inputs</AppText>

        <Input
          label="Username"
          containerStyle={styles.inputPreview}
          placeholder="Enter your username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <AppText>Current value: {username || "(empty)"}</AppText>

        <Input
          label="Error example"
          containerStyle={styles.inputPreview}
          placeholder="Enter your username"
          error="This username is already taken."
        />

        <Input label="Disabled example" value="Cannot edit this" disabled containerStyle={styles.inputPreview} />
        <AppText variant="supporting">Avatars</AppText>

        <View style={styles.avatarSection}>
          <View style={styles.avatarRow}>
            {(['compact', 'small', 'medium', 'large'] as const).map((size: AvatarSize) => (
              <View key={size} style={styles.avatarExample}>
                <View style={styles.avatarSizeSlot}><Avatar name="Ruoxi Wang" size={size} /></View>
                <AppText variant="label">{size}</AppText>
                <AppText variant="caption">{AvatarTokens.sizes[size].diameter}px</AppText>
              </View>
            ))}
          </View>
          <AppText variant="subheading">Image fallback</AppText>
          <View style={styles.avatarRow}>
            <View style={styles.avatarExample}>
              <Avatar size="small" />
              <AppText variant="label">Default avatar</AppText>
            </View>
          </View>
        </View>
        <AppText variant="supporting">Toasts</AppText>

        <Button
          title="Show success"
          variant="teal"
          onPress={() =>
            showToast({
              message: "Your changes have been saved.",
              variant: "success",
            })
          }
        />

        <Button
          title="Show error"
          onPress={() =>
            showToast({
              message: "Something went wrong. Please try again.",
              variant: "error",
            })
          }
        />

        <Button
          title="Show info"
          variant="teal"
          onPress={() =>
            showToast({
              message: "You are viewing the component preview.",
              variant: "info",
            })
          }
        />
        <Button
          title="Persistent toast"
          variant="teal"
          onPress={() => showToast({
            message: "Tap this notification or Hide toast to dismiss.",
            duration: 0,
          })}
        />
        <Button title="Hide toast" variant="teal" onPress={hideToast} />
        <Button title="API notification" variant="teal" onPress={() => {
          showApiToast({ message: 'API client notification preview.', variant: 'error' });
        }} />

        <AppText variant="supporting">Empty states</AppText>
        <EmptyState title="Nothing here yet" />
        <EmptyState
          title="No results found"
          description="Try a different search to find items on campus."
          icon="search-outline"
          action={{
            title: 'Clear search',
            variant: 'teal',
            onPress: () => {
              setUsername('');
              showToast({ message: 'Search cleared.', variant: 'info' });
            },
          }}
        />
        <AppText variant="supporting">Loading skeleton</AppText>
        <View accessibilityLabel="Loading content" accessibilityState={{ busy: true }} accessible style={styles.skeletonPreview}>
          <Skeleton width={SkeletonTokens.previewSize} height={SkeletonTokens.previewSize} circle />
          <View style={styles.skeletonCopy}>
            <Skeleton />
            <Skeleton width="70%" />
          </View>
        </View>
        <AppText variant="label">Static skeleton</AppText>
        <View style={styles.inputPreview}><Skeleton animate={false} /></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  skeletonPreview: { width: '100%', maxWidth: 361, flexDirection: 'row', alignItems: 'center', gap: SkeletonTokens.previewGap },
  skeletonCopy: { flex: 1, gap: SkeletonTokens.previewGap },
  inputPreview: { width: '100%', maxWidth: 361, alignSelf: 'center' },
  avatarSection: {
    width: '100%',
    maxWidth: 361,
    gap: Spacing.three,
    alignItems: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  avatarExample: { alignItems: 'center', gap: Spacing.one },
  avatarSizeSlot: {
    height: AvatarTokens.sizes.large.diameter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: Palette.warmWhite,
  },
  content: {
    padding: Spacing.four,
    paddingTop:
      Platform.OS === "web" ? Spacing.six + Spacing.four : Spacing.four,
    gap: Spacing.three,
    alignItems: "center",
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
