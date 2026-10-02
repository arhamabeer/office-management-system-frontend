'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { ApprovalsCountDTO } from '@ems/types';
import { approvalsApi } from '@/lib/auth';
import { useAuth } from './AuthContext';

interface ApprovalsState {
  count: ApprovalsCountDTO;
  /** True for anyone who can decide approvals: Owner or any non-Member org role. */
  isApprover: boolean;
  refresh: () => Promise<void>;
}

const EMPTY: ApprovalsCountDTO = { regularizations: 0, leaves: 0, complaints: 0, inventoryRequests: 0, total: 0 };
const ApprovalsCtx = createContext<ApprovalsState | undefined>(undefined);

/**
 * Shares one live pending-approvals count between the sidebar badge and the
 * approvals inbox, so a decision made in the inbox updates the badge. Fetches
 * only for approvers; any error degrades quietly to zero.
 */
export function ApprovalsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isApprover = !!user && (user.accountType === 'Owner' || user.orgRole !== 'Member');
  const [count, setCount] = useState<ApprovalsCountDTO>(EMPTY);

  const refresh = useCallback(async () => {
    if (!isApprover) {
      setCount(EMPTY);
      return;
    }
    try {
      setCount(await approvalsApi.count());
    } catch {
      setCount(EMPTY);
    }
  }, [isApprover]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ApprovalsCtx.Provider value={{ count, isApprover, refresh }}>{children}</ApprovalsCtx.Provider>
  );
}

export function useApprovals(): ApprovalsState {
  const ctx = useContext(ApprovalsCtx);
  if (!ctx) throw new Error('useApprovals must be used within an ApprovalsProvider');
  return ctx;
}
