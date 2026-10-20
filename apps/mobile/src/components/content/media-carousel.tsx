import { Image } from "expo-image";
import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import type { MediaResponse } from "shared-types";
import { AppText } from "@/components/ui/app-text";
import { Icon } from "@/components/icon";
import { ContentTokens } from "@/constants/content-tokens";
import { EmptyState } from "@/components/ui/empty-state";
import { Palette, Radii, Spacing } from "@/constants/theme";

export type Photo = Omit<MediaResponse, "mediaType"> & { mediaType: "image" };

export function MediaCarousel({ items }: { items: readonly Photo[] }) {
  // Reset the page on data changes; a width change remounts only the pager.
  return (
    <Carousel key={items.map((item) => item.id).join(":")} items={items} />
  );
}
function Carousel({ items }: { items: readonly Photo[] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<Photo>>(null);
  const move = (next: number) => {
    setIndex(next);
    list.current?.scrollToOffset({ offset: next * width, animated: true });
  };
  return (
    <View
      style={styles.container}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {items.length === 0 ? (
        <EmptyState title="No photos yet" />
      ) : (
        width > 0 && (
          <>
            <FlatList
              key={width}
              ref={list}
              data={items}
              horizontal
              pagingEnabled
              initialScrollIndex={index}
              scrollEnabled={items.length > 1}
              showsHorizontalScrollIndicator={false}
              initialNumToRender={1}
              maxToRenderPerBatch={3}
              windowSize={3}
              keyExtractor={(item) => item.id}
              getItemLayout={(_, i) => ({
                length: width,
                offset: width * i,
                index: i,
              })}
              onScroll={(event) =>
                setIndex(
                  Math.max(
                    0,
                    Math.min(
                      items.length - 1,
                      Math.round(event.nativeEvent.contentOffset.x / width),
                    ),
                  ),
                )
              }
              scrollEventThrottle={16}
              renderItem={({ item, index: i }) => (
                <PhotoFrame
                  key={item.url}
                  photo={item}
                  width={width}
                  label={`Photo ${i + 1} of ${items.length}`}
                />
              )}
            />
            {items.length > 1 && (
              <>
                <View style={styles.pageBadge} pointerEvents="none">
                  <AppText
                    variant="caption"
                    color="white"
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`Photo ${index + 1} of ${items.length}`}
                  >
                    {index + 1}/{items.length}
                  </AppText>
                </View>
                <View style={styles.controls} pointerEvents="box-none">
                  {index > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Previous photo"
                      onPress={() => move(index - 1)}
                      style={({ pressed }) => [
                        styles.control,
                        pressed && styles.activeControl,
                      ]}
                    >
                      <Icon
                        name="chevron-left"
                        size={Spacing.four}
                        color="teal"
                      />
                    </Pressable>
                  ) : (
                    <View style={styles.controlSpace} />
                  )}
                  {index < items.length - 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Next photo"
                      onPress={() => move(index + 1)}
                      style={({ pressed }) => [
                        styles.control,
                        pressed && styles.activeControl,
                      ]}
                    >
                      <Icon
                        name="chevron-right"
                        size={Spacing.four}
                        color="teal"
                      />
                    </Pressable>
                  ) : (
                    <View style={styles.controlSpace} />
                  )}
                </View>
              </>
            )}
          </>
        )
      )}
    </View>
  );
}
function PhotoFrame({
  photo,
  width,
  label,
}: {
  photo: Photo;
  width: number;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={[
        styles.photo,
        {
          width,
          height: Math.min(
            width / ContentTokens.photoAspectRatio,
            ContentTokens.maxPhotoHeight,
          ),
        },
      ]}
    >
      {failed || !photo.url ? (
        <AppText variant="caption">Photo unavailable</AppText>
      ) : (
        <Image
          source={{ uri: photo.url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityLabel={label}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { width: "100%", gap: Spacing.two, overflow: "hidden" },
  photo: {
    borderRadius: Radii.medium,
    backgroundColor: Palette.peach,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  controls: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.two,
  },
  pageBadge: {
    position: "absolute",
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: Palette.black,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  control: {
    width: ContentTokens.actionSize,
    height: ContentTokens.actionSize,
    borderRadius: Radii.circle,
    backgroundColor: Palette.warmWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  activeControl: { backgroundColor: Palette.lightTeal },
  controlSpace: {
    width: ContentTokens.actionSize,
    height: ContentTokens.actionSize,
  },
});
