import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Palette } from '@/constants/palette';
import { Radii, Spacing, Typography } from '@/constants/theme';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Alert.alert does nothing on web, so confirmations use this instead
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable
        accessibilityLabel="Close"
        style={styles.backdrop}
        onPress={loading ? undefined : onCancel}>
        <Pressable accessibilityRole="alert" style={styles.card}>
          <AppText variant="subheading" style={styles.center}>
            {title}
          </AppText>
          <AppText variant="label" style={[styles.center, styles.message]}>
            {message}
          </AppText>
          <View style={styles.actions}>
            <Button title={confirmLabel} loading={loading} onPress={onConfirm} style={styles.button} />
            <Button
              title={cancelLabel}
              variant="teal"
              disabled={loading}
              onPress={onCancel}
              style={styles.button}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radii.medium * 2,
    backgroundColor: Palette.warmWhite,
  },
  center: { textAlign: 'center' },
  message: { color: Palette.placeholderGray, fontFamily: Typography.body.fontFamily },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  button: { width: '100%' },
});
