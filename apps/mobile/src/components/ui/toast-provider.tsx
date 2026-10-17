import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

      const duration = options.duration ?? ToastTokens.duration;

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

  const colors = ToastTokens.variants[toast?.variant ?? 'info'];

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      <View style={styles.root}>
        {children}

        {toast && (
          <View
            pointerEvents="box-none"
            style={[
              styles.overlay,
              {
                top: insets.top + ToastTokens.screenMargin,
              },
            ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${toast.message}. Dismiss notification`}
              accessibilityLiveRegion="polite"
              onPress={hideToast}
              style={[
                styles.toast,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}>
              <Text style={styles.message}>{toast.message}</Text>
            </Pressable>
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
    borderRadius: ToastTokens.borderRadius,
    borderWidth: ToastTokens.borderWidth,
    paddingHorizontal: ToastTokens.paddingHorizontal,
    paddingVertical: ToastTokens.paddingVertical,
  },
  message: {
    ...ToastTokens.typography,
    color: ToastTokens.text,
  },
});
