import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { Icon, IconName } from '@/components/icon';
import { PostAuthor } from '@/components/post-author';
import { Media } from '@/components/ui/media';
import { Palette, PaletteColor, Radius, ScreenGutter } from '@/constants/theme';
import type { Itinerary } from '@/data/mock';

export function ItineraryCard({ itinerary }: { itinerary: Itinerary }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [featured, ...rest] = itinerary.days;

  const openDay = (day: number) =>
    router.push({ pathname: '/itinerary/[id]', params: { id: itinerary.id, day: String(day) } });

  return (
    <View style={styles.card}>
      <PostAuthor
        author={itinerary.author}
        meta={`${itinerary.location} · ${itinerary.postedAgo} · ${itinerary.postKind}`}
        onShare={() => Share.share({ message: itinerary.title })}
      />

      <View style={styles.identity}>
        <View style={styles.metaRow}>
          <AppText variant="bold" size={11}>
            ITINERARY
          </AppText>
          <AppText size={11} color="inkMuted">
            {itinerary.days.length} days · {itinerary.stops} stops
          </AppText>
        </View>
        <AppText variant="display" size={24} leading={1.15}>
          {itinerary.title}
        </AppText>
        <AppText size={12} color="inkMuted" leading={1.45}>
          {itinerary.summary}
        </AppText>
      </View>

      <View style={styles.previews}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View day ${featured.day}, ${featured.title}`}
          onPress={() => openDay(featured.day)}
          style={styles.featured}>
          <Media
            seed={`${itinerary.id}-day${featured.day}`}
            url={featured.coverUrl}
            iconSize={36}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(45,47,69,0)', 'rgba(45,47,69,0.8)']}
            locations={[0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.featuredCaption}>
            <AppText variant="bold" size={11} color="surface">
              Day {featured.day} · View day
            </AppText>
            <AppText variant="display" size={20} color="surface">
              {featured.title}
            </AppText>
          </View>
          <View style={styles.viewDay}>
            <Icon name="arrow-up-right" />
          </View>
        </Pressable>

        <View style={styles.moreDays}>
          {rest.map((day) => (
            <Pressable
              key={day.day}
              accessibilityRole="button"
              accessibilityLabel={`View day ${day.day}, ${day.title}`}
              onPress={() => openDay(day.day)}
              style={styles.dayPreview}>
              <View style={styles.dayImage}>
                <Media
                  seed={`${itinerary.id}-day${day.day}`}
                  url={day.coverUrl}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.dayLabel}>
                  <AppText variant="bold" size={10} color="surface">
                    Day {day.day}
                  </AppText>
                </View>
              </View>
              <AppText variant="semibold" size={11} leading={1.3}>
                {day.title}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <View style={styles.socialActions}>
          <CountAction
            icon="heart"
            color="coral"
            label={String(itinerary.likes + (liked ? 1 : 0))}
            accessibilityLabel={liked ? 'Unlike' : 'Like'}
            onPress={() => setLiked((value) => !value)}
          />
          <CountAction icon="message-circle" label={String(itinerary.comments)} accessibilityLabel="Comments" />
        </View>
        <CountAction
          icon="bookmark"
          label={`${itinerary.saves + (saved ? 1 : 0)} saves`}
          accessibilityLabel={saved ? 'Unsave itinerary' : 'Save itinerary'}
          onPress={() => setSaved((value) => !value)}
        />
      </View>

      <View style={styles.caption}>
        <AppText size={12} leading={1.45}>
          {itinerary.caption}
        </AppText>
        <AppText size={10} color="inkMuted">
          {itinerary.lovedBy}
        </AppText>
      </View>

      <ActionButton
        label="Add places to itinerary"
        tone="teal"
        height={48}
        fontSize={13}
        leadingIcon="plus"
        onPress={() => openDay(featured.day)}
      />
    </View>
  );
}

function CountAction({
  icon,
  color,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon: IconName;
  color?: PaletteColor;
  label: string;
  accessibilityLabel: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.countAction}>
      <Icon name={icon} size={22} color={color} />
      <AppText size={12}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
    padding: ScreenGutter,
  },
  identity: {
    gap: 7,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previews: {
    gap: 10,
  },
  featured: {
    height: 188,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  featuredCaption: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    gap: 4,
  },
  viewDay: {
    position: 'absolute',
    right: 14,
    bottom: 17,
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface,
  },
  moreDays: {
    flexDirection: 'row',
    gap: 10,
  },
  dayPreview: {
    flex: 1,
    gap: 6,
  },
  dayImage: {
    height: 86,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  dayLabel: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 3,
    backgroundColor: Palette.ink,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  socialActions: {
    flexDirection: 'row',
    gap: 20,
  },
  countAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  caption: {
    gap: 5,
  },
});
