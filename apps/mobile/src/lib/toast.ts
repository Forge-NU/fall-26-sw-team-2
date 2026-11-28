import type { ToastVariant } from '@/constants/toast-tokens';

export type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  /** In ms. A toast with an action defaults to ToastTokens.actionDuration. 0 stays until tapped. */
  duration?: number;
  /** One action, like Undo. Tapping it runs onPress and closes the toast. */
  action?: { label: string; onPress: () => void };
  /** top (default) or bottom, above the tab bar */
  placement?: 'top' | 'bottom';
};
type Listener = (options: ToastOptions) => void;
const listeners = new Set<Listener>();

export function showToast(options: ToastOptions): boolean {
  if (!options.message.trim() || !listeners.size) return false;
  for (const listener of listeners) listener(options);
  return true;
}

/** Provider lifecycle bridge; callers normally use showToast or useToast. */
export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
