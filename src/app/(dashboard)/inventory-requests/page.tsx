'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InventoryRequestDTO, InventoryCategoryDTO, RequestStatus } from '@ems/types';
import { inventoryApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import RequestTimeline from '@/components/requests/RequestTimeline';
import { STATUS_LABEL } from '@/components/requests/requestLabels';
import styles from '@/components/requests/requests.module.css';

type Tab = 'my' | 'settings';
const emptyForm = { categoryId: '', itemName: '', quantity: '1', neededBy: '', reason: '', details: '' };

function statusClass(s: RequestStatus): string {
  if (s === 'Resolved') return styles.bResolved;
  if (s === 'Rejected') return styles.bRejected;
  if (s === 'Forwarded') return styles.bForwarded;
  return styles.bPending;
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export default function InventoryRequestsPage() {
  const { isOrgAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('my');
  const [mine, setMine] = useState<InventoryRequestDTO[]>([]);
  const [categories, setCategories] = useState<InventoryCategoryDTO[]>([]);
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
      const [rq, cats] = await Promise.all([inventoryApi.list('mine'), inventoryApi.categories()]);
      setMine(rq);
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
      setCategories(await inventoryApi.categories());
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

  const fileRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await inventoryApi.create({
        categoryId: form.categoryId,
        itemName: form.itemName.trim(),
        quantity: Number(form.quantity),
        ...(form.neededBy ? { neededBy: form.neededBy } : {}),
        reason: form.reason.trim(),
        ...(form.details.trim() ? { details: form.details.trim() } : {}),
      });
      setInfo('Request submitted — your manager will review it.');
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
      await inventoryApi.createCategory({ name: newCat.name.trim(), code: newCat.code.trim() });
      setNewCat({ name: '', code: '' });
      await loadSettings();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Inventory Requests</h1>
        <p className={styles.subtitle}>Request supplies or equipment — it goes to your manager, who can approve it or forward it to Operations/Admin.</p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'my' ? styles.tabActive : ''}`} aria-pressed={tab === 'my'} onClick={() => setTab('my')}>My requests</button>
        {isOrgAdmin && <button className={`${styles.tab} ${tab === 'settings' ? styles.tabActive : ''}`} aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>Settings</button>}
      </div>

      {tab === 'my' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.spacer} />
            <button className={styles.btn} onClick={() => inventoryApi.exportList('mine').catch((e) => setError(errMsg(e)))}>Export Excel</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowNew((v) => !v)}>{showNew ? 'Cancel' : '+ New request'}</button>
          </div>

          {showNew && (
            <form className={styles.card} onSubmit={fileRequest}>
              <div className={styles.cardTitle}>Request inventory</div>
              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  Category
                  <select className={styles.select} required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">Select…</option>
                    {activeCategories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </label>
                <label className={styles.formField}>
                  Item
                  <input className={styles.input} required maxLength={120} placeholder="e.g. Standing desk" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} />
                </label>
                <label className={styles.formField}>
                  Quantity
                  <input className={styles.input} type="number" min="1" step="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </label>
                <label className={styles.formField}>
                  Needed by (optional)
                  <input className={styles.input} type="date" value={form.neededBy} onChange={(e) => setForm({ ...form, neededBy: e.target.value })} />
                </label>
                <label className={`${styles.formField} ${styles.full}`}>
                  Reason
                  <textarea className={`${styles.input} ${styles.textarea}`} required maxLength={2000} placeholder="Why do you need this?" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </label>
                <label className={`${styles.formField} ${styles.full}`}>
                  Other details (optional)
                  <textarea className={`${styles.input} ${styles.textarea}`} maxLength={4000} placeholder="Specs, preferred brand, links…" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
                </label>
              </div>
              <div className={styles.formActions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Submit request</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className={styles.empty}>Loading…</div>
          ) : mine.length ? (
            <div className={styles.cardList}>
              {mine.map((r) => (
                <div key={r.id} className={styles.reqCard}>
                  <div className={styles.reqHead}>
                    <div>
                      <div className={styles.reqTitle}>{r.quantity} × {r.itemName}</div>
                      <div className={styles.reqSub}>{r.categoryName ?? '—'} · filed {r.createdAt.slice(0, 10)}{r.neededBy ? ` · needed by ${r.neededBy}` : ''}</div>
                    </div>
                    <div className={styles.reqBadges}>
                      <span className={`${styles.badge} ${statusClass(r.status)}`}>{STATUS_LABEL[r.status]}</span>
                      {r.routedTo.map((t) => (<span key={t} className={`${styles.badge} ${styles.bRoute}`}>{t}</span>))}
                    </div>
                  </div>
                  <p className={styles.reqReason}>{r.reason}</p>
                  {r.details ? <p className={styles.reqDetails}>{r.details}</p> : null}
                  <RequestTimeline timeline={r.timeline} />
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>You haven’t made any inventory requests yet.</div>
          )}
        </>
      )}

      {tab === 'settings' && isOrgAdmin && (
        <>
          <form className={styles.card} onSubmit={addCategory}>
            <div className={styles.cardTitle}>Add inventory category</div>
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
