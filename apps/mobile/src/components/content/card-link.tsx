import { Pressable, StyleSheet } from "react-native";
import { Icon } from "@/components/icon";
import { AppText } from "@/components/ui/app-text";
import { Palette, Radii, Spacing } from "@/constants/theme";
import { ContentTokens } from "@/constants/content-tokens";

export function CardLink({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <AppText variant="label" color="teal">
        {title}
      </AppText>
      <Icon name="arrow-right" color="teal" size={Spacing.three} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  link: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    minHeight: ContentTokens.actionSize,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.small,
  },
  pressed: { backgroundColor: Palette.peach },
});
