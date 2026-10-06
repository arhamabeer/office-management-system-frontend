'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LetterTemplateDTO, EmployeeProfileDTO } from '@ems/types';
import { lettersApi, employeesApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './letters.module.css';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

function todayLong(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'letter';
}

/** The reusable template content. */
type TemplateForm = {
  title: string;
  subject: string;
  salutation: string;
  body: string;
  signatoryName: string;
  signatoryTitle: string;
};

const EMPTY_TEMPLATE: TemplateForm = {
  title: '',
  subject: '',
  salutation: 'Dear Sir/Madam,',
  body: '',
  signatoryName: '',
  signatoryTitle: '',
};

/** Per-letter details supplied at download/email time (never saved). */
type LetterDetails = {
  reference: string;
  letterDate: string;
  recipientSel: string; // '' | employeeId | '__external__'
  recipientName: string;
  recipientEmail: string;
  recipientLines: string;
};

const EXTERNAL = '__external__';

function emptyDetails(): LetterDetails {
  return { reference: '', letterDate: todayLong(), recipientSel: '', recipientName: '', recipientEmail: '', recipientLines: '' };
}

function toForm(t: LetterTemplateDTO): TemplateForm {
  return {
    title: t.title ?? '',
    subject: t.subject ?? '',
    salutation: t.salutation ?? '',
    body: t.body ?? '',
    signatoryName: t.signatoryName ?? '',
    signatoryTitle: t.signatoryTitle ?? '',
  };
}

export default function LettersPage() {
  const { isOrgAdmin } = useAuth();
  const [templates, setTemplates] = useState<LetterTemplateDTO[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfileDTO[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>({ ...EMPTY_TEMPLATE });
  const [details, setDetails] = useState<LetterDetails>(emptyDetails());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tpls, emps] = await Promise.all([
        lettersApi.listTemplates(),
        employeesApi.list({ pageSize: 100 }),
      ]);
      setTemplates(tpls);
      setEmployees(emps.items);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOrgAdmin) void load();
    else setLoading(false);
  }, [isOrgAdmin, load]);

  const setF = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setD = <K extends keyof LetterDetails>(key: K, value: LetterDetails[K]) => setDetails((d) => ({ ...d, [key]: value }));

  const newTemplate = () => {
    setCurrentId(null);
    setForm({ ...EMPTY_TEMPLATE });
    setDetails(emptyDetails());
    setInfo(null);
    setError(null);
  };

  const openTemplate = (t: LetterTemplateDTO) => {
    setCurrentId(t.id);
    setForm(toForm(t));
    setInfo(null);
    setError(null);
  };

  // Recipient select → prefill name/email from the chosen employee.
  const onRecipientSel = (value: string) => {
    if (value === '' || value === EXTERNAL) {
      setDetails((d) => ({ ...d, recipientSel: value, recipientName: value === EXTERNAL ? '' : '', recipientEmail: '' }));
      return;
    }
    const emp = employees.find((e) => e.id === value);
    setDetails((d) => ({
      ...d,
      recipientSel: value,
      recipientName: emp?.fullName ?? '',
      recipientEmail: emp?.email ?? '',
    }));
  };

  const templateValid = form.title.trim() && form.subject.trim() && form.body.trim();

  const templatePayload = () => ({
    title: form.title.trim(),
    subject: form.subject.trim(),
    salutation: form.salutation.trim() || undefined,
    body: form.body.trim(),
    signatoryName: form.signatoryName.trim() || undefined,
    signatoryTitle: form.signatoryTitle.trim() || undefined,
  });

  const renderPayload = () => ({
    ...templatePayload(),
    reference: details.reference.trim() || undefined,
    letterDate: details.letterDate.trim() || undefined,
    recipientName: details.recipientName.trim() || undefined,
    recipientLines: details.recipientLines.trim() || undefined,
    recipientEmail: details.recipientEmail.trim() || undefined,
  });

  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!templateValid) {
      setError('Title, subject and body are required.');
      return;
    }
    setBusy(true);
    try {
      if (currentId) {
        const updated = await lettersApi.updateTemplate(currentId, templatePayload());
        setForm(toForm(updated));
        setInfo('Template saved.');
      } else {
        const created = await lettersApi.createTemplate(templatePayload());
        setCurrentId(created.id);
        setForm(toForm(created));
        setInfo('Template created.');
      }
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const removeTemplate = async () => {
    if (!currentId) return;
    if (!window.confirm('Delete this template? This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    try {
      await lettersApi.removeTemplate(currentId);
      newTemplate();
      await load();
      setInfo('Template deleted.');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setError(null);
    setInfo(null);
    if (!templateValid) {
      setError('Fill in the subject and body before downloading.');
      return;
    }
    setBusy(true);
    try {
      await lettersApi.render(renderPayload(), `${slug(form.title || form.subject)}.pdf`);
      setInfo('Letter downloaded.');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const sendEmail = async () => {
    setError(null);
    setInfo(null);
    if (!templateValid) {
      setError('Fill in the subject and body before sending.');
      return;
    }
    if (!details.recipientEmail.trim()) {
      setError('A recipient email is required to send the letter.');
      return;
    }
    setBusy(true);
    try {
      await lettersApi.email({ ...renderPayload(), recipientEmail: details.recipientEmail.trim() });
      setInfo(`Letter emailed to ${details.recipientEmail.trim()}.`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees],
  );

  if (!isOrgAdmin) {
    return (
      <>
        <div className={styles.header}>
          <h1 className={styles.title}>Letters</h1>
        </div>
        <div className={`${styles.banner} ${styles.bannerError}`}>Letters are available to Owners and Admins only.</div>
      </>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Letters</h1>
        <p className={styles.subtitle}>
          Keep reusable templates on the company letterhead. Open one, choose a recipient, then download a PDF or
          email it — the filled-in letter isn&apos;t saved, only the template.
        </p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      <div className={styles.layout}>
        <aside className={styles.listCol}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.fullBtn}`} onClick={newTemplate}>
            + New template
          </button>
          <div className={styles.listTitle}>Templates</div>
          {loading ? (
            <div className={styles.muted}>Loading…</div>
          ) : templates.length === 0 ? (
            <div className={styles.muted}>No templates yet.</div>
          ) : (
            <ul className={styles.list}>
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`${styles.listItem} ${currentId === t.id ? styles.listItemActive : ''}`}
                    onClick={() => openTemplate(t)}
                  >
                    <span className={styles.listItemTitle}>{t.title}</span>
                    <span className={styles.listItemMeta}>{t.subject}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className={styles.editor}>
          {/* ---- Template content ---- */}
          <form onSubmit={saveTemplate}>
            <div className={styles.sectionTitle}>{currentId ? 'Edit template' : 'New template'}</div>
            <div className={styles.grid}>
              <label className={`${styles.field} ${styles.full}`}>
                <span>Template name <span className={styles.req}>*</span> <span className={styles.hint}>(for your list — not printed)</span></span>
                <input className={styles.input} value={form.title} onChange={(e) => setF('title', e.target.value)} placeholder="Experience Letter" />
              </label>
              <label className={`${styles.field} ${styles.full}`}>
                <span>Subject <span className={styles.req}>*</span></span>
                <input className={styles.input} value={form.subject} onChange={(e) => setF('subject', e.target.value)} placeholder="To Whom It May Concern" />
              </label>
              <label className={styles.field}>
                <span>Salutation</span>
                <input className={styles.input} value={form.salutation} onChange={(e) => setF('salutation', e.target.value)} placeholder="Dear Sir/Madam," />
              </label>
              <label className={`${styles.field} ${styles.full}`}>
                <span>Body <span className={styles.req}>*</span> <span className={styles.hint}>(blank line = new paragraph; [placeholders] are fine)</span></span>
                <textarea className={styles.textarea} rows={11} value={form.body} onChange={(e) => setF('body', e.target.value)} placeholder="Write the letter here…" />
              </label>
              <label className={styles.field}>
                <span>Signatory name</span>
                <input className={styles.input} value={form.signatoryName} onChange={(e) => setF('signatoryName', e.target.value)} placeholder="Abdul Rafay" />
              </label>
              <label className={styles.field}>
                <span>Signatory title</span>
                <input className={styles.input} value={form.signatoryTitle} onChange={(e) => setF('signatoryTitle', e.target.value)} placeholder="Chief Executive Officer" />
              </label>
            </div>
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={busy}>
                {currentId ? 'Save template' : 'Create template'}
              </button>
              {currentId && (
                <button className={`${styles.btn} ${styles.btnDanger}`} type="button" onClick={removeTemplate} disabled={busy}>
                  Delete template
                </button>
              )}
            </div>
          </form>

          {/* ---- Recipient + delivery ---- */}
          <div className={styles.divider} />
          <div className={styles.sectionTitle}>Recipient &amp; delivery</div>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Recipient</span>
              <select className={styles.input} value={details.recipientSel} onChange={(e) => onRecipientSel(e.target.value)}>
                <option value="">Select a recipient…</option>
                <optgroup label="Employees">
                  {sortedEmployees.map((e) => (
                    <option key={e.id} value={e.id}>{e.fullName}{e.designation ? ` — ${e.designation}` : ''}</option>
                  ))}
                </optgroup>
                <option value={EXTERNAL}>External recipient…</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Date</span>
              <input className={styles.input} value={details.letterDate} onChange={(e) => setD('letterDate', e.target.value)} placeholder={todayLong()} />
            </label>

            {details.recipientSel !== '' && (
              <>
                <label className={styles.field}>
                  <span>Recipient name</span>
                  <input className={styles.input} value={details.recipientName} onChange={(e) => setD('recipientName', e.target.value)} placeholder="The Manager" />
                </label>
                <label className={styles.field}>
                  <span>Recipient email <span className={styles.hint}>(for sending)</span></span>
                  <input className={styles.input} type="email" value={details.recipientEmail} onChange={(e) => setD('recipientEmail', e.target.value)} placeholder="name@example.com" />
                </label>
                <label className={`${styles.field} ${styles.full}`}>
                  <span>Recipient address <span className={styles.hint}>(optional, one line each)</span></span>
                  <textarea className={styles.textarea} rows={3} value={details.recipientLines} onChange={(e) => setD('recipientLines', e.target.value)} placeholder={'Habib Bank Limited\nShahrah-e-Faisal Branch\nKarachi'} />
                </label>
              </>
            )}

            <label className={styles.field}>
              <span>Reference</span>
              <input className={styles.input} value={details.reference} onChange={(e) => setD('reference', e.target.value)} placeholder="BC/HR/2026/014" />
            </label>
          </div>

          <div className={styles.actions}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={download} disabled={busy}>
              Download PDF
            </button>
            <button className={styles.btn} type="button" onClick={sendEmail} disabled={busy || !details.recipientEmail.trim()}>
              Send email
            </button>
          </div>
          <p className={styles.muted}>Downloading and emailing use the current editor content — you can tweak the text for this recipient without changing the saved template.</p>
        </div>
      </div>
    </>
  );
}
