'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  SalaryStructureDTO,
  EmployeeSalaryRowDTO,
  PayslipDTO,
  PayrollRunDTO,
  PayrollSettingsDTO,
  TaxCertificateDTO,
} from '@ems/types';
import { payrollApi, fmtMoney } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './payroll.module.css';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
function statusBadge(s: string): string {
  if (s === 'Finalized') return styles.bFinalized;
  if (s === 'Paid') return styles.bPaid;
  return styles.bDraft;
}
function curMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type Tab = 'my' | 'salaries' | 'runs' | 'settings';

export default function PayrollPage() {
  const { user } = useAuth();
  const isOrgAdmin = !!user && (user.accountType === 'Owner' || user.orgRole === 'Admin');

  const [tab, setTab] = useState<Tab>('my');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [salary, setSalary] = useState<SalaryStructureDTO | null>(null);
  const [payslips, setPayslips] = useState<PayslipDTO[]>([]);
  const [cert, setCert] = useState<TaxCertificateDTO | null>(null);

  const [salaryRows, setSalaryRows] = useState<EmployeeSalaryRowDTO[]>([]);
  const [edits, setEdits] = useState<Record<string, { annualSalary: string; annualTax: string }>>({});
  const [savingRow, setSavingRow] = useState<string | null>(null);

  const [runs, setRuns] = useState<PayrollRunDTO[]>([]);
  const [runMonth, setRunMonth] = useState(curMonth());

  const [settings, setSettings] = useState<PayrollSettingsDTO | null>(null);

  const loadMy = useCallback(async () => {
    setError(null);
    try {
      const [s, p, c] = await Promise.all([
        payrollApi.salary(),
        payrollApi.payslips(),
        payrollApi.taxCertificate().catch(() => null),
      ]);
      setSalary(s);
      setPayslips(p);
      setCert(c);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  const loadSalaries = useCallback(async () => {
    setError(null);
    try {
      const rows = await payrollApi.salaries();
      setSalaryRows(rows);
      const init: Record<string, { annualSalary: string; annualTax: string }> = {};
      rows.forEach((r) => {
        init[r.userId] = {
          annualSalary: r.annualSalary != null ? String(r.annualSalary) : '',
          annualTax: r.annualTax != null ? String(r.annualTax) : '',
        };
      });
      setEdits(init);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setError(null);
    try {
      setRuns(await payrollApi.runs());
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setError(null);
    try {
      setSettings(await payrollApi.settings());
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    void loadMy();
  }, [loadMy]);
  useEffect(() => {
    if (tab === 'salaries') void loadSalaries();
    if (tab === 'runs') void loadRuns();
    if (tab === 'settings') void loadSettings();
  }, [tab, loadSalaries, loadRuns, loadSettings]);

  const saveRow = async (row: EmployeeSalaryRowDTO) => {
    const d = edits[row.userId];
    if (!d) return;
    const annualSalary = Number(d.annualSalary) || 0;
    const annualTax = Number(d.annualTax) || 0;
    if (annualTax > annualSalary) {
      setError(`Annual tax cannot exceed annual salary for ${row.fullName}.`);
      return;
    }
    setSavingRow(row.userId);
    setError(null);
    setInfo(null);
    try {
      await payrollApi.setSalary(row.userId, { currency: row.currency, annualSalary, annualTax });
      setInfo(`Salary saved for ${row.fullName}.`);
      await loadSalaries();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSavingRow(null);
    }
  };

  const runPayroll = async () => {
    setError(null);
    setInfo(null);
    try {
      const r = await payrollApi.run(runMonth);
      setInfo(`Payroll for ${runMonth}: ${r.payslipCount} payslips generated (Draft).`);
      await loadRuns();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const finalize = async (id: string) => {
    setError(null);
    try {
      await payrollApi.finalize(id);
      await loadRuns();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setError(null);
    try {
      setSettings(await payrollApi.updateSettings(settings));
      setInfo('Payroll settings saved.');
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const cur = salary?.currency ?? settings?.currency ?? 'PKR';
  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Payroll</h1>
        <p className={styles.subtitle}>Salary, payslips, and tax.</p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'my' ? styles.tabActive : ''}`} aria-pressed={tab === 'my'} onClick={() => setTab('my')}>My salary</button>
        {isOrgAdmin && <button className={`${styles.tab} ${tab === 'salaries' ? styles.tabActive : ''}`} aria-pressed={tab === 'salaries'} onClick={() => setTab('salaries')}>Salaries</button>}
        {isOrgAdmin && <button className={`${styles.tab} ${tab === 'runs' ? styles.tabActive : ''}`} aria-pressed={tab === 'runs'} onClick={() => setTab('runs')}>Payroll runs</button>}
        {isOrgAdmin && <button className={`${styles.tab} ${tab === 'settings' ? styles.tabActive : ''}`} aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>Settings</button>}
      </div>

      {tab === 'my' && (
        <>
          {salary ? (
            <>
              <div className={styles.tiles}>
                <div className={styles.tile}><div className={styles.tileLabel}>Annual salary</div><div className={styles.tileValue}>{fmtMoney(salary.annualSalary, cur)}</div></div>
                <div className={styles.tile}><div className={styles.tileLabel}>Annual tax</div><div className={styles.tileValue}>{fmtMoney(salary.annualTax, cur)}</div></div>
                <div className={`${styles.tile} ${styles.tileNet}`}><div className={styles.tileLabel}>Annual net</div><div className={styles.tileValue}>{fmtMoney(salary.annualNet, cur)}</div></div>
              </div>
              <div className={styles.tiles}>
                <div className={styles.tile}><div className={styles.tileLabel}>Monthly salary</div><div className={styles.tileValue}>{fmtMoney(salary.monthlySalary, cur)}</div></div>
                <div className={styles.tile}><div className={styles.tileLabel}>Monthly tax</div><div className={styles.tileValue}>{fmtMoney(salary.monthlyTax, cur)}</div></div>
                <div className={`${styles.tile} ${styles.tileNet}`}><div className={styles.tileLabel}>Monthly net</div><div className={styles.tileValue}>{fmtMoney(salary.monthlyNet, cur)}</div></div>
              </div>
            </>
          ) : (
            <div className={styles.card}>
              <div className={styles.muted}>
                Your salary structure hasn’t been set yet. Please contact your administrator.
              </div>
            </div>
          )}

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle} style={{ margin: 0 }}>Payslips</div>
              {cert && (
                <button className={styles.btn} onClick={() => payrollApi.taxCertificatePdf().catch((e) => setError(errMsg(e)))}>
                  Download tax certificate (TY {cert.taxYearLabel})
                </button>
              )}
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th scope="col">Month</th><th scope="col" className={styles.num}>Salary</th><th scope="col" className={styles.num}>Tax</th><th scope="col" className={styles.num}>Net</th><th scope="col">Status</th><th></th></tr></thead>
                <tbody>
                  {payslips.length ? payslips.map((p) => (
                    <tr key={p.id}>
                      <td>{p.month}</td>
                      <td className={styles.num}>{fmtMoney(p.grossMonthly, p.currency)}</td>
                      <td className={styles.num}>{fmtMoney(p.taxMonthly, p.currency)}</td>
                      <td className={styles.num}>{fmtMoney(p.netPay, p.currency)}</td>
                      <td><span className={`${styles.badge} ${statusBadge(p.status)}`}>{p.status}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => payrollApi.payslipPdf(p.id, p.month).catch((e) => setError(errMsg(e)))}>PDF</button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={6} className={styles.empty}>No payslips yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'salaries' && isOrgAdmin && (
        <>
        <div className={styles.toolbar}>
          <div style={{ flex: 1 }} />
          <button className={styles.btn} onClick={() => payrollApi.exportSalaries().catch((e) => setError(errMsg(e)))}>
            Export Excel
          </button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table} style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th scope="col">Employee</th>
                <th scope="col" className={styles.num}>Annual salary</th>
                <th scope="col" className={styles.num}>Annual tax</th>
                <th scope="col" className={styles.num}>Monthly salary</th>
                <th scope="col" className={styles.num}>Monthly net</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {salaryRows.length ? (
                salaryRows.map((r) => {
                  const d = edits[r.userId] ?? { annualSalary: '', annualTax: '' };
                  const aSal = Number(d.annualSalary) || 0;
                  const aTax = Number(d.annualTax) || 0;
                  return (
                    <tr key={r.userId}>
                      <td>
                        {r.fullName}
                        <div className={styles.muted}>{r.email}{r.status !== 'Active' ? ` · ${r.status}` : ''}</div>
                      </td>
                      <td className={styles.num}>
                        <input className={styles.input} type="number" min={0} style={{ maxWidth: 130 }} aria-label={`Annual salary for ${r.fullName}`} value={d.annualSalary} onChange={(e) => setEdits({ ...edits, [r.userId]: { ...d, annualSalary: e.target.value } })} />
                      </td>
                      <td className={styles.num}>
                        <input className={styles.input} type="number" min={0} style={{ maxWidth: 130 }} aria-label={`Annual tax for ${r.fullName}`} value={d.annualTax} onChange={(e) => setEdits({ ...edits, [r.userId]: { ...d, annualTax: e.target.value } })} />
                      </td>
                      <td className={styles.num}>{d.annualSalary ? fmtMoney(Math.round(aSal / 12), r.currency) : '—'}</td>
                      <td className={styles.num}>{d.annualSalary ? fmtMoney(Math.round((aSal - aTax) / 12), r.currency) : '—'}</td>
                      <td>
                        <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={savingRow === r.userId} onClick={() => saveRow(r)}>
                          {savingRow === r.userId ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={6} className={styles.empty}>No employees.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      {tab === 'runs' && isOrgAdmin && (
        <>
          <div className={styles.toolbar}>
            <input className={styles.input} type="month" aria-label="Payroll month" value={runMonth} onChange={(e) => setRunMonth(e.target.value)} />
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={runPayroll}>Run payroll</button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th scope="col">Month</th><th scope="col">Status</th><th scope="col" className={styles.num}>Payslips</th><th scope="col" className={styles.num}>Total net</th><th scope="col" className={styles.num}>Total tax</th><th></th></tr></thead>
              <tbody>
                {runs.length ? runs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.month}</td>
                    <td><span className={`${styles.badge} ${statusBadge(r.status)}`}>{r.status}</span></td>
                    <td className={styles.num}>{r.payslipCount}</td>
                    <td className={styles.num}>{fmtMoney(r.totalNet, cur)}</td>
                    <td className={styles.num}>{fmtMoney(r.totalTax, cur)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {r.status === 'Draft' && <button className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`} onClick={() => finalize(r.id)}>Finalize</button>}
                    </td>
                  </tr>
                )) : <tr><td colSpan={6} className={styles.empty}>No payroll runs yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'settings' && isOrgAdmin && settings && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Payroll settings</div>
          <div className={styles.formGrid}>
            <label className={styles.formField}>Country / label<input className={styles.input} value={settings.jurisdiction} onChange={(e) => setSettings({ ...settings, jurisdiction: e.target.value })} /></label>
            <label className={styles.formField}>Currency<input className={styles.input} value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} /></label>
            <label className={styles.formField}>Fiscal year start (month)<input className={styles.input} type="number" min={1} max={12} value={settings.fiscalYearStartMonth} onChange={(e) => setSettings({ ...settings, fiscalYearStartMonth: Number(e.target.value) })} /></label>
            <label className={styles.formField}>Tax year label<input className={styles.input} value={settings.taxYearLabel} onChange={(e) => setSettings({ ...settings, taxYearLabel: e.target.value })} /></label>
          </div>
          <div className={styles.muted}>The app does not calculate tax — each employee&apos;s annual tax is entered on the Salaries tab.</div>
          <div className={styles.formActions}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveSettings}>Save settings</button>
          </div>
        </div>
      )}
    </>
  );
}
