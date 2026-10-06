'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LetterDTO } from '@ems/types';
import { lettersApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './letters.module.css';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

type Form = {
  title: string;
  reference: string;
  letterDate: string;
  recipientName: string;
  recipientLines: string;
  salutation: string;
  subject: string;
  body: string;
  signatoryName: string;
  signatoryTitle: string;
};

const EMPTY: Form = {
  title: '',
  reference: '',
  letterDate: '',
  recipientName: '',
  recipientLines: '',
  salutation: 'Dear Sir/Madam,',
  subject: '',
  body: '',
  signatoryName: '',
  signatoryTitle: '',
};

function todayLong(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'letter';
}

/** Starter templates — just pre-filled text the admin edits. Nothing is enforced. */
type Template = { key: string; label: string; subject: string; salutation: string; body: string };

const TEMPLATES: Template[] = [
  {
    key: 'experience',
    label: 'Experience Letter',
    subject: 'To Whom It May Concern',
    salutation: 'To Whom It May Concern,',
    body:
      'This is to certify that [Employee Name] was employed with [Company] as [Designation] from [Start Date] to [End Date].\n\n' +
      'During this tenure, [he/she/they] was found to be sincere, hardworking and professional in all assigned responsibilities.\n\n' +
      'We wish [him/her/them] all the best in [his/her/their] future endeavours.',
  },
  {
    key: 'offer',
    label: 'Offer Letter',
    subject: 'Offer of Employment',
    salutation: 'Dear [Candidate Name],',
    body:
      'We are pleased to offer you the position of [Designation] at [Company]. Your expected date of joining is [Join Date].\n\n' +
      'Your gross monthly compensation will be [Amount], subject to the terms and policies of the company.\n\n' +
      'Please sign and return a copy of this letter as a token of your acceptance. We look forward to welcoming you to the team.',
  },
  {
    key: 'verification',
    label: 'Employment / Salary Verification',
    subject: 'Employment & Salary Verification',
    salutation: 'To Whom It May Concern,',
    body:
      'This is to confirm that [Employee Name] is currently employed with [Company] as [Designation] since [Start Date].\n\n' +
      '[His/Her/Their] current gross monthly salary is [Amount]. This letter is issued upon request for [purpose].\n\n' +
      'Should you require any further information, please feel free to contact us.',
  },
  {
    key: 'noc',
    label: 'No Objection Certificate',
    subject: 'No Objection Certificate',
    salutation: 'To Whom It May Concern,',
    body:
      'This is to certify that [Employee Name], holding the position of [Designation] at [Company], has no objection from the organisation for [purpose, e.g. applying for a visa].\n\n' +
      'This certificate is issued on [his/her/their] request and does not hold the company liable in any manner.',
  },
  {
    key: 'warning',
    label: 'Warning Letter',
    subject: 'Written Warning',
    salutation: 'Dear [Employee Name],',
    body:
      'This letter serves as a formal warning regarding [describe the issue, e.g. repeated late arrivals] observed on [date(s)].\n\n' +
      'Such conduct is not in line with company policy and is expected to be corrected with immediate effect. Any recurrence may lead to further disciplinary action.\n\n' +
      'You are advised to treat this matter with the seriousness it deserves.',
  },
  {
    key: 'appreciation',
    label: 'Appreciation Letter',
    subject: 'Letter of Appreciation',
    salutation: 'Dear [Employee Name],',
    body:
      'On behalf of [Company], I would like to express our sincere appreciation for your outstanding contribution to [project / achievement].\n\n' +
      'Your dedication and commitment have set a strong example for the team. Thank you for your continued hard work.\n\n' +
      'We look forward to your continued success with us.',
  },
];

function toForm(l: LetterDTO): Form {
  return {
    title: l.title ?? '',
    reference: l.reference ?? '',
    letterDate: l.letterDate ?? '',
    recipientName: l.recipientName ?? '',
    recipientLines: l.recipientLines ?? '',
    salutation: l.salutation ?? '',
    subject: l.subject ?? '',
    body: l.body ?? '',
    signatoryName: l.signatoryName ?? '',
    signatoryTitle: l.signatoryTitle ?? '',
  };
}

export default function LettersPage() {
  const { isOrgAdmin } = useAuth();
  const [letters, setLetters] = useState<LetterDTO[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ ...EMPTY, letterDate: todayLong() });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLetters(await lettersApi.list());
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

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const newLetter = () => {
    setCurrentId(null);
    setForm({ ...EMPTY, letterDate: todayLong() });
    setInfo(null);
    setError(null);
  };

  const openLetter = (l: LetterDTO) => {
    setCurrentId(l.id);
    setForm(toForm(l));
    setInfo(null);
    setError(null);
  };

  const applyTemplate = (key: string) => {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    setForm((f) => ({
      ...f,
      subject: t.subject,
      salutation: t.salutation,
      body: t.body,
      title: f.title.trim() || t.label,
    }));
  };

  const payload = () => ({
    title: form.title.trim(),
    reference: form.reference.trim() || undefined,
    letterDate: form.letterDate.trim() || undefined,
    recipientName: form.recipientName.trim() || undefined,
    recipientLines: form.recipientLines.trim() || undefined,
    salutation: form.salutation.trim() || undefined,
    subject: form.subject.trim(),
    body: form.body.trim(),
    signatoryName: form.signatoryName.trim() || undefined,
    signatoryTitle: form.signatoryTitle.trim() || undefined,
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!form.title.trim() || !form.subject.trim() || !form.body.trim()) {
      setError('Title, subject and body are required.');
      return;
    }
    setBusy(true);
    try {
      if (currentId) {
        const updated = await lettersApi.update(currentId, payload());
        setInfo('Letter saved.');
        setForm(toForm(updated));
      } else {
        const created = await lettersApi.create(payload());
        setCurrentId(created.id);
        setForm(toForm(created));
        setInfo('Letter created.');
      }
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!currentId) return;
    setError(null);
    try {
      await lettersApi.downloadPdf(currentId, `${slug(form.title)}.pdf`);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const remove = async () => {
    if (!currentId) return;
    if (!window.confirm('Delete this letter? This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    try {
      await lettersApi.remove(currentId);
      newLetter();
      await load();
      setInfo('Letter deleted.');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!isOrgAdmin) {
    return (
      <>
        <div className={styles.header}>
          <h1 className={styles.title}>Letters</h1>
        </div>
        <div className={`${styles.banner} ${styles.bannerError}`}>
          Letters are available to Owners and Admins only.
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Letters</h1>
        <p className={styles.subtitle}>
          Compose any letter on the company letterhead — experience letters, offers, verifications, and more.
          Save it and download a print-ready PDF.
        </p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      <div className={styles.layout}>
        <aside className={styles.listCol}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.full}`} onClick={newLetter}>
            + New letter
          </button>
          <div className={styles.listTitle}>Saved letters</div>
          {loading ? (
            <div className={styles.muted}>Loading…</div>
          ) : letters.length === 0 ? (
            <div className={styles.muted}>No letters yet.</div>
          ) : (
            <ul className={styles.list}>
              {letters.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={`${styles.listItem} ${currentId === l.id ? styles.listItemActive : ''}`}
                    onClick={() => openLetter(l)}
                  >
                    <span className={styles.listItemTitle}>{l.title}</span>
                    <span className={styles.listItemMeta}>{l.letterDate || new Date(l.updatedAt).toLocaleDateString('en-GB')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <form className={styles.editor} onSubmit={save}>
          <div className={styles.toolbar}>
            <label className={styles.tplField}>
              <span className={styles.tplLabel}>Start from a template</span>
              <select
                className={styles.input}
                value=""
                onChange={(e) => {
                  if (e.target.value) applyTemplate(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">Choose a template…</option>
                {TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.grid}>
            <label className={`${styles.field} ${styles.full}`}>
              <span>Title <span className={styles.req}>*</span> <span className={styles.hint}>(for your list only — not printed)</span></span>
              <input className={styles.input} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Experience Letter — Wasif Aleem" />
            </label>

            <label className={styles.field}>
              <span>Reference</span>
              <input className={styles.input} value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="BC/HR/2026/014" />
            </label>
            <label className={styles.field}>
              <span>Date</span>
              <input className={styles.input} value={form.letterDate} onChange={(e) => set('letterDate', e.target.value)} placeholder={todayLong()} />
            </label>

            <label className={styles.field}>
              <span>Recipient name</span>
              <input className={styles.input} value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} placeholder="The Manager" />
            </label>
            <label className={styles.field}>
              <span>Recipient address <span className={styles.hint}>(one line each)</span></span>
              <textarea className={styles.textarea} rows={3} value={form.recipientLines} onChange={(e) => set('recipientLines', e.target.value)} placeholder={'Habib Bank Limited\nShahrah-e-Faisal Branch\nKarachi'} />
            </label>

            <label className={`${styles.field} ${styles.full}`}>
              <span>Subject <span className={styles.req}>*</span></span>
              <input className={styles.input} value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="To Whom It May Concern" />
            </label>

            <label className={styles.field}>
              <span>Salutation</span>
              <input className={styles.input} value={form.salutation} onChange={(e) => set('salutation', e.target.value)} placeholder="Dear Sir/Madam," />
            </label>

            <label className={`${styles.field} ${styles.full}`}>
              <span>Body <span className={styles.req}>*</span> <span className={styles.hint}>(blank line = new paragraph)</span></span>
              <textarea className={styles.textarea} rows={12} value={form.body} onChange={(e) => set('body', e.target.value)} placeholder="Write the letter here…" />
            </label>

            <label className={styles.field}>
              <span>Signatory name</span>
              <input className={styles.input} value={form.signatoryName} onChange={(e) => set('signatoryName', e.target.value)} placeholder="Abdul Rafay" />
            </label>
            <label className={styles.field}>
              <span>Signatory title</span>
              <input className={styles.input} value={form.signatoryTitle} onChange={(e) => set('signatoryTitle', e.target.value)} placeholder="Chief Executive Officer" />
            </label>
          </div>

          <div className={styles.actions}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={busy}>
              {currentId ? 'Save changes' : 'Create letter'}
            </button>
            <button className={styles.btn} type="button" onClick={download} disabled={!currentId || busy}>
              Download PDF
            </button>
            {currentId && (
              <button className={`${styles.btn} ${styles.btnDanger}`} type="button" onClick={remove} disabled={busy}>
                Delete
              </button>
            )}
          </div>
          {!currentId && <p className={styles.muted}>Save the letter to enable the PDF download.</p>}
        </form>
      </div>
    </>
  );
}
