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
            <div className={styles.band} />
            <div className={styles.body}>
              <div className={styles.main}>
                <Image className={styles.logo} src={card.brand.logo} alt={card.company.companyName} width={120} height={22} unoptimized priority />
                <div className={styles.name}>{card.employee.fullName}</div>
                {card.employee.designation && <div className={styles.role}>{card.employee.designation}</div>}
                {card.employee.department && <div className={styles.dept}>{card.employee.department}</div>}
                <div className={styles.divider} />
                <div className={styles.contact}>
                  <div className={styles.cRow}><span className={styles.cLabel}>Email</span><span className={styles.cVal}>{card.employee.email}</span></div>
                  {(card.employee.phone || card.company.phone) && <div className={styles.cRow}><span className={styles.cLabel}>Phone</span><span className={styles.cVal}>{card.employee.phone ?? card.company.phone}</span></div>}
                  {card.employee.employeeCode && <div className={styles.cRow}><span className={styles.cLabel}>ID</span><span className={styles.cVal}>{card.employee.employeeCode}</span></div>}
                </div>
                <div className={styles.companyLine}>
                  {card.company.companyName}
                  {card.company.website ? ` · ${card.company.website}` : ''}
                  {card.company.address ? ` · ${card.company.address}` : ''}
                </div>
              </div>
              <div className={styles.qrBox}>
                <img className={styles.qr} src={card.qrDataUrl} alt="Contact QR code" />
                <div className={styles.qrCap}>Scan to save my contact</div>
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
