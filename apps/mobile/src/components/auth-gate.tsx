import type { ReactNode } from 'react';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useAuth } from '@/lib/auth';

/** Shows its children only when signed in. ACCT-1 (#29) swaps in the real sign-in screen. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <PlaceholderScreen title="Sign in" />;
  return children;
}
