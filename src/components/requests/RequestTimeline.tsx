'use client';

import type { RequestTimelineEntryDTO } from '@ems/types';
import { TIMELINE_ACTION_LABEL } from './requestLabels';
import styles from './requests.module.css';

function fmt(iso: string): string {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** The immutable action history of a request (filed → forwarded → resolved …). */
export default function RequestTimeline({ timeline }: { timeline: RequestTimelineEntryDTO[] }) {
  if (!timeline?.length) return null;
  return (
    <ol className={styles.timeline}>
      {timeline.map((t, i) => (
        <li key={i} className={styles.timelineItem}>
          <span className={styles.timelineDot} aria-hidden="true" />
          <div className={styles.timelineBody}>
            <span className={styles.timelineAction}>{TIMELINE_ACTION_LABEL[t.action] ?? t.action}</span>{' '}
            <span className={styles.timelineMeta}>
              by {t.byName || '—'}
              {t.byRole ? ` (${t.byRole})` : ''} · {fmt(t.at)}
            </span>
            {t.note ? <div className={styles.timelineNote}>“{t.note}”</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
