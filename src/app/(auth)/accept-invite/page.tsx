'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BRAND } from '@ems/config';
import type { InviteInfoDTO } from '@ems/types';
import { authApi } from '@/lib/auth';
import { setAccessToken } from '@/lib/authToken';
import { useAuth } from '@/context/AuthContext';
import PasswordChecklist, { passwordValid } from '@/components/PasswordChecklist';
import styles from './accept-invite.module.css';

export default function AcceptInvitePage() {
  const router = useRouter();
  const { reloadMe } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteInfoDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Read the token from the URL on the client (avoids a Suspense boundary).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    setToken(t);
    if (!t) {
      setLoadError('This onboarding link is missing its token.');
      setLoading(false);
      return;
    }
    let alive = true;
    authApi
      .inviteInfo(t)
      .then((info) => {
        if (!alive) return;
        setInvite(info);
        setFirstName(info.firstName);
        setLastName(info.lastName);
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof Error ? e.message : 'This invitation is invalid or has expired.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
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
      const res = await authApi.acceptInvite({
        token,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setAccessToken(res.accessToken);
      await reloadMe();
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete onboarding.');
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image src={BRAND.logo.horizontal} alt={BRAND.productName} width={168} height={41} priority />
        </div>

        {loading ? (
          <p className={styles.center}>Loading your invitation…</p>
        ) : loadError ? (
          <>
            <h1 className={styles.title}>Invitation unavailable</h1>
            <p className={styles.sub}>{loadError}</p>
            <button className={styles.button} type="button" onClick={() => router.replace('/login')}>
              Go to sign in
            </button>
          </>
        ) : invite ? (
          <form onSubmit={onSubmit}>
            <h1 className={styles.title}>Welcome to {invite.orgName}</h1>
            <p className={styles.sub}>Set up your account to get started.</p>
            <div className={styles.meta}>
              <span>{invite.email}</span>
              <span className={styles.pill}>{invite.designation || invite.orgRole}</span>
            </div>

            <div className={styles.row}>
              <label className={styles.label}>
                First name
                <input className={styles.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </label>
              <label className={styles.label}>
                Last name
                <input className={styles.input} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </label>
            </div>

            <label className={styles.label}>
              <span>Phone <span className={styles.optional}>(optional)</span></span>
              <input className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </label>

            <label className={styles.label}>
              Create password
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label className={styles.label}>
              Confirm password
              <input
                className={styles.input}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <PasswordChecklist value={password} />

            {error && <div className={styles.error}>{error}</div>}

            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? 'Setting up…' : 'Complete onboarding'}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
