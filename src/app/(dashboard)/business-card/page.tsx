'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import type { BusinessCardDTO, CompanyProfileDTO } from '@ems/types';
import { businessCardApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './business-card.module.css';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

const emptyCompany = { companyName: '', website: '', address: '', phone: '', tagline: '' };

function MailIcon() {
  return (
    <svg className={styles.cIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className={styles.cIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5a1 1 0 0 1 1-1h2.2a1 1 0 0 1 1 .75l.8 3a1 1 0 0 1-.28 1L7.6 10.4a12 12 0 0 0 6 6l1.65-1.12a1 1 0 0 1 1-.28l3 .8a1 1 0 0 1 .75 1V19a1 1 0 0 1-1 1A15 15 0 0 1 4 5Z" />
    </svg>
  );
}

export default function BusinessCardPage() {
  const { isOrgAdmin } = useAuth();
  const [card, setCard] = useState<BusinessCardDTO | null>(null);
  const [company, setCompany] = useState({ ...emptyCompany });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await businessCardApi.myCard();
      setCard(c);
      if (isOrgAdmin) {
        const cp = await businessCardApi.company();
        setCompany({
          companyName: cp.companyName ?? '',
          website: cp.website ?? '',
          address: cp.address ?? '',
          phone: cp.phone ?? '',
          tagline: cp.tagline ?? '',
        });
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [isOrgAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const saveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const body: Partial<CompanyProfileDTO> = {
        companyName: company.companyName.trim(),
        website: company.website.trim(),
        address: company.address.trim(),
        phone: company.phone.trim(),
        tagline: company.tagline.trim(),
      };
      await businessCardApi.updateCompany(body);
      setInfo('Company details updated — they appear on every card.');
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const companyMeta = card
    ? [card.company.website, card.company.address].filter(Boolean).join(' · ') || card.company.companyName
    : '';

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Business Card</h1>
        <p className={styles.subtitle}>Your digital business card — share it by QR, save it to contacts, or download a PDF.</p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      {loading || !card ? (
        <div className={styles.subtitle}>Loading…</div>
      ) : (
        <div className={styles.wrap}>
          <div className={styles.card}>
            <span className={styles.spine} aria-hidden="true" />
            <div className={styles.inner}>
              <div className={styles.identity}>
                <Image className={styles.logo} src={card.brand.logo} alt={card.company.companyName} width={180} height={26} unoptimized priority />
                <div className={styles.nameBlock}>
                  <div className={styles.name}>{card.employee.fullName}</div>
                  {card.employee.designation && <div className={styles.role}>{card.employee.designation}</div>}
                  {card.employee.department && <div className={styles.dept}>{card.employee.department}</div>}
                </div>
                <div className={styles.rule} />
                <div className={styles.contact}>
                  <div className={styles.cRow}><MailIcon /><span className={styles.cVal}>{card.employee.email}</span></div>
                  {(card.employee.phone || card.company.phone) && (
                    <div className={styles.cRow}><PhoneIcon /><span className={styles.cVal}>{card.employee.phone ?? card.company.phone}</span></div>
                  )}
                </div>
                {companyMeta && <div className={styles.footer}>{companyMeta}</div>}
              </div>
              <div className={styles.qrZone}>
                <div className={styles.qrPanel}>
                  <img className={styles.qr} src={card.qrDataUrl} alt="Contact QR code" />
                </div>
                <div className={styles.qrCap}>Scan to save contact</div>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => download(businessCardApi.downloadVcard)}>Save contact (.vcf)</button>
            <button className={styles.btn} onClick={() => download(businessCardApi.downloadPdf)}>Download PDF</button>
          </div>
        </div>
      )}

      {isOrgAdmin && !loading && (
        <form className={styles.adminCard} onSubmit={saveCompany}>
          <div className={styles.cardTitle}>Company details</div>
          <div className={styles.formGrid}>
            <label className={styles.formField}>Company name<input className={styles.input} value={company.companyName} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} /></label>
            <label className={styles.formField}>Website<input className={styles.input} value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} /></label>
            <label className={styles.formField}>Phone<input className={styles.input} value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></label>
            <label className={styles.formField}>Address<input className={styles.input} value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></label>
            <label className={`${styles.formField} ${styles.full}`}>Tagline<input className={styles.input} value={company.tagline} onChange={(e) => setCompany({ ...company, tagline: e.target.value })} /></label>
          </div>
          <div className={styles.formActions}><button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={busy}>Save company details</button></div>
        </form>
      )}
    </>
  );
}
