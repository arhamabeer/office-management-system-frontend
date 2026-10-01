'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuditLogDTO, Paginated } from '@ems/types';
import { auditApi } from '@/lib/auth';
import styles from './audit.module.css';

const PAGE_SIZE = 20;
const SENSITIVE = /salary|role_changed|payslip|taxcert|deactivated|reuse|password/i;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export default function AuditLogPage() {
  const [data, setData] = useState<Paginated<AuditLogDTO> | null>(null);
  const [action, setAction] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await auditApi.list({ page, pageSize: PAGE_SIZE, action: query || undefined, from: from || undefined, to: to || undefined }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [page, query, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Audit Log</h1>
        <p className={styles.subtitle}>
          Append-only record of sensitive actions — logins, role changes, salary access, downloads,
          approvals, and configuration edits.
        </p>
      </div>

      {error && <div className={styles.banner}>{error}</div>}

      <div className={styles.toolbar}>
        <input
          className={styles.input}
          aria-label="Filter audit log by action" placeholder="Filter by action (e.g. salary, role, login)…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              setQuery(action.trim());
            }
          }}
        />
        <input className={styles.input} type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
        <input className={styles.input} type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
        <button className={styles.btn} onClick={() => { setPage(1); setQuery(action.trim()); }}>Filter</button>
        {(query || from || to) && (
          <button className={styles.btn} onClick={() => { setAction(''); setQuery(''); setFrom(''); setTo(''); setPage(1); }}>Clear</button>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th scope="col">Time</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Target</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className={styles.empty}>Loading…</td></tr>
            ) : data && data.items.length ? (
              data.items.map((a) => (
                <tr key={a.id}>
                  <td className={styles.time}>{new Date(a.createdAt).toLocaleString()}</td>
                  <td>{a.actorLabel ?? <span className={styles.muted}>system</span>}</td>
                  <td>
                    <span className={`${styles.action} ${SENSITIVE.test(a.action) ? styles.actionSensitive : ''}`}>
                      {a.action}
                    </span>
                  </td>
                  <td className={styles.mono}>
                    {a.targetType ? `${a.targetType}${a.targetId ? ` · ${a.targetId.slice(-6)}` : ''}` : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className={styles.empty}>No audit entries.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <span>{total} {total === 1 ? 'entry' : 'entries'}</span>
        <div className={styles.pager}>
          <button className={styles.btn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page} / {totalPages}</span>
          <button className={styles.btn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </>
  );
}
