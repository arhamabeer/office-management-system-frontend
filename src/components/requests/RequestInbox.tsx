'use client';

import { useState } from 'react';
import type { RequestAction, RequestStatus, RequestRouteTarget, RequestTimelineEntryDTO } from '@ems/types';
import { useAuth } from '@/context/AuthContext';
import RequestTimeline from './RequestTimeline';
import { STATUS_LABEL } from './requestLabels';
import styles from './requests.module.css';

/** A request normalized for display in the handler inbox (complaint or inventory). */
export interface RequestCardItem {
  id: string;
  title: string;
  category?: string;
  employeeName?: string;
  reason: string;
  details?: string;
  status: RequestStatus;
  routedTo: RequestRouteTarget[];
  timeline: RequestTimelineEntryDTO[];
  createdAt: string;
  isSelf: boolean;
}

function statusClass(s: RequestStatus): string {
  if (s === 'Resolved') return styles.bResolved;
  if (s === 'Rejected') return styles.bRejected;
  if (s === 'Forwarded') return styles.bForwarded;
  return styles.bPending;
}

/**
 * The manager/handler inbox: a card per request with the stage-appropriate
 * actions. The chain is strict — at the manager stage (Submitted) you may
 * Resolve/Reject or forward to Operations; at the Operations queue (Forwarded)
 * Resolve/Reject or escalate "→ Admin"; at the Admin queue, Resolve/Reject.
 */
export default function RequestInbox({
  items,
  onDecide,
  busyId,
  emptyText = 'Nothing awaiting your action.',
}: {
  items: RequestCardItem[];
  onDecide: (id: string, action: RequestAction, note?: string) => void | Promise<void>;
  busyId: string | null;
  emptyText?: string;
}) {
  const { user } = useAuth();
  const isOps = user?.orgRole === 'Operations';
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (!items.length) return <div className={styles.empty}>{emptyText}</div>;

  return (
    <div className={styles.cardList}>
      {items.map((it) => {
        const note = notes[it.id] ?? '';
        const busy = busyId === it.id;
        const act = (a: RequestAction) => onDecide(it.id, a, note.trim() || undefined);
        const atManager = it.status === 'Submitted';
        const actingOps = it.status === 'Forwarded' && it.routedTo.includes('Operations') && isOps;
        return (
          <div key={it.id} className={styles.reqCard}>
            <div className={styles.reqHead}>
              <div>
                <div className={styles.reqTitle}>{it.title}</div>
                <div className={styles.reqSub}>
                  {it.employeeName ?? '—'}
                  {it.isSelf ? ' (you)' : ''}
                  {it.category ? ` · ${it.category}` : ''}
                </div>
              </div>
              <div className={styles.reqBadges}>
                <span className={`${styles.badge} ${statusClass(it.status)}`}>{STATUS_LABEL[it.status]}</span>
                {it.routedTo.map((t) => (
                  <span key={t} className={`${styles.badge} ${styles.bRoute}`}>{t}</span>
                ))}
              </div>
            </div>

            <p className={styles.reqReason}>{it.reason}</p>
            {it.details ? <p className={styles.reqDetails}>{it.details}</p> : null}

            <RequestTimeline timeline={it.timeline} />

            <input
              className={styles.noteInput}
              placeholder="Add a note (optional) — included with your decision…"
              value={note}
              onChange={(e) => setNotes((n) => ({ ...n, [it.id]: e.target.value }))}
            />

            <div className={styles.actionBar}>
              <button className={`${styles.btn} ${styles.btnGhostOk}`} disabled={busy} onClick={() => act('resolve')}>
                Resolve
              </button>
              <button className={`${styles.btn} ${styles.btnGhostDanger}`} disabled={busy} onClick={() => act('reject')}>
                Reject
              </button>
              {atManager && (
                <>
                  <span className={styles.actionDivider} aria-hidden="true" />
                  <button className={styles.btn} disabled={busy} onClick={() => act('forward_operations')}>→ Operations</button>
                </>
              )}
              {actingOps && (
                <>
                  <span className={styles.actionDivider} aria-hidden="true" />
                  <button className={styles.btn} disabled={busy} onClick={() => act('forward_admin')}>→ Admin</button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
