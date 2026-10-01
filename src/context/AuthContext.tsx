'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthUserDTO, EmployeeProfileDTO } from '@ems/types';
import { authApi } from '@/lib/auth';
import { setAccessToken } from '@/lib/authToken';

interface AuthState {
  user: AuthUserDTO | null;
  profile: EmployeeProfileDTO | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadMe: () => Promise<void>;
  /** True for Owner accountType or Admin org role (org-wide management). */
  isOrgAdmin: boolean;
  /** True for Owner/Admin OR Manager — may add & onboard employees and change
   *  Member/Lead roles. Admin-only actions (deactivate, grant Manager/Admin)
   *  still gate on isOrgAdmin / the backend. */
  canManageEmployees: boolean;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserDTO | null>(null);
  const [profile, setProfile] = useState<EmployeeProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadMe = useCallback(async () => {
    const me = await authApi.me();
    setUser(me.user);
    setProfile(me.profile);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await authApi.refresh(); // uses the httpOnly refresh cookie
        if (!alive) return;
        setAccessToken(r.accessToken);
        await reloadMe();
      } catch {
        setAccessToken(null);
        if (alive) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await authApi.login(email, password);
      setAccessToken(r.accessToken);
      await reloadMe();
    },
    [reloadMe],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUser(null);
    setProfile(null);
  }, []);

  const isOrgAdmin = !!user && (user.accountType === 'Owner' || user.orgRole === 'Admin');
  const canManageEmployees = isOrgAdmin || (!!user && user.orgRole === 'Manager');

  return (
    <AuthCtx.Provider
      value={{ user, profile, loading, login, logout, reloadMe, isOrgAdmin, canManageEmployees }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
