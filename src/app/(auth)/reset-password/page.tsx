'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BRAND } from '@ems/config';
import { authApi } from '@/lib/auth';
import PasswordChecklist, { passwordValid } from '@/components/PasswordChecklist';
import styles from '../login/login.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token'));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!passwordValid(password)) {
      setError('Please choose a password that meets all the requirements.');
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.replace('/login'), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This reset link is invalid or has expired.');
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image src={BRAND.logo.horizontal} alt={BRAND.productName} width={168} height={41} priority />
        </div>
        <h1 className={styles.title}>Reset password</h1>
        <p className={styles.sub}>Choose a new password for your account.</p>

        {done ? (
          <>
            <div className={styles.info}>Your password has been reset. Redirecting to sign in…</div>
            <Link href="/login" className={styles.backLink}>Back to sign in</Link>
          </>
        ) : !token ? (
          <>
            <div className={styles.error}>This reset link is missing its token.</div>
            <Link href="/forgot-password" className={styles.backLink}>Request a new link</Link>
          </>
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            <label className={styles.label}>
              New password
              <input className={styles.input} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <label className={styles.label}>
              Confirm password
              <input className={styles.input} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </label>
            <PasswordChecklist value={password} />
            {error && <div className={styles.error}>{error}</div>}
            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset password'}
            </button>
            <Link href="/login" className={styles.backLink}>Back to sign in</Link>
          </form>
        )}
      </div>
    </main>
  );
}
