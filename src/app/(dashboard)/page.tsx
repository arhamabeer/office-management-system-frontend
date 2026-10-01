'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BRAND } from '@ems/config';
import type { MyAttendanceResponse, LeaveBalanceDTO, PayslipDTO, AttendanceRosterDTO, AnnouncementDTO } from '@ems/types';
import { useAuth } from '@/context/AuthContext';
import { useApprovals } from '@/context/ApprovalsContext';
import { attendanceApi, leavesApi, payrollApi, announcementsApi, fmtMinutes, fmtMoney } from '@/lib/auth';
import StatCard from '@/components/StatCard';
import HealthBadge from '@/components/HealthBadge';
import styles from './page.module.css';

const svg = (path: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>
);

const ICON = {
  attendance: 'M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z',
  leave: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z',
  pay: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  check: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  people: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z',
  clock: 'M12 6v6l4 2M12 22a10 10 0 110-20 10 10 0 010 20z',
  x: 'M18 6L6 18M6 6l12 12',
};

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const { count, isApprover } = useApprovals();
  const firstName = profile?.firstName ?? user?.email?.split('@')[0] ?? 'there';

  const [att, setAtt] = useState<MyAttendanceResponse | null>(null);
  const [balances, setBalances] = useState<LeaveBalanceDTO[] | null>(null);
  const [payslips, setPayslips] = useState<PayslipDTO[] | null>(null);
  const [roster, setRoster] = useState<AttendanceRosterDTO | null>(null);
  const [notices, setNotices] = useState<AnnouncementDTO[]>([]);

  useEffect(() => {
    attendanceApi.me().then(setAtt).catch(() => setAtt(null));
    leavesApi.balance().then(setBalances).catch(() => setBalances(null));
    payrollApi.payslips().then(setPayslips).catch(() => setPayslips(null));
    announcementsApi.list().then(setNotices).catch(() => setNotices([]));
  }, []);

  useEffect(() => {
    if (isApprover) attendanceApi.roster().then(setRoster).catch(() => setRoster(null));
  }, [isApprover]);

  const leaveRemaining = balances ? balances.filter((b) => b.paid).reduce((s, b) => s + b.remaining, 0) : null;
  const leaveUsed = balances ? balances.reduce((s, b) => s + b.used, 0) : null;
  const latestPayslip = payslips && payslips.length ? payslips[0] : null;
  const todayRec = att?.today;
  const attValue = todayRec?.checkOutAt
    ? fmtMinutes(todayRec.workedMinutes)
    : todayRec?.checkInAt
      ? new Date(todayRec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';
  const attHint = todayRec?.checkOutAt ? 'Worked today' : todayRec?.checkInAt ? 'Checked in' : 'Not checked in';

  const c = roster?.counts;
  const present = c ? c.present + c.halfDay : null;

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Welcome back, {firstName}</h1>
          <p className={styles.subtitle}>
            Your {BRAND.productName} self-service portal — attendance, leaves, salary &amp; payslips.
          </p>
        </div>
        <HealthBadge />
      </div>

      {notices.length > 0 && (
        <section className={styles.panel} aria-label="Announcements">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Announcements</h2>
            <Link href="/notices" className={styles.panelLink}>View all →</Link>
          </div>
          {notices.slice(0, 3).map((n) => (
            <div key={n.id} className={styles.notice}>
              <div className={styles.noticeTitle}>
                {n.pinned && <span className={styles.noticePin}>📌</span>}
                {!n.read && <span className={styles.noticeNew}>New</span>}
                {n.title}
              </div>
              <div className={styles.noticeBody}>{n.body}</div>
            </div>
          ))}
        </section>
      )}

      <section className={styles.grid} aria-label="Summary">
        <StatCard href="/attendance" label="Today's Attendance" value={attValue} hint={attHint} icon={svg(ICON.attendance)} />
        <StatCard href="/leaves" label="Leave Balance" value={leaveRemaining == null ? '—' : `${leaveRemaining} days`} hint="Paid leave remaining" icon={svg(ICON.leave)} />
        <StatCard href="/payroll" label="Latest Payslip" value={latestPayslip ? fmtMoney(latestPayslip.netPay, latestPayslip.currency) : '—'} hint={latestPayslip ? `Net · ${latestPayslip.month}` : 'No payslip yet'} icon={svg(ICON.pay)} />
        {isApprover ? (
          <StatCard href="/approvals" label="Pending Approvals" value={String(count.total)} hint={count.total ? 'Awaiting your decision' : 'All clear'} icon={svg(ICON.check)} />
        ) : (
          <StatCard href="/leaves" label="Leave Taken" value={leaveUsed == null ? '—' : `${leaveUsed} days`} hint="This year" icon={svg(ICON.check)} />
        )}
      </section>

      {isApprover && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Team today</h2>
            <Link href="/attendance" className={styles.panelLink}>View team →</Link>
          </div>
          {roster ? (
            roster.rows.length ? (
              <div className={styles.grid}>
                <StatCard href="/attendance" label="Headcount" value={String(roster.rows.length)} hint="In your scope" icon={svg(ICON.people)} />
                <StatCard href="/attendance" label="Present" value={present == null ? '—' : String(present)} hint="Checked in today" icon={svg(ICON.attendance)} />
                <StatCard href="/attendance" label="Not checked in" value={String(c?.notCheckedIn ?? 0)} hint="Yet to arrive" icon={svg(ICON.clock)} />
                <StatCard href="/attendance" label="Absent / Leave" value={`${c?.absent ?? 0} / ${c?.onLeave ?? 0}`} hint="Absent · on leave" icon={svg(ICON.x)} />
              </div>
            ) : (
              <p className={styles.panelText}>No one in your team scope yet.</p>
            )
          ) : (
            <p className={styles.panelText}>Loading team…</p>
          )}
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.pillRow}>
          <span className={`${styles.pill} ${styles.pillBrand}`}>Role: {user?.accountType} · {user?.orgRole}</span>
          <span className={styles.pill}>JWT + refresh rotation</span>
          <span className={styles.pill}>argon2id</span>
          <span className={styles.pill}>Audit logging</span>
        </div>
        <p className={styles.panelText}>
          Your data is scoped to your role: Owners/Admins see the whole organization, Managers and
          Leads see their team and anyone in teams they lead, and Members see themselves. Use the
          sidebar to open Attendance, Leaves, Payroll and more.
        </p>
      </section>
    </>
  );
}
