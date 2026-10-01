'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LeaveBalanceDTO, LeaveRequestDTO, LeaveTypeDTO, LeavePolicyDTO } from '@ems/types';
import { leavesApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './leaves.module.css';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
function statusBadge(status: string): string {
  if (status === 'Approved') return styles.bApproved;
  if (status === 'Pending') return styles.bPending;
  return styles.bRejected;
}

type Tab = 'my' | 'team' | 'settings';

export default function LeavesPage() {
  const { user } = useAuth();
  const canTeam = !!user && (user.accountType === 'Owner' || user.orgRole !== 'Member');
  const isOrgAdmin = !!user && (user.accountType === 'Owner' || user.orgRole === 'Admin');

  const [tab, setTab] = useState<Tab>('my');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [types, setTypes] = useState<LeaveTypeDTO[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceDTO[]>([]);
  const [myReqs, setMyReqs] = useState<LeaveRequestDTO[]>([]);
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({ typeId: '', startDate: today(), endDate: today(), reason: '' });

  const [pending, setPending] = useState<LeaveRequestDTO[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRequestDTO[]>([]);

  const [policy, setPolicy] = useState<LeavePolicyDTO | null>(null);
  const [newType, setNewType] = useState({ name: '', code: '', defaultQuota: 0, paid: true, requiresApproval: true });
  const [editType, setEditType] = useState<{
    id: string;
    name: string;
    defaultQuota: number;
    paid: boolean;
    requiresApproval: boolean;
  } | null>(null);

  const loadMy = useCallback(async () => {
    setError(null);
    try {
      const [t, b, r] = await Promise.all([
        leavesApi.types(),
        leavesApi.balance(),
        leavesApi.requests('mine'),
      ]);
      setTypes(t);
      setBalances(b);
      setMyReqs(r);
      setForm((f) => ({ ...f, typeId: f.typeId || t[0]?.id || '' }));
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  const loadTeam = useCallback(async () => {
    setError(null);
    try {
      const [p, cal] = await Promise.all([leavesApi.requests('pending'), leavesApi.calendar()]);
      setPending(p);
      setTeamLeaves(cal);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setError(null);
    try {
      const [t, p] = await Promise.all([leavesApi.types(), leavesApi.policy()]);
      setTypes(t);
      setPolicy(p);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    void loadMy();
  }, [loadMy]);
  useEffect(() => {
    if (tab === 'team') void loadTeam();
    if (tab === 'settings') void loadSettings();
  }, [tab, loadTeam, loadSettings]);

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await leavesApi.apply(form);
      setShowApply(false);
      setForm({ typeId: types[0]?.id ?? '', startDate: today(), endDate: today(), reason: '' });
      setInfo('Leave request submitted.');
      await loadMy();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this leave request?')) return;
    setError(null);
    try {
      await leavesApi.cancel(id);
      await loadMy();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const decide = async (id: string, approve: boolean) => {
    setError(null);
    try {
      if (approve) await leavesApi.approve(id);
      else await leavesApi.reject(id);
      await loadTeam();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const addType = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await leavesApi.createType(newType);
      setNewType({ name: '', code: '', defaultQuota: 0, paid: true, requiresApproval: true });
      await loadSettings();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const saveType = async () => {
    if (!editType) return;
    setError(null);
    try {
      await leavesApi.updateType(editType.id, {
        name: editType.name.trim(),
        defaultQuota: editType.defaultQuota,
        paid: editType.paid,
        requiresApproval: editType.requiresApproval,
      });
      setEditType(null);
      setInfo('Leave type updated.');
      await loadSettings();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const savePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    setError(null);
    try {
      setPolicy(await leavesApi.updatePolicy(policy));
      setInfo('Policy saved.');
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Leaves</h1>
        <p className={styles.subtitle}>Your balance, requests, and approvals.</p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'my' ? styles.tabActive : ''}`} aria-pressed={tab === 'my'} onClick={() => setTab('my')}>My leaves</button>
        {canTeam && <button className={`${styles.tab} ${tab === 'team' ? styles.tabActive : ''}`} aria-pressed={tab === 'team'} onClick={() => setTab('team')}>Team</button>}
        {isOrgAdmin && <button className={`${styles.tab} ${tab === 'settings' ? styles.tabActive : ''}`} aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>Settings</button>}
      </div>

      {tab === 'my' && (
        <>
          <div className={styles.balances}>
            {balances.map((b) => {
              const pct = b.entitled ? Math.min(100, Math.round(((b.entitled - b.remaining) / b.entitled) * 100)) : 0;
              return (
                <div className={styles.balCard} key={b.typeId}>
                  <div className={styles.balName}>{b.typeName}</div>
                  <div className={styles.balRemain}>{b.remaining}</div>
                  <div className={styles.balOf}>of {b.entitled} {b.paid ? 'days' : '(unpaid)'}</div>
                  {b.entitled > 0 && <div className={styles.bar}><div className={styles.barFill} style={{ width: `${pct}%` }} /></div>}
                  <div className={styles.balMeta}><span>Used {b.used}</span><span>Pending {b.pending}</span></div>
                </div>
              );
            })}
          </div>

          <div className={styles.toolbar}>
            <div className={styles.spacer} />
            <button className={styles.btn} onClick={() => leavesApi.exportRequests('mine').catch((e) => setError(errMsg(e)))}>
              Export Excel
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowApply((v) => !v)}>
              {showApply ? 'Cancel' : 'Apply for leave'}
            </button>
          </div>

          {showApply && (
            <form className={styles.card} onSubmit={apply}>
              <div className={styles.cardTitle}>Apply for leave</div>
              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  Type
                  <select className={styles.select} value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })} required>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <label className={styles.formField}>
                  Start date
                  <input className={styles.input} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                </label>
                <label className={styles.formField}>
                  End date
                  <input className={styles.input} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
                </label>
                <label className={styles.formField} style={{ gridColumn: '1 / -1' }}>
                  Reason
                  <input className={styles.input} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} minLength={3} required />
                </label>
              </div>
              <div className={styles.formActions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Submit request</button>
              </div>
            </form>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th scope="col">Type</th><th scope="col">Dates</th><th scope="col">Days</th><th scope="col">Status</th><th></th></tr></thead>
              <tbody>
                {myReqs.length ? myReqs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.typeName}</td>
                    <td>{r.startDate}{r.endDate !== r.startDate ? ` → ${r.endDate}` : ''}</td>
                    <td>{r.days}</td>
                    <td><span className={`${styles.badge} ${statusBadge(r.status)}`}>{r.status}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      {(r.status === 'Pending' || r.status === 'Approved') && (
                        <button className={`${styles.btn} ${styles.btnGhostDanger}`} onClick={() => cancel(r.id)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                )) : <tr><td colSpan={5} className={styles.empty}>No leave requests yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'team' && canTeam && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.spacer} />
            <button className={styles.btn} onClick={() => leavesApi.exportRequests('team').catch((e) => setError(errMsg(e)))}>
              Export team Excel
            </button>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Pending approvals ({pending.length})</div>
            {pending.length ? pending.map((r) => (
              <div className={styles.row} key={r.id}>
                <span><strong>{r.employeeName ?? r.userId}</strong> · {r.typeName} · {r.startDate}{r.endDate !== r.startDate ? `→${r.endDate}` : ''} ({r.days}d) · {r.reason}</span>
                <span className={styles.rowActions}>
                  <button className={`${styles.btn} ${styles.btnGhostOk}`} onClick={() => decide(r.id, true)}>Approve</button>
                  <button className={`${styles.btn} ${styles.btnGhostDanger}`} onClick={() => decide(r.id, false)}>Reject</button>
                </span>
              </div>
            )) : <div className={styles.empty}>No pending requests.</div>}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Team leave this month</div>
            {teamLeaves.length ? teamLeaves.map((r) => (
              <div className={styles.row} key={r.id}>
                <span><strong>{r.employeeName ?? r.userId}</strong> · {r.typeName}</span>
                <span>{r.startDate}{r.endDate !== r.startDate ? ` → ${r.endDate}` : ''} ({r.days}d)</span>
              </div>
            )) : <div className={styles.empty}>No approved leave this month.</div>}
          </div>
        </>
      )}

      {tab === 'settings' && isOrgAdmin && (
        <>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Leave types</div>
            {types.map((t) =>
              editType?.id === t.id ? (
                <div className={styles.row} key={t.id} style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <input className={styles.input} aria-label="Leave type name" value={editType.name} onChange={(e) => setEditType({ ...editType, name: e.target.value })} />
                  <input className={styles.input} type="number" aria-label="Default quota (days)" style={{ maxWidth: 90 }} value={editType.defaultQuota} onChange={(e) => setEditType({ ...editType, defaultQuota: Number(e.target.value) })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)' }}>
                    <input type="checkbox" checked={editType.paid} onChange={(e) => setEditType({ ...editType, paid: e.target.checked })} /> paid
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)' }}>
                    <input type="checkbox" checked={editType.requiresApproval} onChange={(e) => setEditType({ ...editType, requiresApproval: e.target.checked })} /> approval
                  </label>
                  <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                    <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={saveType}>Save</button>
                    <button className={styles.btn} type="button" onClick={() => setEditType(null)}>Cancel</button>
                  </span>
                </div>
              ) : (
                <div className={styles.row} key={t.id}>
                  <span>
                    <strong>{t.name}</strong> ({t.code}) · {t.defaultQuota} days · {t.paid ? 'paid' : 'unpaid'} ·{' '}
                    {t.requiresApproval ? 'approval required' : 'auto-approved'}
                  </span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button
                      className={styles.btn}
                      type="button"
                      onClick={() => setEditType({ id: t.id, name: t.name, defaultQuota: t.defaultQuota, paid: t.paid, requiresApproval: t.requiresApproval })}
                    >
                      Edit
                    </button>
                    <button className={`${styles.btn} ${styles.btnGhostDanger}`} type="button" onClick={() => leavesApi.deactivateType(t.id).then(loadSettings).catch((e) => setError(errMsg(e)))}>Deactivate</button>
                  </span>
                </div>
              ),
            )}
            <form className={styles.formActions} onSubmit={addType} style={{ marginTop: 'var(--space-3)' }}>
              <input className={styles.input} aria-label="Leave type name" placeholder="Name" value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} required />
              <input className={styles.input} aria-label="Leave type code" placeholder="CODE" value={newType.code} onChange={(e) => setNewType({ ...newType, code: e.target.value })} required />
              <input className={styles.input} type="number" aria-label="Default quota (days)" placeholder="Quota" value={newType.defaultQuota} onChange={(e) => setNewType({ ...newType, defaultQuota: Number(e.target.value) })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)' }}>
                <input type="checkbox" checked={newType.paid} onChange={(e) => setNewType({ ...newType, paid: e.target.checked })} /> paid
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)' }}>
                <input type="checkbox" checked={newType.requiresApproval} onChange={(e) => setNewType({ ...newType, requiresApproval: e.target.checked })} /> approval
              </label>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Add type</button>
            </form>
          </div>

          {policy && (
            <form className={styles.card} onSubmit={savePolicy}>
              <div className={styles.cardTitle}>Leave policy</div>
              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  Carry-forward cap
                  <input className={styles.input} type="number" value={policy.carryForwardCap} onChange={(e) => setPolicy({ ...policy, carryForwardCap: Number(e.target.value) })} />
                </label>
                <label className={styles.formField}>
                  Probation months
                  <input className={styles.input} type="number" value={policy.probationMonths} onChange={(e) => setPolicy({ ...policy, probationMonths: Number(e.target.value) })} />
                </label>
                <label className={styles.formField}>
                  Accrual
                  <select className={styles.select} value={policy.accrualMode} onChange={(e) => setPolicy({ ...policy, accrualMode: e.target.value as LeavePolicyDTO['accrualMode'] })}>
                    <option value="upfront">Upfront</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                <label className={styles.formField}>
                  Leave year
                  <select className={styles.select} value={policy.leaveYear} onChange={(e) => setPolicy({ ...policy, leaveYear: e.target.value as LeavePolicyDTO['leaveYear'] })}>
                    <option value="calendar">Calendar</option>
                    <option value="fiscal">Fiscal</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)' }}>
                  <input type="checkbox" checked={policy.probationSickOnly} onChange={(e) => setPolicy({ ...policy, probationSickOnly: e.target.checked })} /> Probation: sick only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)' }}>
                  <input type="checkbox" checked={policy.twoStepApproval} onChange={(e) => setPolicy({ ...policy, twoStepApproval: e.target.checked })} /> Two-step approval
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)' }}>
                  <input type="checkbox" checked={policy.encashment} onChange={(e) => setPolicy({ ...policy, encashment: e.target.checked })} /> Encashment
                </label>
              </div>
              <div className={styles.formActions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Save policy</button>
              </div>
            </form>
          )}
        </>
      )}
    </>
  );
}
