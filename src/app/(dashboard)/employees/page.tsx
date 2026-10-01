'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EmployeeProfileDTO, DepartmentDTO, Paginated } from '@ems/types';
import { employeesApi, departmentsApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './employees.module.css';

const ORG_ROLES = ['Member', 'Lead', 'Manager', 'Admin'] as const;
const PAGE_SIZE = 10;

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

const emptyForm = {
  email: '',
  firstName: '',
  lastName: '',
  orgRole: 'Member',
  designation: '',
  departmentId: '',
};

export default function EmployeesPage() {
  const { user, isOrgAdmin } = useAuth();
  const [data, setData] = useState<Paginated<EmployeeProfileDTO> | null>(null);
  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setError(null);
    setInfo(null);
    try {
      const csv = await file.text();
      const res = await employeesApi.importCsv(csv);
      const fails = res.failed.length
        ? ` ${res.failed.length} skipped — ${res.failed.slice(0, 3).map((f) => `line ${f.line}: ${f.error}`).join('; ')}${res.failed.length > 3 ? '…' : ''}`
        : '';
      setInfo(`Imported ${res.created} employee(s).${fails}`);
      setPage(1);
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setImporting(false);
    }
  };

  const deptName = useMemo(() => {
    const m = new Map(departments.map((d) => [d.id, d.name]));
    return (id?: string) => (id ? (m.get(id) ?? '—') : '—');
  }, [departments]);

  const reqSeq = useRef(0);
  const load = useCallback(async () => {
    const my = ++reqSeq.current; // ignore a slower earlier request's response
    setLoading(true);
    setError(null);
    try {
      const res = await employeesApi.list({ page, pageSize: PAGE_SIZE, q: q || undefined });
      if (my === reqSeq.current) setData(res);
    } catch (e) {
      if (my === reqSeq.current) setError(errMsg(e));
    } finally {
      if (my === reqSeq.current) setLoading(false);
    }
  }, [page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    departmentsApi.list().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  // Seed the search box from a ?q= param (e.g. the topbar global search).
  useEffect(() => {
    const urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) setQ(urlQ);
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setInfo(null);
    try {
      const body: Record<string, unknown> = {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        orgRole: form.orgRole,
      };
      if (form.designation.trim()) body.designation = form.designation.trim();
      if (form.departmentId) body.departmentId = form.departmentId;
      const res = await employeesApi.create(body);
      setInfo(
        res.inviteUrl
          ? `Invited ${res.employee.fullName} — an onboarding email was sent. Dev link: ${res.inviteUrl}`
          : `Invited ${res.employee.fullName} — an onboarding email was sent.`,
      );
      setForm({ ...emptyForm });
      setShowCreate(false);
      setPage(1);
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setCreating(false);
    }
  };

  const onRole = async (emp: EmployeeProfileDTO, orgRole: string) => {
    setError(null);
    try {
      await employeesApi.assignRole(emp.id, { orgRole });
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const onDeactivate = async (emp: EmployeeProfileDTO) => {
    if (!window.confirm(`Deactivate ${emp.fullName}? They will lose access.`)) return;
    setError(null);
    try {
      await employeesApi.deactivate(emp.id);
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const onCopyLink = async (emp: EmployeeProfileDTO) => {
    setError(null);
    setInfo(null);
    try {
      const res = await employeesApi.resendInvite(emp.id, false);
      if (res.inviteUrl) {
        try {
          await navigator.clipboard.writeText(res.inviteUrl);
          setInfo(`Onboarding link for ${emp.fullName} copied to clipboard.`);
        } catch {
          setInfo(`Onboarding link for ${emp.fullName}: ${res.inviteUrl}`);
        }
      } else {
        setInfo(`A fresh onboarding link for ${emp.fullName} was generated.`);
      }
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const onResend = async (emp: EmployeeProfileDTO) => {
    setError(null);
    setInfo(null);
    try {
      const res = await employeesApi.resendInvite(emp.id, true);
      setInfo(
        res.inviteUrl
          ? `Invitation re-sent to ${emp.email}. Dev link: ${res.inviteUrl}`
          : `Invitation re-sent to ${emp.email}.`,
      );
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Employees</h1>
          <p className={styles.subtitle}>
            {isOrgAdmin
              ? 'Directory for your organization.'
              : 'People visible to you (scoped to your role).'}
          </p>
        </div>
        {isOrgAdmin && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onImportFile} />
            <button className={styles.btn} disabled={importing} onClick={() => fileRef.current?.click()}>
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowCreate((s) => !s)}>
              {showCreate ? 'Cancel' : '+ New employee'}
            </button>
          </div>
        )}
      </div>
      {isOrgAdmin && (
        <p className={styles.subtitle} style={{ marginBottom: 'var(--space-3)' }}>
          CSV columns: <code>email, firstName, lastName</code> (required), optional <code>designation, orgRole, employmentType, department</code>. Each new hire is emailed an invite.
        </p>
      )}

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      {showCreate && isOrgAdmin && (
        <form className={styles.createPanel} onSubmit={onCreate}>
          <div className={styles.formGrid}>
            <label className={styles.formField}>
              Email
              <input className={styles.search} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className={styles.formField}>
              First name
              <input className={styles.search} required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </label>
            <label className={styles.formField}>
              Last name
              <input className={styles.search} required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </label>
            <label className={styles.formField}>
              Designation
              <input className={styles.search} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </label>
            <label className={styles.formField}>
              Department
              <select className={styles.select} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className={styles.formField}>
              Organizational role
              <select className={styles.select} value={form.orgRole} onChange={(e) => setForm({ ...form, orgRole: e.target.value })}>
                {ORG_ROLES.map((r) => (
                  <option key={r} value={r} disabled={r === 'Admin' && user?.accountType !== 'Owner'}>
                    {r}
                    {r === 'Admin' && user?.accountType !== 'Owner' ? ' (Owner only)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.formActions}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={creating}>
              {creating ? 'Inviting…' : 'Send invite'}
            </button>
            <button className={styles.btn} type="button" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          aria-label="Search employees" placeholder="Search by name, designation, code…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Designation</th>
              <th scope="col">Department</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              {isOrgAdmin && <th scope="col" style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isOrgAdmin ? 6 : 5} className={styles.empty}>Loading…</td>
              </tr>
            ) : data && data.items.length ? (
              data.items.map((emp) => {
                const isSelf = emp.userId === user?.id;
                const statusClass =
                  emp.status === 'Active'
                    ? styles.statusActive
                    : emp.status === 'Invited'
                      ? styles.statusInvited
                      : styles.statusOff;
                return (
                  <tr key={emp.id}>
                    <td>
                      <div className={styles.person}>
                        <span className={styles.avatar}>{initials(emp.fullName)}</span>
                        <div>
                          <div className={styles.personName}>{emp.fullName}{isSelf ? ' (you)' : ''}</div>
                          <div className={styles.personEmail}>{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{emp.designation ?? '—'}</td>
                    <td>{emp.departmentName ?? deptName(emp.departmentId)}</td>
                    <td>
                      <span className={styles.roleTag}>{emp.accountType} · {emp.orgRole}</span>
                    </td>
                    <td>
                      <span className={`${styles.status} ${statusClass}`}>{emp.status}</span>
                    </td>
                    {isOrgAdmin && (
                      <td>
                        <div className={styles.rowActions}>
                          <select
                            className={styles.miniSelect}
                            value={emp.orgRole}
                            disabled={isSelf}
                            onChange={(e) => onRole(emp, e.target.value)}
                            aria-label={`Change role for ${emp.fullName}`}
                          >
                            {ORG_ROLES.map((r) => (
                              <option key={r} value={r} disabled={r === 'Admin' && user?.accountType !== 'Owner'}>
                                {r}
                              </option>
                            ))}
                          </select>
                          {emp.status === 'Invited' && (
                            <>
                              <button className={styles.linkBtn} onClick={() => onCopyLink(emp)}>
                                Copy link
                              </button>
                              <button className={styles.linkBtn} onClick={() => onResend(emp)}>
                                Resend
                              </button>
                            </>
                          )}
                          {!isSelf && emp.status !== 'Deactivated' && (
                            <button className={styles.linkBtn} onClick={() => onDeactivate(emp)}>
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={isOrgAdmin ? 6 : 5} className={styles.empty}>No employees found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <span>{total} {total === 1 ? 'person' : 'people'}</span>
        <div className={styles.pager}>
          <button className={styles.btn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span style={{ alignSelf: 'center' }}>Page {page} / {totalPages}</span>
          <button className={styles.btn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </>
  );
}
