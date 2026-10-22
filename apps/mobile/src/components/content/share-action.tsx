import { IconButton } from "@/components/ui/icon-button";
import { Spacing } from "@/constants/theme";

export function ShareAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <IconButton
      icon="send"
      iconSize={Spacing.three + Spacing.one}
      accessibilityLabel={label}
      onPress={onPress}
    />
  );
}
