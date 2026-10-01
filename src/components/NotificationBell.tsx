'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationDTO } from '@ems/types';
import { notificationsApi } from '@/lib/auth';
import styles from './NotificationBell.module.css';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  // Monotonic token so a slow in-flight count poll can't clobber a newer
  // optimistic update (e.g. the poll that was in flight when you marked all read).
  const seq = useRef(0);

  const loadCount = useCallback(async () => {
    const my = ++seq.current;
    try {
      const c = (await notificationsApi.count()).unread;
      if (my === seq.current) setUnread(c);
    } catch {
      /* ignore — degrade quietly */
    }
  }, []);

  useEffect(() => {
    void loadCount();
    const t = setInterval(loadCount, 60_000);
    return () => clearInterval(t);
  }, [loadCount]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        setItems(await notificationsApi.list(false, 15));
      } catch {
        /* ignore */
      }
    }
  };

  const openItem = async (n: NotificationDTO) => {
    setOpen(false);
    if (!n.read) {
      try {
        await notificationsApi.markRead(n.id);
        setUnread((u) => Math.max(0, u - 1));
        seq.current++; // invalidate any in-flight count poll
      } catch {
        /* ignore */
      }
    }
    if (n.link) router.push(n.link);
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setUnread(0);
      seq.current++; // invalidate any in-flight count poll
      setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        className={styles.bell}
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        onClick={() => void toggle()}
        type="button"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label="Notifications">
          <div className={styles.menuHead}>
            <span>Notifications</span>
            {items.some((i) => !i.read) && (
              <button className={styles.linkBtn} type="button" onClick={() => void markAll()}>
                Mark all read
              </button>
            )}
          </div>
          <div className={styles.list}>
            {items.length ? (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`${styles.item} ${n.read ? '' : styles.itemUnread}`}
                  onClick={() => void openItem(n)}
                >
                  <div className={styles.itemTitle}>
                    {!n.read && <span className={styles.dot} aria-hidden />}
                    {n.title}
                  </div>
                  {n.body && <div className={styles.itemBody}>{n.body}</div>}
                  <div className={styles.itemTime}>{timeAgo(n.createdAt)}</div>
                </button>
              ))
            ) : (
              <div className={styles.empty}>You&apos;re all caught up.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
