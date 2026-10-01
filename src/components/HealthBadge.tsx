'use client';

import { useEffect, useState } from 'react';
import type { HealthStatus } from '@ems/types';
import { api } from '@/lib/api';
import styles from './HealthBadge.module.css';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthStatus }
  | { kind: 'error'; message: string };

export default function HealthBadge() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((data) => alive && setState({ kind: 'ok', data }))
      .catch((err) => alive && setState({ kind: 'error', message: err?.message ?? 'unreachable' }));
    return () => {
      alive = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <span className={styles.badge}>
        <span className={styles.dot} /> Checking API…
      </span>
    );
  }

  if (state.kind === 'error') {
    return (
      <span className={styles.badge}>
        <span className={`${styles.dot} ${styles.err}`} /> API offline
      </span>
    );
  }

  const dbOk = state.data.db === 'connected';
  return (
    <span className={styles.badge}>
      <span className={`${styles.dot} ${styles.ok}`} />
      API <span className={styles.strong}>{state.data.status}</span> · DB{' '}
      <span className={`${styles.strong}`} style={{ color: dbOk ? undefined : 'var(--color-warning)' }}>
        {state.data.db}
      </span>{' '}
      · v{state.data.version}
    </span>
  );
}
