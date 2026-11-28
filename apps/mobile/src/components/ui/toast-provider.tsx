import Ionicons from '@expo/vector-icons/Ionicons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { ToastTokens } from '@/constants/toast-tokens';
import { subscribeToToasts, type ToastOptions } from '@/lib/toast';

export type { ToastOptions } from '@/lib/toast';

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const showToast = useCallback(
    (options: ToastOptions) => {
      if (!options.message.trim()) {
        return;
      }

      clearTimer();
      setToast(options);

      const duration =
        options.duration ?? (options.action ? ToastTokens.actionDuration : ToastTokens.duration);

      if (duration > 0) {
        timer.current = setTimeout(hideToast, duration);
      }
    },
    [clearTimer, hideToast],
  );

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  useEffect(() => subscribeToToasts(showToast), [showToast]);

  const variant = ToastTokens.variants[toast?.variant ?? 'info'];
  const bottom = toast?.placement === 'bottom';

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      <View style={styles.root}>
        {children}

        {toast && (
          <View
            pointerEvents="box-none"
            style={[
              styles.overlay,
              bottom
                ? { bottom: insets.bottom + BottomTabInset + ToastTokens.screenMargin }
                : { top: insets.top + ToastTokens.screenMargin },
            ]}>
            <View
              accessibilityLiveRegion="polite"
              style={[styles.toast, { backgroundColor: variant.background }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${toast.message}. Dismiss notification`}
                onPress={hideToast}
                style={styles.body}>
                <Ionicons
                  name={variant.glyph as ComponentProps<typeof Ionicons>['name']}
                  size={ToastTokens.iconSize}
                  color={variant.icon}
                  accessible={false}
                />
                <Text style={[styles.message, { color: variant.text }]}>{toast.message}</Text>
              </Pressable>
              {toast.action && (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={ToastTokens.paddingVertical}
                  onPress={() => {
                    toast.action?.onPress();
                    hideToast();
                  }}>
                  <Text style={styles.action}>{toast.action.label}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }

  return context;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: ToastTokens.screenMargin,
    right: ToastTokens.screenMargin,
    alignItems: 'center',
    zIndex: 2000,
  },
  toast: {
    width: '100%',
    maxWidth: ToastTokens.maxWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ToastTokens.gap,
    borderRadius: ToastTokens.borderRadius,
    paddingHorizontal: ToastTokens.paddingHorizontal,
    paddingVertical: ToastTokens.paddingVertical,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ToastTokens.gap,
  },
  message: {
    ...ToastTokens.typography,
    flex: 1,
  },
  action: {
    ...ToastTokens.actionTypography,
    color: ToastTokens.actionText,
  },
});
