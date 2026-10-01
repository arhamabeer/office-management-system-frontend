'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authApi, employeesApi, notificationsApi } from '@/lib/auth';
import PasswordChecklist, { passwordValid } from '@/components/PasswordChecklist';
import styles from './profile.module.css';

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function ProfilePage() {
  const { profile, user, reloadMe } = useAuth();

  const [fn, setFn] = useState('');
  const [ln, setLn] = useState('');
  const [ph, setPh] = useState('');
  const [dSaving, setDSaving] = useState(false);
  const [dInfo, setDInfo] = useState<string | null>(null);
  const [dError, setDError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFn(profile.firstName);
      setLn(profile.lastName);
      setPh(profile.phone ?? '');
    }
  }, [profile]);

  const saveDetails = async (e: FormEvent) => {
    e.preventDefault();
    setDError(null);
    setDInfo(null);
    if (!profile) return;
    setDSaving(true);
    try {
      await employeesApi.update(profile.id, { firstName: fn.trim(), lastName: ln.trim(), phone: ph.trim() || undefined });
      await reloadMe();
      setDInfo('Profile updated.');
    } catch (err) {
      setDError(err instanceof Error ? err.message : 'Could not update your profile.');
    } finally {
      setDSaving(false);
    }
  };

  const [emailPref, setEmailPref] = useState<boolean | null>(null);
  useEffect(() => {
    notificationsApi.prefs().then((p) => setEmailPref(p.email)).catch(() => {});
  }, []);
  const toggleEmailPref = async (val: boolean) => {
    setEmailPref(val);
    try {
      await notificationsApi.updatePrefs(val);
    } catch {
      setEmailPref(!val); // revert on failure
    }
  };

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwInfo, setPwInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwInfo(null);
    if (next !== confirm) {
      setPwError('New passwords do not match.');
      return;
    }
    if (!passwordValid(next)) {
      setPwError('Your new password must meet all the requirements.');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(current, next);
      setPwInfo('Password changed.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not change your password.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile || !user) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading profile…</p>;
  }

  const fields: [string, string][] = [
    ['Employee code', profile.employeeCode ?? '—'],
    ['Email', profile.email],
    ['Designation', profile.designation ?? '—'],
    ['Department', profile.departmentName ?? '—'],
    ['Employment type', profile.employmentType],
    ['Joining date', profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : '—'],
    ['Status', profile.status],
  ];

  return (
    <>
      <div className={styles.head}>
        <span className={styles.avatar}>{initials(profile.fullName)}</span>
        <div>
          <div className={styles.name}>{profile.fullName}</div>
          <div className={styles.role}>{profile.designation ?? 'Employee'}</div>
          <div className={styles.chips}>
            <span className={styles.chip}>{user.accountType}</span>
            <span className={styles.chip}>{user.orgRole}</span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.grid}>
          {fields.map(([label, value]) => (
            <div className={styles.field} key={label}>
              <span className={styles.label}>{label}</span>
              <span className={styles.value}>{value}</span>
            </div>
          ))}
        </div>
        <p className={styles.hint}>
          Designation, department, joining date, and employment type are profile data — not roles.
          Your role is the pair above ({user.accountType} · {user.orgRole}).
        </p>
      </div>

      <form className={styles.card} onSubmit={saveDetails}>
        <div className={styles.cardTitle}>Your details</div>
        <div className={styles.pwGrid}>
          <label className={styles.pwField}>
            First name
            <input className={styles.input} value={fn} onChange={(e) => setFn(e.target.value)} maxLength={60} required />
          </label>
          <label className={styles.pwField}>
            Last name
            <input className={styles.input} value={ln} onChange={(e) => setLn(e.target.value)} maxLength={60} required />
          </label>
          <label className={styles.pwField}>
            Phone
            <input className={styles.input} type="tel" autoComplete="tel" value={ph} onChange={(e) => setPh(e.target.value)} maxLength={30} />
          </label>
        </div>
        {dError && <div className={styles.pwError}>{dError}</div>}
        {dInfo && <div className={styles.pwInfo}>{dInfo}</div>}
        <div className={styles.pwActions}>
          <button className={styles.button} type="submit" disabled={dSaving}>
            {dSaving ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </form>

      <form className={styles.card} onSubmit={changePassword}>
        <div className={styles.cardTitle}>Change password</div>
        <div className={styles.pwGrid}>
          <label className={styles.pwField}>
            Current password
            <input className={styles.input} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </label>
          <label className={styles.pwField}>
            New password
            <input className={styles.input} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </label>
          <label className={styles.pwField}>
            Confirm new password
            <input className={styles.input} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </label>
        </div>
        {next && <PasswordChecklist value={next} />}
        {pwError && <div className={styles.pwError}>{pwError}</div>}
        {pwInfo && <div className={styles.pwInfo}>{pwInfo}</div>}
        <div className={styles.pwActions}>
          <button className={styles.button} type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Notifications</div>
        <label className={styles.pwField} style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-3)' }}>
          <input
            type="checkbox"
            checked={emailPref ?? true}
            disabled={emailPref === null}
            onChange={(e) => void toggleEmailPref(e.target.checked)}
          />
          Email me about approvals and decisions
        </label>
        <p className={styles.hint} style={{ marginTop: 'var(--space-2)' }}>
          In-app notifications (the bell) stay on regardless. Security emails like password resets are always sent.
        </p>
      </div>
    </>
  );
}
