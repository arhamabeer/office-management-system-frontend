'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BRAND } from '@ems/config';
import { authApi } from '@/lib/auth';
import styles from '../login/login.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setSent(true);
      setDevToken(res.devToken ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image src={BRAND.logo.horizontal} alt={BRAND.productName} width={168} height={41} priority />
        </div>
        <h1 className={styles.title}>Forgot password</h1>
        <p className={styles.sub}>We&apos;ll email you a link to reset it.</p>

        {sent ? (
          <>
            <div className={styles.info}>
              If an account exists for <strong>{email}</strong>, a reset link is on its way. The link is valid for 1 hour.
            </div>
            {devToken && (
              <p className={styles.hint}>
                Dev shortcut:{' '}
                <Link className={styles.devLink} href={`/reset-password?token=${devToken}`}>
                  /reset-password?token=…
                </Link>
              </p>
            )}
            <Link href="/login" className={styles.backLink}>Back to sign in</Link>
          </>
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            <label className={styles.label}>
              Email
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            {error && <div className={styles.error}>{error}</div>}
            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
            <Link href="/login" className={styles.backLink}>Back to sign in</Link>
          </form>
        )}
      </div>
    </main>
  );
}
