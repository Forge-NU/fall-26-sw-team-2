import { Pressable, StyleSheet, View } from "react-native";
import { IconButton } from "@/components/ui/icon-button";
import { AppText } from "@/components/ui/app-text";
import { Spacing } from "@/constants/theme";
import { Icon, type IconName } from "@/components/icon";
import { ContentTokens } from "@/constants/content-tokens";

export type Stat = {
  key: string;
  label: string;
  count: number;
  onPress?: () => void;
  icon?: IconName;
  selected?: boolean;
};
export function StatRow({ items }: { items: readonly Stat[] }) {
  return (
    <View style={styles.row}>
      {items.map((item) => {
        const label = `${item.count.toLocaleString()} ${item.label}`;
        if (item.onPress && item.icon) {
          return (
            <IconButton
              key={item.key}
              icon={item.icon}
              selectedIcon={item.icon === "heart" ? "heart-filled" : undefined}
              selected={item.selected}
              count={item.count}
              accessibilityLabel={label}
              onPress={item.onPress}
            />
          );
        }
        const content = (
          <>
            {item.icon && (
              <Icon
                name={
                  item.icon === "heart" && item.selected
                    ? "heart-filled"
                    : item.icon
                }
                size={Spacing.four}
                color={item.selected ? "coral" : "black"}
              />
            )}
            <AppText variant="label">{item.count.toLocaleString()}</AppText>
            {!item.icon && (
              <AppText variant="caption" color="placeholderGray">
                {item.label}
              </AppText>
            )}
          </>
        );
        return item.onPress ? (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={
              item.selected === undefined
                ? undefined
                : { selected: item.selected }
            }
            onPress={item.onPress}
            style={[styles.stat, styles.action]}
          >
            {content}
          </Pressable>
        ) : (
          <View
            key={item.key}
            accessible
            accessibilityLabel={label}
            style={styles.stat}
          >
            {content}
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  action: { minHeight: ContentTokens.actionSize },
  row: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.three },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
});
