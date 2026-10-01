'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import { useAuth } from '@/context/AuthContext';
import styles from './Topbar.module.css';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function Topbar() {
  const { user, profile, logout } = useAuth();
  const router = useRouter();

  const name = profile?.fullName || user?.email || '';
  const roleLabel = user ? `${user.accountType} · ${user.orgRole}` : '';
  const [search, setSearch] = useState('');

  const onLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/employees?q=${encodeURIComponent(q)}` : '/employees');
  };

  return (
    <header className={styles.topbar}>
      <form className={styles.search} onSubmit={onSearch} role="search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          placeholder="Search employees…"
          aria-label="Search employees"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>

      <div className={styles.spacer} />

      <ThemeToggle />

      <NotificationBell />

      <div className={styles.user}>
        <span className={styles.avatar}>{initials(name)}</span>
        <span className={styles.userMeta}>
          <span className={styles.userName}>{name}</span>
          <span className={styles.userRole}>{roleLabel}</span>
        </span>
      </div>

      <button className={styles.iconBtn} onClick={onLogout} aria-label="Sign out" title="Sign out" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
      </button>
    </header>
  );
}
