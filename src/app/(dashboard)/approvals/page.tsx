'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RegularizationDTO, LeaveRequestDTO, ComplaintDTO, InventoryRequestDTO, RequestAction } from '@ems/types';
import { attendanceApi, leavesApi, complaintsApi, inventoryApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { useApprovals } from '@/context/ApprovalsContext';
import RequestInbox, { type RequestCardItem } from '@/components/requests/RequestInbox';
import styles from './approvals.module.css';

type Tab = 'all' | 'leaves' | 'regs' | 'complaints' | 'inventory';
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
  const [complaints, setComplaints] = useState<ComplaintDTO[]>([]);
  const [inventory, setInventory] = useState<InventoryRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lv, rg, cp, iv] = await Promise.all([
        leavesApi.requests('pending'),
        attendanceApi.regularizations('pending'),
        complaintsApi.list('inbox'),
        inventoryApi.list('inbox'),
      ]);
      setLeaves(lv);
      setRegs(rg);
      setComplaints(cp);
      setInventory(iv);
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
    return merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [leaves, regs]);

  const complaintCards: RequestCardItem[] = useMemo(
    () =>
      complaints.map((c) => ({
        id: c.id, title: c.subject, category: c.categoryName, employeeName: c.employeeName,
        reason: c.reason, details: c.details, status: c.status, routedTo: c.routedTo,
        timeline: c.timeline, createdAt: c.createdAt, isSelf: c.userId === user?.id,
      })),
    [complaints, user?.id],
  );
  const inventoryCards: RequestCardItem[] = useMemo(
    () =>
      inventory.map((r) => ({
        id: r.id, title: `${r.quantity} × ${r.itemName}`, category: r.categoryName, employeeName: r.employeeName,
        reason: r.reason, details: r.details, status: r.status, routedTo: r.routedTo,
        timeline: r.timeline, createdAt: r.createdAt, isSelf: r.userId === user?.id,
      })),
    [inventory, user?.id],
  );

  const decideRow = useCallback(
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

  const decideComplaint = useCallback(
    async (id: string, action: RequestAction, note?: string) => {
      setBusy(id);
      setError(null);
      try {
        await complaintsApi.decide(id, { action, note });
        await Promise.all([load(), refreshBadge()]);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setBusy(null);
      }
    },
    [load, refreshBadge],
  );

  const decideInventory = useCallback(
    async (id: string, action: RequestAction, note?: string) => {
      setBusy(id);
      setError(null);
      try {
        await inventoryApi.decide(id, { action, note });
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
        <p className={styles.subtitle}>Only approvers — Managers, Leads, Operations, Admins and Owners — can review requests.</p>
      </div>
    );
  }

  const counts = {
    all: leaves.length + regs.length + complaints.length + inventory.length,
    leaves: leaves.length,
    regs: regs.length,
    complaints: complaints.length,
    inventory: inventory.length,
  };
  const showTable = tab === 'all' || tab === 'leaves' || tab === 'regs';
  const tableRows = tab === 'leaves' ? rows.filter((r) => r.kind === 'leave') : tab === 'regs' ? rows.filter((r) => r.kind === 'reg') : rows;
  const sectionLabel = (text: string) => <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', margin: 'var(--space-5) 0 var(--space-3)' }}>{text}</h2>;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Approvals</h1>
        <p className={styles.subtitle}>Leave, attendance, complaints and inventory requests awaiting your decision.</p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`} aria-pressed={tab === 'all'} onClick={() => setTab('all')}>All ({counts.all})</button>
        <button className={`${styles.tab} ${tab === 'leaves' ? styles.tabActive : ''}`} aria-pressed={tab === 'leaves'} onClick={() => setTab('leaves')}>Leaves ({counts.leaves})</button>
        <button className={`${styles.tab} ${tab === 'regs' ? styles.tabActive : ''}`} aria-pressed={tab === 'regs'} onClick={() => setTab('regs')}>Regularizations ({counts.regs})</button>
        <button className={`${styles.tab} ${tab === 'complaints' ? styles.tabActive : ''}`} aria-pressed={tab === 'complaints'} onClick={() => setTab('complaints')}>Complaints ({counts.complaints})</button>
        <button className={`${styles.tab} ${tab === 'inventory' ? styles.tabActive : ''}`} aria-pressed={tab === 'inventory'} onClick={() => setTab('inventory')}>Inventory Requests ({counts.inventory})</button>
      </div>

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : (
        <>
          {showTable && (
            <>
              {tab === 'all' && sectionLabel('Leave & attendance')}
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
                    {tableRows.length ? (
                      tableRows.map((row) => {
                        const isSelf = row.userId === user?.id;
                        return (
                          <tr key={`${row.kind}-${row.id}`}>
                            <td>{row.kind === 'leave' ? `Leave · ${row.data.code}` : row.data.kind === 'DeviceDown' ? 'Attendance · device down' : 'Correction'}</td>
                            <td>{row.data.employeeName ?? '—'}{isSelf ? ' (you)' : ''}</td>
                            <td>
                              {row.kind === 'leave'
                                ? `${row.data.startDate} → ${row.data.endDate} · ${row.data.days}d`
                                : `${row.data.date} · ${fmtTime(row.data.requestedCheckInAt)}${row.data.requestedCheckOutAt ? `–${fmtTime(row.data.requestedCheckOutAt)}` : ''}`}
                            </td>
                            <td>{row.data.reason}</td>
                            <td><span className={`${styles.badge} ${statusBadge(row.data.status)}`}>{row.data.status}</span></td>
                            <td>
                              <div className={styles.rowActions}>
                                <button className={`${styles.btn} ${styles.btnGhostOk}`} disabled={isSelf || busy === row.id} onClick={() => decideRow(row, true)} title={isSelf ? 'You cannot approve your own request' : undefined}>Approve</button>
                                <button className={`${styles.btn} ${styles.btnGhostDanger}`} disabled={isSelf || busy === row.id} onClick={() => decideRow(row, false)}>Reject</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan={6} className={styles.empty}>Nothing awaiting your approval.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {(tab === 'all' || tab === 'complaints') && (
            <>
              {tab === 'all' && sectionLabel('Complaints')}
              <RequestInbox items={complaintCards} onDecide={decideComplaint} busyId={busy} emptyText="No complaints awaiting your action." />
            </>
          )}

          {(tab === 'all' || tab === 'inventory') && (
            <>
              {tab === 'all' && sectionLabel('Inventory requests')}
              <RequestInbox items={inventoryCards} onDecide={decideInventory} busyId={busy} emptyText="No inventory requests awaiting your action." />
            </>
          )}
        </>
      )}
    </>
  );
}
