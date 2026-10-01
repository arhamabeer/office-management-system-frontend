'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ExpenseClaimDTO, ExpenseCategoryDTO, ExpensePolicyDTO } from '@ems/types';
import { expensesApi, fmtMoney } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './expenses.module.css';

type Tab = 'my' | 'team' | 'settings';

function statusBadge(status: string): string {
  if (status === 'Approved' || status === 'Reimbursed') return styles.bApproved;
  if (status === 'Submitted' || status === 'Draft') return styles.bPending;
  return styles.bRejected;
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = { categoryId: '', amount: '', incurredOn: today(), description: '', receiptRef: '' };
const emptyCat = { name: '', code: '', perClaimLimit: '' };

export default function ExpensesPage() {
  const { user, isOrgAdmin } = useAuth();
  const canTeam = !!user && (user.accountType === 'Owner' || user.orgRole !== 'Member');

  const [tab, setTab] = useState<Tab>('my');
  const [categories, setCategories] = useState<ExpenseCategoryDTO[]>([]);
  const [mine, setMine] = useState<ExpenseClaimDTO[]>([]);
  const [team, setTeam] = useState<ExpenseClaimDTO[]>([]);
  const [policy, setPolicy] = useState<ExpensePolicyDTO | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [newCat, setNewCat] = useState({ ...emptyCat });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cl, cats] = await Promise.all([expensesApi.claims('mine'), expensesApi.categories()]);
      setMine(cl);
      setCategories(cats);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTeam(await expensesApi.claims('team'));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, pol] = await Promise.all([expensesApi.categories(), expensesApi.policy()]);
      setCategories(cats);
      setPolicy(pol);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'my') void loadMine();
    if (tab === 'team') void loadTeam();
    if (tab === 'settings') void loadSettings();
  }, [tab, loadMine, loadTeam, loadSettings]);

  const currency = policy?.currency ?? 'PKR';

  const createClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await expensesApi.create({
        categoryId: form.categoryId,
        amount: Number(form.amount),
        incurredOn: form.incurredOn,
        description: form.description.trim(),
        ...(form.receiptRef.trim() ? { receiptRef: form.receiptRef.trim() } : {}),
        submit: true,
      });
      setInfo('Expense claim submitted.');
      setForm({ ...emptyForm });
      setShowNew(false);
      await loadMine();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const decide = async (claim: ExpenseClaimDTO, approve: boolean) => {
    setBusy(claim.id);
    setError(null);
    try {
      if (approve) await expensesApi.approve(claim.id);
      else await expensesApi.reject(claim.id);
      await loadTeam();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  };

  const reimburse = async (claim: ExpenseClaimDTO) => {
    setBusy(claim.id);
    setError(null);
    try {
      await expensesApi.reimburse(claim.id);
      await loadTeam();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await expensesApi.createCategory({
        name: newCat.name.trim(),
        code: newCat.code.trim(),
        ...(newCat.perClaimLimit ? { perClaimLimit: Number(newCat.perClaimLimit) } : {}),
      });
      setNewCat({ ...emptyCat });
      await loadSettings();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const activeCategories = useMemo(() => categories.filter((c) => c.active), [categories]);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Expenses</h1>
        <p className={styles.subtitle}>File expense claims, track approvals, and manage reimbursements.</p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'my' ? styles.tabActive : ''}`} aria-pressed={tab === 'my'} onClick={() => setTab('my')}>My claims</button>
        {canTeam && <button className={`${styles.tab} ${tab === 'team' ? styles.tabActive : ''}`} aria-pressed={tab === 'team'} onClick={() => setTab('team')}>Team</button>}
        {isOrgAdmin && <button className={`${styles.tab} ${tab === 'settings' ? styles.tabActive : ''}`} aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>Settings</button>}
      </div>

      {tab === 'my' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.spacer} />
            <button className={styles.btn} onClick={() => expensesApi.exportClaims('mine').catch((e) => setError(errMsg(e)))}>
              Export Excel
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowNew((v) => !v)}>
              {showNew ? 'Cancel' : '+ New claim'}
            </button>
          </div>

          {showNew && (
            <form className={styles.card} onSubmit={createClaim}>
              <div className={styles.cardTitle}>File an expense claim</div>
              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  Category
                  <select className={styles.input} required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">Select…</option>
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.perClaimLimit > 0 ? ` (max ${fmtMoney(c.perClaimLimit, currency)})` : ''}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.formField}>
                  Amount ({currency})
                  <input className={styles.input} type="number" min="1" step="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </label>
                <label className={styles.formField}>
                  Date incurred
                  <input className={styles.input} type="date" max={today()} required value={form.incurredOn} onChange={(e) => setForm({ ...form, incurredOn: e.target.value })} />
                </label>
                <label className={styles.formField}>
                  Receipt reference (optional)
                  <input className={styles.input} placeholder="e.g. INV-2043 or a link" value={form.receiptRef} onChange={(e) => setForm({ ...form, receiptRef: e.target.value })} />
                </label>
                <label className={`${styles.formField}`} style={{ gridColumn: '1 / -1' }}>
                  Description
                  <input className={styles.input} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </label>
              </div>
              <div className={styles.formActions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Submit claim</button>
              </div>
            </form>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Date</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Description</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className={styles.empty}>Loading…</td></tr>
                ) : mine.length ? mine.map((c) => (
                  <tr key={c.id}>
                    <td>{c.categoryName}</td>
                    <td>{c.incurredOn}</td>
                    <td>{fmtMoney(c.amount, c.currency)}</td>
                    <td>{c.description}</td>
                    <td><span className={`${styles.badge} ${statusBadge(c.status)}`}>{c.status}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className={styles.empty}>No claims yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'team' && canTeam && (
        <>
        <div className={styles.toolbar}>
          <div className={styles.spacer} />
          <button className={styles.btn} onClick={() => expensesApi.exportClaims('team').catch((e) => setError(errMsg(e)))}>
            Export team Excel
          </button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Employee</th>
                <th scope="col">Category</th>
                <th scope="col">Date</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className={styles.empty}>Loading…</td></tr>
              ) : team.length ? team.map((c) => {
                const isSelf = c.userId === user?.id;
                return (
                  <tr key={c.id}>
                    <td>{c.employeeName ?? '—'}{isSelf ? ' (you)' : ''}</td>
                    <td>{c.categoryName}</td>
                    <td>{c.incurredOn}</td>
                    <td>{fmtMoney(c.amount, c.currency)}</td>
                    <td><span className={`${styles.badge} ${statusBadge(c.status)}`}>{c.status}</span></td>
                    <td>
                      <div className={styles.rowActions}>
                        {c.status === 'Submitted' && (
                          <>
                            <button className={`${styles.btn} ${styles.btnGhostOk}`} disabled={isSelf || busy === c.id} onClick={() => decide(c, true)}>Approve</button>
                            <button className={`${styles.btn} ${styles.btnGhostDanger}`} disabled={isSelf || busy === c.id} onClick={() => decide(c, false)}>Reject</button>
                          </>
                        )}
                        {c.status === 'Approved' && isOrgAdmin && (
                          <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy === c.id} onClick={() => reimburse(c)}>Mark reimbursed</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className={styles.empty}>No team claims.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      {tab === 'settings' && isOrgAdmin && (
        <>
          <form className={styles.card} onSubmit={addCategory}>
            <div className={styles.cardTitle}>Add expense category</div>
            <div className={styles.formActions}>
              <input className={styles.input} aria-label="Category name" placeholder="Name" required value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              <input className={styles.input} aria-label="Category code" placeholder="CODE" required value={newCat.code} onChange={(e) => setNewCat({ ...newCat, code: e.target.value })} />
              <input className={styles.input} aria-label="Per-claim limit (0 = unlimited)" placeholder="Limit (0 = none)" type="number" min="0" value={newCat.perClaimLimit} onChange={(e) => setNewCat({ ...newCat, perClaimLimit: e.target.value })} />
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Add</button>
            </div>
          </form>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Code</th>
                  <th scope="col">Per-claim limit</th>
                  <th scope="col">Approval</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className={styles.empty}>Loading…</td></tr>
                ) : categories.length ? categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.code}</td>
                    <td>{c.perClaimLimit > 0 ? fmtMoney(c.perClaimLimit, currency) : 'Unlimited'}</td>
                    <td>{c.requiresApproval ? 'Required' : 'Auto'}</td>
                    <td><span className={`${styles.badge} ${c.active ? styles.bApproved : styles.bRejected}`}>{c.active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className={styles.empty}>No categories.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {policy && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Policy</div>
              <div className={styles.formGrid}>
                <div className={styles.formField}>Currency<strong>{policy.currency}</strong></div>
                <div className={styles.formField}>Default per-claim limit<strong>{policy.defaultPerClaimLimit > 0 ? fmtMoney(policy.defaultPerClaimLimit, policy.currency) : 'Unlimited'}</strong></div>
                <div className={styles.formField}>Approval by default<strong>{policy.requireApprovalByDefault ? 'Yes' : 'No'}</strong></div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
