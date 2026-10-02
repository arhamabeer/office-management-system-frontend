'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type {
  MyAttendanceResponse,
  AttendanceRosterDTO,
  AttendanceReportDTO,
  PersonWeeksDTO,
  AttendancePeriod,
  RegularizationDTO,
  RegularizationKind,
  AttendancePolicyDTO,
  HolidayDTO,
  BiometricDeviceDTO,
  UnmappedPinDTO,
  EmployeeProfileDTO,
} from '@ems/types';
import { attendanceApi, employeesApi, fmtMinutes } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './attendance.module.css';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(iso?: string): string {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function regKindLabel(kind?: RegularizationKind): string {
  return kind === 'DeviceDown' ? 'Device-down' : 'Correction';
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
function statusBadge(status: string): string {
  if (status === 'Present') return styles.bPresent;
  if (status === 'HalfDay') return styles.bHalfDay;
  if (status === 'Absent') return styles.bAbsent;
  return styles.bOther;
}
function statusLabel(status: string): string {
  return status === 'NotCheckedIn' ? 'Not checked in' : status;
}
function fmtWeekRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const s = new Date(`${start}T00:00:00`).toLocaleDateString([], opts);
  const e = new Date(`${end}T00:00:00`).toLocaleDateString([], opts);
  return `${s} – ${e}`;
}

const PERIODS: { value: AttendancePeriod; label: string }[] = [
  { value: '1w', label: '1 week' },
  { value: '2w', label: '2 weeks' },
  { value: '1m', label: '1 month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
];

type Tab = 'my' | 'team' | 'reports' | 'settings';

export default function AttendancePage() {
  const { user } = useAuth();
  const canTeam = !!user && (user.accountType === 'Owner' || user.orgRole !== 'Member');
  const isOrgAdmin = !!user && (user.accountType === 'Owner' || user.orgRole === 'Admin');

  const [tab, setTab] = useState<Tab>('my');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // My
  const [month, setMonth] = useState(currentMonth());
  const [my, setMy] = useState<MyAttendanceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [myRequests, setMyRequests] = useState<RegularizationDTO[]>([]);
  // false = form hidden; otherwise the kind of request being raised.
  const [showReg, setShowReg] = useState<false | RegularizationKind>(false);
  const [reg, setReg] = useState({ date: today(), inTime: '09:00', outTime: '18:00', reason: '' });

  // Team
  const [teamDate, setTeamDate] = useState(today());
  const [roster, setRoster] = useState<AttendanceRosterDTO | null>(null);
  const [pending, setPending] = useState<RegularizationDTO[]>([]);
  const [runningSweep, setRunningSweep] = useState(false);
  const [weekMins, setWeekMins] = useState<Record<string, number>>({}); // userId -> this week worked minutes
  const [weeklyMin, setWeeklyMin] = useState(2700);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [weeksCache, setWeeksCache] = useState<Record<string, PersonWeeksDTO>>({});

  // Reports
  const [reportPeriod, setReportPeriod] = useState<AttendancePeriod>('1m');
  const [report, setReport] = useState<AttendanceReportDTO | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Settings
  const [policy, setPolicy] = useState<AttendancePolicyDTO | null>(null);
  const [holidays, setHolidays] = useState<HolidayDTO[]>([]);
  const [holiday, setHoliday] = useState({ date: today(), name: '' });

  // Biometric devices (Settings, admin only)
  const [devices, setDevices] = useState<BiometricDeviceDTO[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedPinDTO[]>([]);
  const [people, setPeople] = useState<EmployeeProfileDTO[]>([]);
  const [mapPick, setMapPick] = useState<Record<string, string>>({}); // pin -> userId
  const [deviceBusy, setDeviceBusy] = useState(false);

  const loadMy = useCallback(async () => {
    setError(null);
    try {
      const [m, reqs] = await Promise.all([
        attendanceApi.me(month),
        attendanceApi.regularizations('mine'),
      ]);
      setMy(m);
      setMyRequests(reqs);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [month]);

  const loadTeam = useCallback(async () => {
    setError(null);
    try {
      const [r, p, wk] = await Promise.all([
        attendanceApi.roster(teamDate),
        attendanceApi.regularizations('pending'),
        attendanceApi.report('1w'),
      ]);
      setRoster(r);
      setPending(p);
      setWeeklyMin(wk.weeklyMinimumMinutes);
      const map: Record<string, number> = {};
      wk.rows.forEach((row) => (map[row.userId] = row.totalWorkedMinutes));
      setWeekMins(map);
      setExpanded(null);
      setWeeksCache({});
    } catch (e) {
      setError(errMsg(e));
    }
  }, [teamDate]);

  const loadReport = useCallback(async () => {
    setError(null);
    try {
      setReport(await attendanceApi.report(reportPeriod));
    } catch (e) {
      setError(errMsg(e));
    }
  }, [reportPeriod]);

  const loadSettings = useCallback(async () => {
    setError(null);
    try {
      const [p, h] = await Promise.all([
        attendanceApi.policy(),
        attendanceApi.holidays(new Date().getFullYear()),
      ]);
      setPolicy(p);
      setHolidays(h);
      if (isOrgAdmin) {
        const [devs, un, emp] = await Promise.all([
          attendanceApi.devices(),
          attendanceApi.unmappedPins(),
          employeesApi.list({ pageSize: 100 }),
        ]);
        setDevices(devs);
        setUnmapped(un);
        setPeople(emp.items);
      }
    } catch (e) {
      setError(errMsg(e));
    }
  }, [isOrgAdmin]);

  const setDeviceStatus = async (id: string, status: 'Enabled' | 'Disabled') => {
    setDeviceBusy(true);
    setError(null);
    try {
      await attendanceApi.updateDevice(id, { status });
      setInfo(`Device ${status.toLowerCase()}.`);
      await loadSettings();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDeviceBusy(false);
    }
  };

  const doMapPin = async (pin: string) => {
    const userId = mapPick[pin];
    if (!userId) return;
    setDeviceBusy(true);
    setError(null);
    try {
      const r = await attendanceApi.mapPin({ pin, userId });
      setInfo(`Linked device ID ${pin} — ${r.derived} day(s) synced.`);
      setMapPick((m) => ({ ...m, [pin]: '' }));
      await loadSettings();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDeviceBusy(false);
    }
  };

  const doReconcile = async () => {
    setDeviceBusy(true);
    setError(null);
    try {
      const r = await attendanceApi.reconcileDevices();
      setInfo(`Re-synced ${r.daysRederived} day(s) (${r.from} → ${r.to}).`);
      await loadSettings();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDeviceBusy(false);
    }
  };

  useEffect(() => {
    void loadMy();
  }, [loadMy]);
  useEffect(() => {
    if (tab === 'team') void loadTeam();
    if (tab === 'reports') void loadReport();
    if (tab === 'settings') void loadSettings();
  }, [tab, loadTeam, loadReport, loadSettings]);

  const toggleExpand = async (userId: string) => {
    if (expanded === userId) {
      setExpanded(null);
      return;
    }
    setExpanded(userId);
    if (!weeksCache[userId]) {
      try {
        const w = await attendanceApi.personWeeks(userId, 4);
        setWeeksCache((c) => ({ ...c, [userId]: w }));
      } catch (e) {
        setError(errMsg(e));
      }
    }
  };

  const downloadReport = async (format: 'pdf' | 'xlsx') => {
    setDownloading(format);
    setError(null);
    try {
      await attendanceApi.downloadReport(reportPeriod, format);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDownloading(null);
    }
  };

  const punch = async (action: 'in' | 'out') => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (action === 'in') await attendanceApi.checkIn('SelfWeb');
      else await attendanceApi.checkOut();
      await loadMy();
      setInfo(action === 'in' ? 'Checked in.' : 'Checked out.');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const submitReg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const kind: RegularizationKind = showReg || 'Correction';
    try {
      await attendanceApi.createRegularization({
        kind,
        date: reg.date,
        checkInAt: `${reg.date}T${reg.inTime}:00`,
        checkOutAt: reg.outTime ? `${reg.date}T${reg.outTime}:00` : undefined,
        reason: reg.reason,
      });
      setShowReg(false);
      setReg({ date: today(), inTime: '09:00', outTime: '18:00', reason: '' });
      setInfo(kind === 'DeviceDown' ? 'Attendance submitted for approval.' : 'Correction request submitted.');
      await loadMy();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const decide = async (id: string, approve: boolean) => {
    setError(null);
    try {
      if (approve) await attendanceApi.approveRegularization(id);
      else await attendanceApi.rejectRegularization(id);
      await loadTeam();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const runSweep = async () => {
    setRunningSweep(true);
    setError(null);
    setInfo(null);
    try {
      const r = await attendanceApi.runAutoAbsent(true);
      setInfo(
        r.skipped
          ? `Absence check skipped (${r.skipped}).`
          : `Absence check done — ${r.markedAbsent} marked absent, ${r.notified} notified.`,
      );
      await loadTeam();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setRunningSweep(false);
    }
  };

  const savePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    setError(null);
    try {
      const saved = await attendanceApi.updatePolicy(policy);
      setPolicy(saved);
      setInfo('Policy saved.');
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const addHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await attendanceApi.createHoliday(holiday);
      setHoliday({ date: today(), name: '' });
      await loadSettings();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const todayRec = my?.today;
  const s = my?.summary;

  const tiles = useMemo(
    () =>
      s
        ? [
            { label: 'Present', value: String(s.present) },
            { label: 'Half-days', value: String(s.halfDay) },
            { label: 'Absent', value: String(s.absent) },
            { label: 'Avg / day', value: fmtMinutes(s.avgWorkedMinutes) },
            { label: 'Overtime', value: fmtMinutes(s.totalOvertimeMinutes) },
          ]
        : [],
    [s],
  );

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Attendance</h1>
          <p className={styles.subtitle}>Check in/out, review your month, and manage corrections.</p>
        </div>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'my' ? styles.tabActive : ''}`} aria-pressed={tab === 'my'} onClick={() => setTab('my')}>
          My attendance
        </button>
        {canTeam && (
          <button className={`${styles.tab} ${tab === 'team' ? styles.tabActive : ''}`} aria-pressed={tab === 'team'} onClick={() => setTab('team')}>
            Team
          </button>
        )}
        {canTeam && (
          <button className={`${styles.tab} ${tab === 'reports' ? styles.tabActive : ''}`} aria-pressed={tab === 'reports'} onClick={() => setTab('reports')}>
            Reports
          </button>
        )}
        {isOrgAdmin && (
          <button className={`${styles.tab} ${tab === 'settings' ? styles.tabActive : ''}`} aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>
            Settings
          </button>
        )}
      </div>

      {tab === 'my' && (
        <>
          <div className={styles.punch}>
            <div className={styles.punchInfo}>
              <span className={styles.punchLabel}>Today · Check-in</span>
              <span className={styles.punchValue}>{fmtTime(todayRec?.checkInAt)}</span>
            </div>
            <div className={styles.punchInfo}>
              <span className={styles.punchLabel}>Check-out</span>
              <span className={styles.punchValue}>{fmtTime(todayRec?.checkOutAt)}</span>
            </div>
            <div className={styles.punchInfo}>
              <span className={styles.punchLabel}>Worked</span>
              <span className={styles.punchValue}>{fmtMinutes(todayRec?.workedMinutes ?? 0)}</span>
            </div>
            <div className={styles.punchActions}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={busy || !!todayRec?.checkInAt}
                onClick={() => punch('in')}
              >
                Check in
              </button>
              <button
                className={styles.btn}
                disabled={busy || !todayRec?.checkInAt || !!todayRec?.checkOutAt}
                onClick={() => punch('out')}
              >
                Check out
              </button>
            </div>
          </div>

          <div className={styles.tiles}>
            {tiles.map((t) => (
              <div className={styles.tile} key={t.label}>
                <div className={styles.tileLabel}>{t.label}</div>
                <div className={styles.tileValue}>{t.value}</div>
              </div>
            ))}
          </div>

          <div className={styles.toolbar}>
            <input className={styles.input} type="month" aria-label="Select month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <div className={styles.spacer} />
            <button className={styles.btn} onClick={() => setShowReg((v) => (v === 'Correction' ? false : 'Correction'))}>
              {showReg === 'Correction' ? 'Cancel' : 'Request correction'}
            </button>
            <button className={styles.btn} onClick={() => setShowReg((v) => (v === 'DeviceDown' ? false : 'DeviceDown'))}>
              {showReg === 'DeviceDown' ? 'Cancel' : 'Device was down'}
            </button>
          </div>

          {showReg && (
            <form className={styles.card} onSubmit={submitReg}>
              <div className={styles.cardTitle}>
                {showReg === 'DeviceDown' ? 'Submit attendance (device was down)' : 'Request a correction'}
              </div>
              {showReg === 'DeviceDown' && (
                <div className={styles.muted} style={{ marginBottom: 'var(--space-2)' }}>
                  Use this only when the biometric device was off (e.g. a power cut). Your submission goes to your manager for approval.
                </div>
              )}
              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  Date
                  <input className={styles.input} type="date" value={reg.date} onChange={(e) => setReg({ ...reg, date: e.target.value })} required />
                </label>
                <label className={styles.formField}>
                  Check-in
                  <input className={styles.input} type="time" value={reg.inTime} onChange={(e) => setReg({ ...reg, inTime: e.target.value })} required />
                </label>
                <label className={styles.formField}>
                  Check-out{showReg === 'DeviceDown' ? ' (optional)' : ''}
                  <input className={styles.input} type="time" value={reg.outTime} onChange={(e) => setReg({ ...reg, outTime: e.target.value })} required={showReg !== 'DeviceDown'} />
                </label>
                <label className={styles.formField} style={{ gridColumn: '1 / -1' }}>
                  Reason
                  <input className={styles.input} value={reg.reason} onChange={(e) => setReg({ ...reg, reason: e.target.value })} required minLength={3} />
                </label>
              </div>
              <div className={styles.formActions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">
                  {showReg === 'DeviceDown' ? 'Submit for approval' : 'Submit request'}
                </button>
              </div>
            </form>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Check-in</th>
                  <th scope="col">Check-out</th>
                  <th scope="col">Worked</th>
                  <th scope="col">Overtime</th>
                </tr>
              </thead>
              <tbody>
                {my && my.records.length ? (
                  my.records.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td><span className={`${styles.badge} ${statusBadge(r.status)}`}>{r.status}</span></td>
                      <td>{fmtTime(r.checkInAt)}</td>
                      <td>{fmtTime(r.checkOutAt)}</td>
                      <td>{fmtMinutes(r.workedMinutes)}</td>
                      <td>{r.overtimeMinutes ? fmtMinutes(r.overtimeMinutes) : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className={styles.empty}>No records this month.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {myRequests.length > 0 && (
            <div className={styles.card} style={{ marginTop: 'var(--space-4)' }}>
              <div className={styles.cardTitle}>My requests</div>
              {myRequests.map((r) => (
                <div className={styles.holidayRow} key={r.id}>
                  <span>{r.date} · {regKindLabel(r.kind)} · {r.reason}</span>
                  <span className={`${styles.badge} ${r.status === 'Approved' ? styles.bPresent : r.status === 'Rejected' ? styles.bAbsent : styles.bOther}`}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'team' && canTeam && (
        <>
          {pending.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Pending attendance approvals ({pending.length})</div>
              {pending.map((r) => (
                <div className={styles.holidayRow} key={r.id}>
                  <span>
                    <strong>{r.employeeName ?? r.userId}</strong> · {regKindLabel(r.kind)} · {r.date} · {fmtTime(r.requestedCheckInAt)}{r.requestedCheckOutAt ? `–${fmtTime(r.requestedCheckOutAt)}` : ''} · {r.reason}
                  </span>
                  <span className={styles.rowActions}>
                    <button className={`${styles.btn} ${styles.btnGhostOk}`} onClick={() => decide(r.id, true)}>Approve</button>
                    <button className={`${styles.btn} ${styles.btnGhostDanger}`} onClick={() => decide(r.id, false)}>Reject</button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className={styles.toolbar}>
            <input className={styles.input} type="date" aria-label="Select date" value={teamDate} onChange={(e) => setTeamDate(e.target.value)} />
            <div className={styles.spacer} />
            {isOrgAdmin && (
              <button className={styles.btn} onClick={runSweep} disabled={runningSweep}>
                {runningSweep ? 'Running…' : 'Run absence check'}
              </button>
            )}
            <button className={styles.btn} onClick={() => attendanceApi.downloadTeamCsv({ date: teamDate }).catch((e) => setError(errMsg(e)))}>
              Export CSV
            </button>
          </div>

          {roster && (
            <div className={styles.tiles}>
              <div className={styles.tile}><div className={styles.tileLabel}>Present</div><div className={styles.tileValue}>{roster.counts.present + roster.counts.halfDay}</div></div>
              <div className={styles.tile}><div className={styles.tileLabel}>Not checked in</div><div className={styles.tileValue}>{roster.counts.notCheckedIn}</div></div>
              <div className={styles.tile}><div className={styles.tileLabel}>Absent</div><div className={styles.tileValue}>{roster.counts.absent}</div></div>
              <div className={styles.tile}><div className={styles.tileLabel}>On leave</div><div className={styles.tileValue}>{roster.counts.onLeave}</div></div>
            </div>
          )}

          {roster?.nonWorking && (
            <div className={`${styles.banner} ${styles.bannerInfo}`}>
              {teamDate} is a non-working day{roster.nonWorkingReason ? ` (${roster.nonWorkingReason})` : ''}.
            </div>
          )}

          <div className={styles.hint}>Tip: click a row to see the last 4 weeks. “This week” totals worked hours Mon–today.</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" aria-label="Expand"></th>
                  <th scope="col">Employee</th>
                  <th scope="col">Status</th>
                  <th scope="col">Check-in</th>
                  <th scope="col">Check-out</th>
                  <th scope="col" className={styles.num}>This week</th>
                </tr>
              </thead>
              <tbody>
                {roster && roster.rows.length ? (
                  roster.rows.map((r) => {
                    const isOpen = expanded === r.userId;
                    const wk = weekMins[r.userId] ?? 0;
                    const pw = weeksCache[r.userId];
                    return (
                      <Fragment key={r.userId}>
                        <tr className={styles.rowClickable} onClick={() => void toggleExpand(r.userId)} aria-expanded={isOpen}>
                          <td className={styles.caretCell}><span className={`${styles.caret} ${isOpen ? styles.caretOpen : ''}`}>▸</span></td>
                          <td>
                            <strong>{r.employeeName}</strong>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-xs)' }}>{r.designation ? `${r.designation} · ` : ''}{r.email}</div>
                          </td>
                          <td><span className={`${styles.badge} ${statusBadge(r.status)}`}>{statusLabel(r.status)}</span></td>
                          <td>{fmtTime(r.checkInAt)}</td>
                          <td>{fmtTime(r.checkOutAt)}</td>
                          <td className={styles.num}>{fmtMinutes(wk)}</td>
                        </tr>
                        {isOpen && (
                          <tr className={styles.weekRow}>
                            <td colSpan={6}>
                              <div className={styles.weekPanel}>
                                <div className={styles.weekPanelTitle}>Last 4 weeks — minimum {fmtMinutes(weeklyMin)}/week</div>
                                {pw ? (
                                  <div className={styles.weekGrid}>
                                    {pw.weeks.map((w) => (
                                      <div key={w.weekStart} className={styles.weekCard}>
                                        <div className={styles.weekCardHead}>
                                          <span>{fmtWeekRange(w.weekStart, w.weekEnd)}</span>
                                          {w.short && <span className={`${styles.badge} ${styles.bAbsent}`}>Short</span>}
                                          {!w.complete && <span className={styles.weekTag}>in progress</span>}
                                        </div>
                                        <div className={styles.weekHours}>{fmtMinutes(w.workedMinutes)}</div>
                                        <div className={styles.weekMeta}>
                                          {w.present + w.halfDay}P · {w.absent}A · {w.onLeave}L
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className={styles.muted}>Loading…</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr><td colSpan={6} className={styles.empty}>No employees to show for {teamDate}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'reports' && canTeam && (
        <>
          <div className={styles.periodBar}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                className={`${styles.periodBtn} ${reportPeriod === p.value ? styles.periodBtnActive : ''}`}
                aria-pressed={reportPeriod === p.value}
                onClick={() => setReportPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
            <div className={styles.spacer} />
            <button className={styles.btn} disabled={downloading !== null} onClick={() => downloadReport('pdf')}>
              {downloading === 'pdf' ? 'Preparing…' : 'Download PDF'}
            </button>
            <button className={styles.btn} disabled={downloading !== null} onClick={() => downloadReport('xlsx')}>
              {downloading === 'xlsx' ? 'Preparing…' : 'Download Excel'}
            </button>
          </div>

          {report && (
            <div className={styles.muted} style={{ marginBottom: 'var(--space-3)' }}>
              {fmtWeekRange(report.start, report.end)} · weekly minimum {fmtMinutes(report.weeklyMinimumMinutes)}
            </div>
          )}

          {report && (
            <div className={styles.rankGrid}>
              <div className={styles.rankCol}>
                <div className={styles.rankTitle}>Top 3 — most hours</div>
                {report.top.length ? report.top.map((r, i) => (
                  <div key={r.userId} className={`${styles.rankCard} ${styles.rankCardTop}`}>
                    <span className={styles.rankNum}>{i + 1}</span>
                    <div className={styles.rankBody}>
                      <div className={styles.rankName}>{r.employeeName}</div>
                      <div className={styles.rankMeta}>{r.daysPresent}P · {r.daysAbsent}A · {r.shortWeeks} short wk</div>
                    </div>
                    <span className={styles.rankValue}>{fmtMinutes(r.totalWorkedMinutes)}</span>
                  </div>
                )) : <div className={styles.muted}>—</div>}
              </div>
              <div className={styles.rankCol}>
                <div className={styles.rankTitle}>Lowest 3 — fewest hours</div>
                {report.lowest.length ? report.lowest.map((r, i) => (
                  <div key={r.userId} className={`${styles.rankCard} ${styles.rankCardLow}`}>
                    <span className={styles.rankNum}>{i + 1}</span>
                    <div className={styles.rankBody}>
                      <div className={styles.rankName}>{r.employeeName}</div>
                      <div className={styles.rankMeta}>{r.daysPresent}P · {r.daysAbsent}A · {r.shortWeeks} short wk</div>
                    </div>
                    <span className={styles.rankValue}>{fmtMinutes(r.totalWorkedMinutes)}</span>
                  </div>
                )) : <div className={styles.muted}>—</div>}
              </div>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col" className={styles.num}>Total</th>
                  <th scope="col" className={styles.num}>Avg/wk</th>
                  <th scope="col" className={styles.num}>Present</th>
                  <th scope="col" className={styles.num}>Absent</th>
                  <th scope="col" className={styles.num}>Leave</th>
                  <th scope="col" className={styles.num}>Short wks</th>
                </tr>
              </thead>
              <tbody>
                {report && report.rows.length ? (
                  report.rows.map((r) => (
                    <tr key={r.userId}>
                      <td>
                        <strong>{r.employeeName}</strong>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-xs)' }}>{r.email}</div>
                      </td>
                      <td className={styles.num}>{fmtMinutes(r.totalWorkedMinutes)}</td>
                      <td className={styles.num}>{fmtMinutes(r.avgWeeklyMinutes)}</td>
                      <td className={styles.num}>{r.daysPresent}</td>
                      <td className={styles.num}>{r.daysAbsent}</td>
                      <td className={styles.num}>{r.daysOnLeave}</td>
                      <td className={styles.num}>{r.shortWeeks > 0 ? <span className={`${styles.badge} ${styles.bAbsent}`}>{r.shortWeeks}</span> : '0'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} className={styles.empty}>No data for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'settings' && isOrgAdmin && policy && (
        <>
          <form className={styles.card} onSubmit={savePolicy}>
            <div className={styles.cardTitle}>Attendance policy</div>
            <div className={styles.formGrid}>
              <label className={styles.formField}>
                Full-day minutes
                <input className={styles.input} type="number" value={policy.workdayMinutes} onChange={(e) => setPolicy({ ...policy, workdayMinutes: Number(e.target.value) })} />
              </label>
              <label className={styles.formField}>
                Half-day minutes
                <input className={styles.input} type="number" value={policy.halfDayMinutes} onChange={(e) => setPolicy({ ...policy, halfDayMinutes: Number(e.target.value) })} />
              </label>
              <label className={styles.formField}>
                Shift start
                <input className={styles.input} type="time" value={policy.shiftStart} onChange={(e) => setPolicy({ ...policy, shiftStart: e.target.value })} />
              </label>
              <label className={styles.formField}>
                Shift end
                <input className={styles.input} type="time" value={policy.shiftEnd} onChange={(e) => setPolicy({ ...policy, shiftEnd: e.target.value })} />
              </label>
              <label className={styles.formField}>
                Grace minutes
                <input className={styles.input} type="number" value={policy.graceMinutes} onChange={(e) => setPolicy({ ...policy, graceMinutes: Number(e.target.value) })} />
              </label>
              <label className={styles.formField}>
                Timezone
                <input className={styles.input} value={policy.timezone} onChange={(e) => setPolicy({ ...policy, timezone: e.target.value })} placeholder="Asia/Karachi" />
              </label>
              <label className={styles.formField}>
                Auto-absent cut-off
                <input className={styles.input} type="time" value={policy.autoAbsentCutoff} onChange={(e) => setPolicy({ ...policy, autoAbsentCutoff: e.target.value })} />
              </label>
              <label className={styles.formField}>
                Weekly minimum (hours)
                <input className={styles.input} type="number" min={0} step={0.5} value={Math.round((policy.weeklyMinimumMinutes / 60) * 100) / 100} onChange={(e) => setPolicy({ ...policy, weeklyMinimumMinutes: Math.round(Number(e.target.value) * 60) })} />
              </label>
              <label className={styles.formField} style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input type="checkbox" checked={policy.autoAbsentEnabled} onChange={(e) => setPolicy({ ...policy, autoAbsentEnabled: e.target.checked })} />
                Mark not-checked-in employees absent after the cut-off
              </label>
            </div>
            <div className={styles.muted} style={{ marginTop: 'var(--space-2)' }}>
              Saturdays and Sundays are always non-working. After the cut-off, employees who haven&apos;t checked in are marked absent and emailed (with their manager); a later check-in flips them back to present. Owners and admins are exempt.
            </div>
            <div className={styles.formActions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Save policy</button>
            </div>
          </form>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Holidays ({new Date().getFullYear()})</div>
            {holidays.map((h) => (
              <div className={styles.holidayRow} key={h.id}>
                <span><strong>{h.date}</strong> · {h.name}</span>
                <button className={`${styles.btn} ${styles.btnGhostDanger}`} onClick={() => attendanceApi.deleteHoliday(h.id).then(loadSettings).catch((e) => setError(errMsg(e)))}>Remove</button>
              </div>
            ))}
            <form className={styles.formActions} onSubmit={addHoliday} style={{ marginTop: 'var(--space-3)' }}>
              <input className={styles.input} type="date" aria-label="Holiday date" value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} required />
              <input className={styles.input} aria-label="Holiday name" placeholder="Holiday name" value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} required />
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Add holiday</button>
            </form>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span>Biometric devices</span>
              <button className={styles.btn} disabled={deviceBusy} onClick={doReconcile}>Re-sync now</button>
            </div>
            <div className={styles.muted} style={{ marginBottom: 'var(--space-3)' }}>
              A device appears here automatically the first time it pushes to the server. A new device is <strong>Pending</strong>: its punches are stored but only become attendance once you <strong>Enable</strong> it.
            </div>
            {devices.length ? (
              devices.map((d) => (
                <div className={styles.holidayRow} key={d.id}>
                  <span>
                    <strong>{d.label || d.serial}</strong>{' '}
                    <span className={`${styles.badge} ${d.status === 'Enabled' ? styles.bPresent : d.status === 'Disabled' ? styles.bAbsent : styles.bOther}`}>{d.status}</span>
                    {' '}· {d.punchCount} punches · last seen {fmtDateTime(d.lastSeenAt)}
                  </span>
                  <span className={styles.rowActions}>
                    {d.status !== 'Enabled' && (
                      <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={deviceBusy} onClick={() => setDeviceStatus(d.id, 'Enabled')}>Enable</button>
                    )}
                    {d.status !== 'Disabled' && (
                      <button className={`${styles.btn} ${styles.btnGhostDanger}`} disabled={deviceBusy} onClick={() => setDeviceStatus(d.id, 'Disabled')}>Disable</button>
                    )}
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.muted}>No devices have connected yet.</div>
            )}
          </div>

          {unmapped.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Unlinked device IDs ({unmapped.length})</div>
              <div className={styles.muted} style={{ marginBottom: 'var(--space-3)' }}>
                These PINs punched on a device but aren&apos;t linked to an employee yet. Assign each one so its attendance is recorded (and set it as the employee&apos;s Device ID on their profile).
              </div>
              {unmapped.map((u) => (
                <div className={styles.holidayRow} key={`${u.deviceSerial}:${u.pin}`}>
                  <span><strong>PIN {u.pin}</strong> · {u.punchCount} punches · {u.deviceSerial}</span>
                  <span className={styles.rowActions}>
                    <select className={styles.input} value={mapPick[u.pin] ?? ''} onChange={(e) => setMapPick((m) => ({ ...m, [u.pin]: e.target.value }))} aria-label={`Assign PIN ${u.pin}`}>
                      <option value="">Assign to…</option>
                      {people.map((p) => (
                        <option key={p.userId} value={p.userId}>{p.fullName} — {p.email}</option>
                      ))}
                    </select>
                    <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={deviceBusy || !mapPick[u.pin]} onClick={() => doMapPin(u.pin)}>Assign</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
