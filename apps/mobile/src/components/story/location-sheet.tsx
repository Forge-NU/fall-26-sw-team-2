import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
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
        <AppText variant="caption">
          Skip location
        </AppText>
      </Pressable>
      <Button
        title="Confirm location"
        disabled={!pending}
        style={styles.fullWidth}
        onPress={() => onConfirm(pending)}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    alignSelf: 'stretch',
  },
  skip: {
    alignItems: 'center',
  },
});
