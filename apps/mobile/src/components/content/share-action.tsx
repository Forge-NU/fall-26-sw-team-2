import { Pressable, StyleSheet } from "react-native";
import { Icon } from "@/components/icon";
import { ContentTokens } from "@/constants/content-tokens";
import { Spacing } from "@/constants/theme";

export function ShareAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.action}
    >
      <Icon name="send" size={Spacing.three + Spacing.one} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    minHeight: ContentTokens.actionSize,
    minWidth: ContentTokens.actionSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },
});
