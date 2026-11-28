import type { ViewProps } from 'react-native';

import { EmptyState } from './empty-state';

export type LoadErrorProps = ViewProps & {
  /** Finishes "Couldn't load …", e.g. "this trip" or "your saved posts". */
  what?: string;
  /** Shows "Try again" when set */
  onRetry?: () => void;
};

/**
 * The one load-failure state: "Couldn't load …" and one "Try again". Never shows
 * the raw error, which means nothing to the person using the app.
 */
export function LoadError({ what = 'this', onRetry, ...props }: LoadErrorProps) {
  return (
    <EmptyState
      {...props}
      icon="cloud-offline-outline"
      title={`Couldn't load ${what}`}
      action={onRetry ? { title: 'Try again', variant: 'secondary', onPress: onRetry } : undefined}
    />
  );
}
