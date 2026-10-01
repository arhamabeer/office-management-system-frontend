'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BRAND } from '@ems/config';
import { useAuth } from '@/context/AuthContext';
import styles from './login.module.css';

const DEMO = [{ role: 'Owner · Admin (Muhammed Fahad)', email: 'owner@braincrop.io' }];

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('owner@braincrop.io');
  const [password, setPassword] = useState('Passw0rd!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.wrap}>
      <form className={styles.card} onSubmit={onSubmit}>
        <div className={styles.brand}>
          <Image src={BRAND.logo.horizontal} alt={BRAND.productName} width={168} height={41} priority />
        </div>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.sub}>Employee Management System</p>

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
        <label className={styles.label}>
          Password
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <div className={styles.forgotRow}>
          <Link href="/forgot-password" className={styles.forgot}>Forgot password?</Link>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <details className={styles.demo}>
          <summary>Demo accounts (password: Passw0rd!)</summary>
          <div className={styles.demoList}>
            {DEMO.map((d) => (
              <button
                type="button"
                key={d.email}
                className={styles.demoItem}
                onClick={() => {
                  setEmail(d.email);
                  setPassword('Passw0rd!');
                }}
              >
                <span>{d.role}</span>
                <code>{d.email}</code>
              </button>
            ))}
          </div>
        </details>
      </form>
    </main>
  );
}
