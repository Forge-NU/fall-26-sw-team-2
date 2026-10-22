import { Pressable, StyleSheet, View } from "react-native";
import type { UserResponse } from "shared-types";
import { AppText } from "@/components/ui/app-text";
import { Avatar } from "@/components/ui/avatar";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spacing } from "@/constants/theme";
import { Icon, type IconName } from "@/components/icon";
import { ButtonTokens } from "@/constants/button-tokens";

export type UserRowProps = {
  user: UserResponse;
  subtitle?: string;
  subtitleIcon?: IconName;
  verified?: boolean;
  onPress?: () => void;
  action?: Pick<
    ButtonProps,
    "title" | "onPress" | "variant" | "loading" | "disabled"
  >;
};

export function UserRow({
  user,
  subtitle,
  subtitleIcon,
  verified,
  onPress,
  action,
}: UserRowProps) {
  const name = `${user.firstName} ${user.lastName}`.trim() || user.username;
  const identity = (
    <>
      <Avatar name={name} uri={user.avatarUrl} size="small" />
      <View style={styles.copy}>
        <View style={styles.name}>
          <AppText
            variant="label"
            numberOfLines={1}
            style={styles.subtitleText}
          >
            {name}
          </AppText>
          {verified && <Icon name="badge-check" size={Spacing.three} />}
        </View>
        <View style={styles.subtitle}>
          {subtitleIcon && (
            <Icon
              name={subtitleIcon}
              size={Spacing.three}
              color="placeholderGray"
            />
          )}
          <AppText
            variant="caption"
            color="placeholderGray"
            numberOfLines={2}
            style={styles.subtitleText}
          >
            {subtitle ?? `@${user.username}`}
          </AppText>
        </View>
      </View>
    </>
  );
  return (
    <View style={styles.row}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${name}'s profile`}
          onPress={onPress}
          style={styles.identity}
        >
          {identity}
        </Pressable>
      ) : (
        <View style={styles.identity}>{identity}</View>
      )}
      {action && (
        <View style={styles.actionArea}>
          <Button {...action} size="compact" style={styles.action} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  name: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    flex: 1,
    minWidth: 0,
  },
  copy: { flex: 1, minWidth: 0, gap: Spacing.half },
  subtitle: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  subtitleText: { flexShrink: 1 },
  action: { minWidth: 0, flexShrink: 1 },
  actionArea: {
    minHeight: ButtonTokens.minHeight,
    justifyContent: "center",
    flexShrink: 1,
  },
});
