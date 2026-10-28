import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL } from '@/api/client';
import { listExampleTravelers } from '@/api/examples';
import { getMockMode } from '@/api/mock';
import { listUsers } from '@/api/users';
import { UserList } from '@/components/dev/user-list';
import { AppText } from '@/components/ui/app-text';
import { BottomTabInset, Palette, Radii, Spacing } from '@/constants/theme';
import { useInfiniteList } from '@/hooks/use-infinite-list';

type Example = 'mocked' | 'real';

/**
 * APP-1's examples to copy: a mocked endpoint and a real one, both through
 * useInfiniteList. Dev-only and not in the tab bar; open /api-examples.
 */
export default function ApiExamplesScreen() {
  const [example, setExample] = useState<Example>('mocked');

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <AppText variant="heading">API examples</AppText>
        <View style={styles.switcher}>
          <ExampleTab label="Mocked endpoint" selected={example === 'mocked'} onPress={() => setExample('mocked')} />
          <ExampleTab label="Real API" selected={example === 'real'} onPress={() => setExample('real')} />
        </View>
        <AppText variant="caption" color="placeholderGray">
          {example === 'mocked'
            ? `withMock, 45 fake users in pages of 20 · mocks: ${getMockMode()}`
            : `GET ${API_URL}/api/users · 401 until sign-in lands (#29)`}
        </AppText>
      </View>
      <View style={styles.body}>{example === 'mocked' ? <MockedExample /> : <RealExample />}</View>
    </SafeAreaView>
  );
}

function MockedExample() {
  const travelers = useInfiniteList({ queryKey: ['examples', 'travelers'], fetchPage: listExampleTravelers });
  return <UserList list={travelers} />;
}

function RealExample() {
  const users = useInfiniteList({ queryKey: ['users'], fetchPage: listUsers });
  return <UserList list={users} />;
}

function ExampleTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tab, selected && styles.tabSelected]}>
      <AppText variant="label" color={selected ? 'white' : 'black'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.warmWhite },
  header: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  switcher: { flexDirection: 'row', gap: Spacing.two },
  tab: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Radii.pill, backgroundColor: Palette.peach },
  tabSelected: { backgroundColor: Palette.coral },
  body: { flex: 1, paddingBottom: BottomTabInset },
});
