'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AnnouncementDTO } from '@ems/types';
import { announcementsApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './notices.module.css';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export default function NoticesPage() {
  const { user } = useAuth();
  const isOrgAdmin = !!user && (user.accountType === 'Owner' || user.orgRole === 'Admin');

  const [items, setItems] = useState<AnnouncementDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [posting, setPosting] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ title: '', body: '', pinned: false });

  const load = useCallback(async () => {
    setError(null);
    try {
      const a = await announcementsApi.list();
      setItems(a);
      // Viewing the page clears the unread state for next time.
      if (a.some((x) => !x.read)) announcementsApi.markAllRead().catch(() => {});
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    setError(null);
    setInfo(null);
    try {
      await announcementsApi.create({ title: title.trim(), body: body.trim(), pinned, expiresAt: expiresAt || undefined });
      setTitle('');
      setBody('');
      setPinned(false);
      setExpiresAt('');
      setInfo('Announcement posted.');
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (a: AnnouncementDTO) => {
    if (!window.confirm(`Delete announcement “${a.title}”?`)) return;
    try {
      await announcementsApi.remove(a.id);
      setItems((xs) => xs.filter((x) => x.id !== a.id));
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      const u = await announcementsApi.update(editId, { title: edit.title, body: edit.body });
      setItems((xs) => xs.map((x) => (x.id === u.id ? u : x)));
      setEditId(null);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const togglePin = async (a: AnnouncementDTO) => {
    try {
      await announcementsApi.update(a.id, { pinned: !a.pinned });
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Notices</h1>
          <p className={styles.subtitle}>Company-wide announcements from your admins.</p>
        </div>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      {isOrgAdmin && (
        <form className={styles.card} onSubmit={post}>
          <div className={styles.cardTitle}>Post an announcement</div>
          <input className={styles.input} placeholder="Title" aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required />
          <textarea className={styles.textarea} placeholder="Write your announcement…" aria-label="Body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={4} required />
          <div className={styles.formRow}>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin to top
            </label>
            <label className={styles.checkLabel}>
              Expires
              <input className={styles.input} type="date" aria-label="Expiry date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </label>
            <div className={styles.spacer} />
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={posting}>
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className={styles.card}><div className={styles.empty}>No announcements right now.</div></div>
      ) : (
        <div className={styles.list}>
          {items.map((a) => (
            <article className={`${styles.notice} ${a.pinned ? styles.pinnedNotice : ''}`} key={a.id}>
              {editId === a.id ? (
                <>
                  <input className={styles.input} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={140} />
                  <textarea className={styles.textarea} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={4} maxLength={5000} />
                  <div className={styles.actions}>
                    <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveEdit}>Save</button>
                    <button className={styles.btn} onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.noticeHead}>
                    <div className={styles.noticeTitle}>
                      {a.pinned && <span className={styles.pinBadge}>📌 Pinned</span>}
                      {!a.read && <span className={styles.newBadge}>New</span>}
                      {a.title}
                    </div>
                    {isOrgAdmin && (
                      <div className={styles.actions}>
                        <button className={styles.linkBtn} onClick={() => togglePin(a)}>{a.pinned ? 'Unpin' : 'Pin'}</button>
                        <button className={styles.linkBtn} onClick={() => { setEditId(a.id); setEdit({ title: a.title, body: a.body, pinned: a.pinned }); }}>Edit</button>
                        <button className={`${styles.linkBtn} ${styles.linkDanger}`} onClick={() => remove(a)}>Delete</button>
                      </div>
                    )}
                  </div>
                  <p className={styles.noticeBody}>{a.body}</p>
                  <div className={styles.noticeMeta}>
                    {a.authorName ? `${a.authorName} · ` : ''}{fmtDate(a.publishedAt)}
                    {a.expiresAt ? ` · expires ${new Date(a.expiresAt).toLocaleDateString()}` : ''}
                    {isOrgAdmin ? ` · ${a.readCount} read` : ''}
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
