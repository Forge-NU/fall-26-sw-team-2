import { Alert } from 'react-native';

export type ConfirmActionOptions = {
  title: string;
  /** Only when it adds a fact the title doesn't, like "This can't be undone." */
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red label, for actions that delete or end something */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

/**
 * Asks before an action with the system alert. The alert has no spinner, so a
 * screen that waits on the request shows its own busy state.
 */
export function confirmAction({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmActionOptions) {
  Alert.alert(
    title,
    message,
    [
      { text: cancelLabel, style: 'cancel', onPress: onCancel },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ],
    { cancelable: true, onDismiss: onCancel },
  );
}
