import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
// TODO(POST-2): replace with the real LocationPicker once it is merged.
import { LocationPickerPlaceholder } from '@/components/story/location-picker-placeholder';
import type { NearbyPlace } from '@/data/mock';

type LocationSheetProps = {
  visible: boolean;
  value: NearbyPlace | null;
  onConfirm: (place: NearbyPlace | null) => void;
  onClose: () => void;
};

export function LocationSheet(props: LocationSheetProps) {
  // Remount each time it opens so the pending pick starts from the current value.
  return props.visible ? <LocationSheetContent {...props} /> : null;
}

function LocationSheetContent({ value, onConfirm, onClose }: LocationSheetProps) {
  const [pending, setPending] = useState(value);

  return (
    <BottomSheet visible onClose={onClose} title="Add a location">
      <LocationPickerPlaceholder value={pending} onChange={setPending} />
      <Pressable accessibilityRole="button" onPress={() => onConfirm(null)} style={styles.skip}>
        <AppText variant="bold" size={12}>
          Skip location
        </AppText>
      </Pressable>
      <ActionButton
        label="Confirm location"
        trailingIcon="arrow-right-white"
        disabled={!pending}
        onPress={() => onConfirm(pending)}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  skip: {
    alignItems: 'center',
  },
});
