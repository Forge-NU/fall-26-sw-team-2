import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useState } from "react";
import type { PostResponse, TripResponse } from "shared-types";
import { Icon } from "@/components/icon";
import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { Media } from "@/components/ui/media";
import { Palette, Radii, Spacing } from "@/constants/theme";
import { ContentTokens } from "@/constants/content-tokens";
import { UserRow } from "./user-row";
import { StatRow, type Stat } from "./stat-row";
import { CardLink } from "./card-link";
import { ShareAction } from "./share-action";
import { formatDateRange } from "./format-date";

type TripSummary = Pick<
  TripResponse,
  | "id"
  | "owner"
  | "title"
  | "destination"
  | "description"
  | "status"
  | "coverImageUrl"
> &
  Partial<
    Omit<
      TripResponse,
      | "id"
      | "owner"
      | "title"
      | "destination"
      | "description"
      | "status"
      | "coverImageUrl"
    >
  >;
export type TripDayPreview = {
  day: number;
  title: string;
  coverUrl?: string;
  visitedOn?: PostResponse["visitedOn"];
};
export type TripCardProps = {
  trip: TripSummary;
  posts?: readonly PostResponse[];
  dayPreviews?: readonly TripDayPreview[];
  meta?: string;
  verified?: boolean;
  stops?: number;
  stats?: readonly Stat[];
  caption?: string;
  lovedBy?: string;
  onPress?: () => void;
  onUserPress?: () => void;
  onDayPress?: (visitedOn: string) => void;
  onDaySelect?: (day: number) => void;
  onShare?: () => void;
  onAddPlaces?: () => void;
};
export function TripCard({
  trip,
  posts,
  dayPreviews,
  meta,
  verified,
  stops,
  stats,
  caption,
  lovedBy,
  onPress,
  onUserPress,
  onDayPress,
  onDaySelect,
  onShare,
  onAddPlaces,
}: TripCardProps) {
  const [width, setWidth] = useState(0);
  const previews =
    dayPreviews ??
    [...new Set(posts?.map((post) => post.visitedOn))].sort().map((date) => ({
      day: trip.startDate
        ? Math.round(
            (Date.parse(date) - Date.parse(trip.startDate)) / 86400000,
          ) + 1
        : 1,
      title:
        posts?.find((post) => post.visitedOn === date)?.location?.name ??
        posts?.find((post) => post.visitedOn === date)?.customLocationName ??
        trip.destination,
      visitedOn: date,
      coverUrl: posts
        ?.filter((post) => post.visitedOn === date)
        .flatMap((post) => post.media)
        .find((media) => media.mediaType === "image")?.url,
    }));
  const [featured, ...rest] = previews;
  const days =
    trip.startDate && trip.endDate
      ? Math.round(
          (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400000,
        ) + 1
      : previews.length;
  const canOpenDay = Boolean(onDaySelect || onDayPress);
  const openDay = (day: TripDayPreview) => {
    onDaySelect?.(day.day);
    if (day.visitedOn) onDayPress?.(day.visitedOn);
  };
  return (
    <View style={styles.card}>
      <View style={styles.actions}>
        <View style={styles.author}>
          <UserRow
            user={trip.owner}
            subtitle={meta ?? trip.destination}
            onPress={onUserPress}
            verified={verified}
          />
        </View>
      </View>
      <View style={styles.identity}>
        <View style={styles.metaRow}>
          <AppText
            variant="caption"
            color={trip.status === "draft" ? "coral" : "teal"}
          >
            {trip.status === "draft" ? "Draft itinerary" : "ITINERARY"}
          </AppText>
          <AppText variant="caption" color="placeholderGray">
            {days} {days === 1 ? "day" : "days"}
            {stops !== undefined
              ? ` · ${stops} stops`
              : trip.postCount !== undefined
                ? ` · ${trip.postCount} posts`
                : ""}
          </AppText>
        </View>
        <AppText variant="heading">{trip.title}</AppText>
        {trip.description && (
          <AppText variant="caption" color="placeholderGray" numberOfLines={3}>
            {trip.description}
          </AppText>
        )}
      </View>
      {featured ? (
        <View style={styles.previews}>
          <Pressable
            accessibilityRole={canOpenDay ? "button" : undefined}
            accessibilityLabel={`View day ${featured.day}, ${featured.title}`}
            disabled={!canOpenDay}
            onPress={() => openDay(featured)}
            style={styles.featured}
          >
            <Media
              seed={`${trip.id}-day${featured.day}`}
              url={featured.coverUrl}
              iconSize={Spacing.five}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[`${Palette.black}00`, `${Palette.black}CC`]}
              locations={[0.35, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.featuredCaption}>
              <AppText variant="caption" color="warmWhite">
                Day {featured.day}
                {canOpenDay ? " · View day" : ""}
              </AppText>
              <AppText variant="heading" color="warmWhite">
                {featured.title}
              </AppText>
            </View>
            {canOpenDay && (
              <View style={styles.viewDay}>
                <Icon name="arrow-up-right" />
              </View>
            )}
          </Pressable>
          {rest.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.moreDays}
              onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            >
              {rest.map((day) => (
                <Pressable
                  key={day.day}
                  accessibilityRole={canOpenDay ? "button" : undefined}
                  accessibilityLabel={`View day ${day.day}, ${day.title}`}
                  disabled={!canOpenDay}
                  onPress={() => openDay(day)}
                  style={[
                    styles.dayPreview,
                    {
                      width: Math.max(
                        ContentTokens.minDayWidth,
                        (width - Spacing.two) / 2,
                      ),
                    },
                  ]}
                >
                  <View style={styles.dayImage}>
                    <Media
                      seed={`${trip.id}-day${day.day}`}
                      url={day.coverUrl}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.dayLabel}>
                      <AppText variant="caption" color="warmWhite">
                        Day {day.day}
                      </AppText>
                    </View>
                  </View>
                  <AppText variant="caption">{day.title}</AppText>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : trip.coverImageUrl ? (
        <View style={styles.featured}>
          <Media
            seed={trip.id}
            url={trip.coverImageUrl}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      {stats && <StatRow items={stats} />}
      {(caption || lovedBy) && (
        <View style={styles.caption}>
          {caption && <AppText variant="caption">{caption}</AppText>}
          {lovedBy && (
            <AppText variant="caption" color="placeholderGray">
              {lovedBy}
            </AppText>
          )}
        </View>
      )}
      {trip.startDate && trip.endDate && (
        <AppText variant="caption" color="placeholderGray">
          {formatDateRange(trip.startDate, trip.endDate)}
        </AppText>
      )}
      {(onPress || onShare) && (
        <View style={[styles.actions, styles.footer]}>
          {onPress && <CardLink title="View itinerary" onPress={onPress} />}
          {onShare && <ShareAction label="Share itinerary" onPress={onShare} />}
        </View>
      )}
      {onAddPlaces && (
        <Button
          title="Add places to itinerary"
          variant="teal"
          style={styles.fullWidth}
          onPress={onAddPlaces}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.peach,
    paddingTop: Spacing.two,
  },
  card: {
    backgroundColor: Palette.white,
    borderColor: Palette.peach,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.pill,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  author: { flex: 1, minWidth: 0 },
  identity: {
    gap: Spacing.two,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    justifyContent: "space-between",
  },
  previews: {
    gap: Spacing.two,
  },
  featured: {
    height: Spacing.six * 3,
    borderRadius: Radii.medium,
    overflow: "hidden",
  },
  featuredCaption: {
    position: "absolute",
    left: Spacing.three,
    bottom: Spacing.three,
    right: Spacing.six,
    gap: Spacing.one,
  },
  viewDay: {
    position: "absolute",
    right: Spacing.three,
    bottom: Spacing.three,
    width: Spacing.five,
    height: Spacing.five,
    borderRadius: Radii.small,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.warmWhite,
  },
  moreDays: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  dayPreview: {
    gap: Spacing.two,
  },
  dayImage: {
    height: Spacing.six + Spacing.four,
    borderRadius: Radii.small,
    overflow: "hidden",
  },
  dayLabel: {
    position: "absolute",
    top: Spacing.one,
    left: Spacing.one,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
    borderRadius: Radii.small,
    backgroundColor: Palette.black,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  caption: {
    gap: Spacing.one,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
});
