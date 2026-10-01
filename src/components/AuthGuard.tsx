'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/** Client gate for the authenticated shell: redirects to /login when there is
 *  no session. RBAC on the server is the real control; this is UX only. */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>Loading…</div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}
