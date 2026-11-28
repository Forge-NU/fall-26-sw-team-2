import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { SearchPerson, TripInviteResponse } from 'shared-types';

import { getErrorMessage } from '@/api/client';
import { MAX_TRIP_PEOPLE } from '@/api/collaboration';
import { ListEmpty } from '@/components/content/list-states';
import { UserRow } from '@/components/content/user-row';
import { tripErrorState } from '@/components/trips/trip-error-state';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Palette, Spacing } from '@/constants/theme';
import { useCancelInvite, useInviteSearch, useSendInvite, useTripInvites } from '@/hooks/use-trip-invites';
import { useCurrentUser } from '@/lib/current-user';
import { inviteRowState } from '@/lib/invites';

// Invite people to a trip (#138 COLLAB-4, on #134 COLLAB-3's endpoints). Owner
// only: search people by name or username, invite them, and cancel pending
// invites. The members sheet, and the "member" and "trip is full" row states,
// come with #133 COLLAB-2's members list; until then the API's 409 message
// shows in a toast.
export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const [query, setQuery] = useState('');

  const invites = useTripInvites(id);
  const results = useInviteSearch(id, query);
  const send = useSendInvite(id);
  const cancel = useCancelInvite(id);

  const pending = invites.data?.items ?? [];

  const personRow = ({ item }: { item: SearchPerson }) => {
    const state = inviteRowState(item.id, user.id, pending);
    const sending = send.isPending && send.variables === item.username;
    return (
      <UserRow
        user={item}
        action={
          state === 'self'
            ? undefined
            : state === 'invited'
              ? { title: 'Invited', disabled: true, onPress: () => {} }
              : {
                  title: 'Invite',
                  loading: sending,
                  // One invite at a time, so two taps can't race the cap
                  disabled: send.isPending && !sending,
                  onPress: () => item.username && send.mutate(item.username),
                }
        }
      />
    );
  };

  const inviteRow = ({ item }: { item: TripInviteResponse }) => (
    <UserRow
      user={item.invitee}
      subtitle="Invite pending"
      action={{ title: 'Cancel', variant: 'teal', onPress: () => cancel.mutate(item.id) }}
    />
  );

  return (
    <Screen
      loading={invites.isPending}
      error={invites.data ? null : invites.error}
      onRetry={() => void invites.refetch()}
      errorState={tripErrorState(invites.error)}
      header={
        <ScreenHeader
          title="Invite people"
          left={{ icon: 'arrow-left', label: 'Back', onPress: () => router.back() }}
        />
      }>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or username"
        accessibilityLabel="Search people to invite"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      {results.active ? (
        <FlatList
          data={results.data?.items ?? []}
          keyExtractor={(person) => person.id}
          renderItem={personRow}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            results.isError ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Couldn't search"
                description={getErrorMessage(results.error)}
                action={{ title: 'Try again', onPress: () => void results.refetch() }}
                style={styles.centered}
              />
            ) : results.searching ? (
              <ListEmpty list={{ ...LOADING }} title="" />
            ) : (
              <ListEmpty icon="search-outline" title="No one found" description="Check the spelling, or try their username." />
            )
          }
        />
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(invite) => invite.id}
          renderItem={inviteRow}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <AppText variant="caption" style={styles.muted}>
                Anyone can be invited, and they can accept or decline from their notifications. A
                trip has up to {MAX_TRIP_PEOPLE} people, counting pending invites.
              </AppText>
              {pending.length > 0 ? <AppText variant="subheading">Pending invites</AppText> : null}
            </View>
          }
        />
      )}
    </Screen>
  );
}

// ListEmpty's skeleton rows, for the first search
const LOADING = {
  isPending: true,
  isError: false,
  error: null,
  refetch: () => Promise.reject(new Error('unused')),
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  fetchNextPage: () => Promise.reject(new Error('unused')),
} as const;

const styles = StyleSheet.create({
  list: { flexGrow: 1, gap: Spacing.three, paddingBottom: Spacing.three },
  header: { gap: Spacing.three },
  muted: { color: Palette.placeholderGray },
  centered: { alignSelf: 'center' },
});
