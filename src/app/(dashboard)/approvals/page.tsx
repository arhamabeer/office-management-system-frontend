'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RegularizationDTO, LeaveRequestDTO } from '@ems/types';
import { attendanceApi, leavesApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { useApprovals } from '@/context/ApprovalsContext';
import styles from './approvals.module.css';

type Tab = 'all' | 'leaves' | 'regs';
type Row =
  | { kind: 'leave'; id: string; createdAt: string; userId: string; data: LeaveRequestDTO }
  | { kind: 'reg'; id: string; createdAt: string; userId: string; data: RegularizationDTO };

function statusBadge(status: string): string {
  if (status === 'Approved') return styles.bApproved;
  if (status === 'Pending') return styles.bPending;
  return styles.bRejected;
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const { refresh: refreshBadge, isApprover } = useApprovals();
  const [tab, setTab] = useState<Tab>('all');
  const [leaves, setLeaves] = useState<LeaveRequestDTO[]>([]);
  const [regs, setRegs] = useState<RegularizationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lv, rg] = await Promise.all([
        leavesApi.requests('pending'),
        attendanceApi.regularizations('pending'),
      ]);
      setLeaves(lv);
      setRegs(rg);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isApprover) void load();
    else setLoading(false);
  }, [isApprover, load]);

  const rows: Row[] = useMemo(() => {
    const merged: Row[] = [
      ...leaves.map((d) => ({ kind: 'leave' as const, id: d.id, createdAt: d.createdAt, userId: d.userId, data: d })),
      ...regs.map((d) => ({ kind: 'reg' as const, id: d.id, createdAt: d.createdAt, userId: d.userId, data: d })),
    ];
    const filtered =
      tab === 'leaves'
        ? merged.filter((r) => r.kind === 'leave')
        : tab === 'regs'
          ? merged.filter((r) => r.kind === 'reg')
          : merged;
    return filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [leaves, regs, tab]);

  const decide = useCallback(
    async (row: Row, approve: boolean) => {
      setBusy(row.id);
      setError(null);
      try {
        if (row.kind === 'leave') {
          if (approve) await leavesApi.approve(row.id);
          else await leavesApi.reject(row.id);
        } else {
          if (approve) await attendanceApi.approveRegularization(row.id);
          else await attendanceApi.rejectRegularization(row.id);
        }
        await Promise.all([load(), refreshBadge()]);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setBusy(null);
      }
    },
    [load, refreshBadge],
  );

  if (!isApprover) {
    return (
      <div className={styles.header}>
        <h1 className={styles.title}>Approvals</h1>
        <p className={styles.subtitle}>
          Only approvers — Managers, Leads, Admins and Owners — can review requests.
        </p>
      </div>
    );
  }

  const counts = { all: leaves.length + regs.length, leaves: leaves.length, regs: regs.length };

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Approvals</h1>
        <p className={styles.subtitle}>
          Pending leave and attendance-regularization requests awaiting your decision.
        </p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`} aria-pressed={tab === 'all'} onClick={() => setTab('all')}>
          All ({counts.all})
        </button>
        <button className={`${styles.tab} ${tab === 'leaves' ? styles.tabActive : ''}`} aria-pressed={tab === 'leaves'} onClick={() => setTab('leaves')}>
          Leaves ({counts.leaves})
        </button>
        <button className={`${styles.tab} ${tab === 'regs' ? styles.tabActive : ''}`} aria-pressed={tab === 'regs'} onClick={() => setTab('regs')}>
          Regularizations ({counts.regs})
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Employee</th>
              <th scope="col">Details</th>
              <th scope="col">Reason</th>
              <th scope="col">Status</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className={styles.empty}>Loading…</td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => {
                const isSelf = row.userId === user?.id;
                return (
                  <tr key={`${row.kind}-${row.id}`}>
                    <td>{row.kind === 'leave' ? `Leave · ${row.data.code}` : row.data.kind === 'DeviceDown' ? 'Attendance · device down' : 'Correction'}</td>
                    <td>
                      {row.data.employeeName ?? '—'}
                      {isSelf ? ' (you)' : ''}
                    </td>
                    <td>
                      {row.kind === 'leave'
                        ? `${row.data.startDate} → ${row.data.endDate} · ${row.data.days}d`
                        : `${row.data.date} · ${fmtTime(row.data.requestedCheckInAt)}${row.data.requestedCheckOutAt ? `–${fmtTime(row.data.requestedCheckOutAt)}` : ''}`}
                    </td>
                    <td>{row.data.reason}</td>
                    <td>
                      <span className={`${styles.badge} ${statusBadge(row.data.status)}`}>{row.data.status}</span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          className={`${styles.btn} ${styles.btnGhostOk}`}
                          disabled={isSelf || busy === row.id}
                          onClick={() => decide(row, true)}
                          title={isSelf ? 'You cannot approve your own request' : undefined}
                        >
                          Approve
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnGhostDanger}`}
                          disabled={isSelf || busy === row.id}
                          onClick={() => decide(row, false)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className={styles.empty}>Nothing awaiting your approval.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
