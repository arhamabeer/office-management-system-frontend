'use client';

import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import { useAuth } from '@/context/AuthContext';
import { useApprovals } from '@/context/ApprovalsContext';
import styles from './Sidebar.module.css';

type Item = { label: string; href: string; icon: ReactElement; badge?: number };

const icon = (path: string) => (
  <svg
    className={styles.icon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={path} />
  </svg>
);

const MAIN: Item[] = [
  { label: 'Dashboard', href: '/', icon: icon('M3 12l9-9 9 9M5 10v10h14V10') },
  { label: 'Attendance', href: '/attendance', icon: icon('M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z') },
  { label: 'Leaves', href: '/leaves', icon: icon('M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z') },
  { label: 'Payroll', href: '/payroll', icon: icon('M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6') },
  { label: 'Expenses', href: '/expenses', icon: icon('M3 6h18v12H3zM3 10h18M7 15h4') },
  { label: 'Complaints', href: '/complaints', icon: icon('M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z') },
  { label: 'Inventory Requests', href: '/inventory-requests', icon: icon('M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 7L12 12l8.73-5M12 22V12') },
  { label: 'Notices', href: '/notices', icon: icon('M3 10v4a1 1 0 001 1h3l5 4V5L7 9H4a1 1 0 00-1 1zM16 9a4 4 0 010 6') },
  { label: 'Employees', href: '/employees', icon: icon('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z') },
  { label: 'Profile', href: '/profile', icon: icon('M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z') },
];

// Visible to any approver (Owner or non-Member org role); the badge is live.
const APPROVALS_ITEM: Item = {
  label: 'Approvals',
  href: '/approvals',
  icon: icon('M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'),
};
// Owner/Manager/Lead — manage team membership.
const TEAMS_ITEM: Item = {
  label: 'Teams',
  href: '/teams',
  icon: icon('M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 108 0 4 4 0 00-8 0M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75'),
};
// Owner/Admin only.
const AUDIT_ITEM: Item = {
  label: 'Audit Log',
  href: '/audit-log',
  icon: icon('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8'),
};

function NavLink({ item, active, onNavigate }: { item: Item; active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={item.href}
      className={`${styles.item} ${active ? styles.itemActive : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
    >
      {item.icon}
      <span>{item.label}</span>
      {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isOrgAdmin } = useAuth();
  const { count } = useApprovals();
  const isApprover = !!user && (user.accountType === 'Owner' || user.orgRole !== 'Member');
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className={styles.hamburger}
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="primary-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {open && <div className={styles.backdrop} onClick={close} aria-hidden="true" />}

      <aside id="primary-nav" className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <div className={styles.brand}>
          <Logo height={26} />
        </div>
        <nav className={styles.nav} aria-label="Primary">
          {MAIN.map((i) => (
            <NavLink key={i.href} item={i} active={isActive(i.href)} onNavigate={close} />
          ))}
          {isApprover && (
            <>
              <div className={styles.sectionLabel}>Administration</div>
              <NavLink
                item={{ ...APPROVALS_ITEM, badge: count.total || undefined }}
                active={isActive(APPROVALS_ITEM.href)}
                onNavigate={close}
              />
              <NavLink item={TEAMS_ITEM} active={isActive(TEAMS_ITEM.href)} onNavigate={close} />
              {isOrgAdmin && (
                <NavLink item={AUDIT_ITEM} active={isActive(AUDIT_ITEM.href)} onNavigate={close} />
              )}
            </>
          )}
        </nav>
        <div className={styles.footer}>Phase 1 · v0.0.0</div>
      </aside>
    </>
  );
}
