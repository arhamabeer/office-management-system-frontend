'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComplaintDTO, ComplaintCategoryDTO, RequestStatus } from '@ems/types';
import { complaintsApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import RequestTimeline from '@/components/requests/RequestTimeline';
import { STATUS_LABEL } from '@/components/requests/requestLabels';
import styles from '@/components/requests/requests.module.css';

type Tab = 'my' | 'settings';
const emptyForm = { categoryId: '', subject: '', reason: '', details: '' };

function statusClass(s: RequestStatus): string {
  if (s === 'Resolved') return styles.bResolved;
  if (s === 'Rejected') return styles.bRejected;
  if (s === 'Forwarded') return styles.bForwarded;
  return styles.bPending;
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export default function ComplaintsPage() {
  const { isOrgAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('my');
  const [mine, setMine] = useState<ComplaintDTO[]>([]);
  const [categories, setCategories] = useState<ComplaintCategoryDTO[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [newCat, setNewCat] = useState({ name: '', code: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cl, cats] = await Promise.all([complaintsApi.list('mine'), complaintsApi.categories()]);
      setMine(cl);
      setCategories(cats);
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
      setCategories(await complaintsApi.categories());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'my') void loadMine();
    if (tab === 'settings') void loadSettings();
  }, [tab, loadMine, loadSettings]);

  const activeCategories = useMemo(() => categories.filter((c) => c.active), [categories]);

  const fileComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await complaintsApi.create({
        categoryId: form.categoryId,
        subject: form.subject.trim(),
        reason: form.reason.trim(),
        ...(form.details.trim() ? { details: form.details.trim() } : {}),
      });
      setInfo('Complaint filed — your manager will review it.');
      setForm({ ...emptyForm });
      setShowNew(false);
      await loadMine();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await complaintsApi.createCategory({ name: newCat.name.trim(), code: newCat.code.trim() });
      setNewCat({ name: '', code: '' });
      await loadSettings();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Complaints</h1>
        <p className={styles.subtitle}>Raise a complaint — it goes to your manager, who can resolve it or forward it to Operations/Admin.</p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'my' ? styles.tabActive : ''}`} aria-pressed={tab === 'my'} onClick={() => setTab('my')}>My complaints</button>
        {isOrgAdmin && <button className={`${styles.tab} ${tab === 'settings' ? styles.tabActive : ''}`} aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>Settings</button>}
      </div>

      {tab === 'my' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.spacer} />
            <button className={styles.btn} onClick={() => complaintsApi.exportList('mine').catch((e) => setError(errMsg(e)))}>Export Excel</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowNew((v) => !v)}>{showNew ? 'Cancel' : '+ New complaint'}</button>
          </div>

          {showNew && (
            <form className={styles.card} onSubmit={fileComplaint}>
              <div className={styles.cardTitle}>File a complaint</div>
              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  Category
                  <select className={styles.select} required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">Select…</option>
                    {activeCategories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </label>
                <label className={styles.formField}>
                  Subject
                  <input className={styles.input} required maxLength={120} placeholder="Short summary" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </label>
                <label className={`${styles.formField} ${styles.full}`}>
                  Reason
                  <textarea className={`${styles.input} ${styles.textarea}`} required maxLength={2000} placeholder="What happened and why are you raising this?" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </label>
                <label className={`${styles.formField} ${styles.full}`}>
                  Other details (optional)
                  <textarea className={`${styles.input} ${styles.textarea}`} maxLength={4000} placeholder="Anything else that helps — dates, people involved, context…" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
                </label>
              </div>
              <div className={styles.formActions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Submit complaint</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className={styles.empty}>Loading…</div>
          ) : mine.length ? (
            <div className={styles.cardList}>
              {mine.map((c) => (
                <div key={c.id} className={styles.reqCard}>
                  <div className={styles.reqHead}>
                    <div>
                      <div className={styles.reqTitle}>{c.subject}</div>
                      <div className={styles.reqSub}>{c.categoryName ?? '—'} · filed {c.createdAt.slice(0, 10)}</div>
                    </div>
                    <div className={styles.reqBadges}>
                      <span className={`${styles.badge} ${statusClass(c.status)}`}>{STATUS_LABEL[c.status]}</span>
                      {c.routedTo.map((t) => (<span key={t} className={`${styles.badge} ${styles.bRoute}`}>{t}</span>))}
                    </div>
                  </div>
                  <p className={styles.reqReason}>{c.reason}</p>
                  {c.details ? <p className={styles.reqDetails}>{c.details}</p> : null}
                  <RequestTimeline timeline={c.timeline} />
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>You haven’t filed any complaints yet.</div>
          )}
        </>
      )}

      {tab === 'settings' && isOrgAdmin && (
        <>
          <form className={styles.card} onSubmit={addCategory}>
            <div className={styles.cardTitle}>Add complaint category</div>
            <div className={styles.formActions}>
              <input className={styles.input} aria-label="Category name" placeholder="Name" required value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              <input className={styles.input} aria-label="Category code" placeholder="CODE" required value={newCat.code} onChange={(e) => setNewCat({ ...newCat, code: e.target.value })} />
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Add</button>
            </div>
          </form>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th scope="col">Category</th><th scope="col">Code</th><th scope="col">Status</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className={styles.empty}>Loading…</td></tr>
                ) : categories.length ? categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.code}</td>
                    <td><span className={`${styles.badge} ${c.active ? styles.bResolved : styles.bRejected}`}>{c.active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className={styles.empty}>No categories.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
