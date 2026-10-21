import type { ToastVariant } from '@/constants/toast-tokens';

export type ToastOptions = { message: string; variant?: ToastVariant; duration?: number };
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
