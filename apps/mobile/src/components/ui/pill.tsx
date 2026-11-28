import { Chip } from './chip';

// Old name for Chip, kept so screens compile until their redesign tickets move
// to `Chip`. There is no `live` state any more.
export type PillState = 'default' | 'selected';

export type PillProps = {
  label: string;
  state?: PillState;
  showPin?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Pill({ label, state = 'default', showPin = false, onPress, accessibilityLabel }: PillProps) {
  return (
    <Chip
      label={label}
      selected={state === 'selected'}
      leadingIcon={showPin ? 'map-pin' : undefined}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
    />
  );
}
