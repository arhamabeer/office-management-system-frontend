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
function stripProto(url?: string): string {
  return (url ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

const emptyCompany = { companyName: '', website: '', email: '', address: '', phone: '', tagline: '' };

function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.cRow}>
      <span className={styles.cLabel}>{label}</span>
      <span className={styles.cColon}>:</span>
      <span className={styles.cVal}>{value}</span>
    </div>
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
          email: cp.email ?? '',
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
        email: company.email.trim(),
        address: company.address.trim(),
        phone: company.phone.trim(),
        tagline: company.tagline.trim(),
      };
      await businessCardApi.updateCompany(body);
      setInfo('Company details updated — they appear on every card and document.');
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
        <p className={styles.subtitle}>Your digital business card. Download a print-ready PDF (front &amp; back) or save it to contacts.</p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      {loading || !card ? (
        <div className={styles.subtitle}>Loading…</div>
      ) : (
        <div className={styles.wrap}>
          <div className={styles.cards}>
            <figure className={styles.fig}>
              <div className={styles.frontCard}>
                <span className={styles.edge} aria-hidden="true" />
                <div className={styles.inner}>
                  <div className={styles.logoCol}>
                    <Image className={styles.logo} src={card.brand.logo} alt={card.company.companyName} width={220} height={54} unoptimized priority />
                    {card.qrDataUrl && (
                      <div className={styles.qrZone}>
                        <div className={styles.qrPanel}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className={styles.qr} src={card.qrDataUrl} alt="Scan to save contact" />
                        </div>
                        <div className={styles.qrCap}>Scan to save contact</div>
                      </div>
                    )}
                  </div>
                  <div className={styles.details}>
                    <div className={styles.name}>{card.employee.fullName}</div>
                    {card.employee.designation && <div className={styles.role}>{card.employee.designation}</div>}
                    {card.company.address && (
                      <div className={styles.address}>
                        {card.company.address.split(',').map((ln, i) => (
                          <div key={i}>{ln.trim()}</div>
                        ))}
                      </div>
                    )}
                    <div className={styles.contact}>
                      {card.company.phone && <ContactRow label="Phone" value={card.company.phone} />}
                      {card.employee.phone && <ContactRow label="Mobile" value={card.employee.phone} />}
                      <ContactRow label="Email" value={card.employee.email} />
                      {card.company.website && <ContactRow label="Web" value={stripProto(card.company.website)} />}
                    </div>
                  </div>
                </div>
              </div>
              <figcaption className={styles.cap}>Front</figcaption>
            </figure>

            <figure className={styles.fig}>
              <div className={styles.backCard}>
                <div className={styles.backInner}>
                  <Image className={styles.backLogo} src={card.brand.logo} alt={card.company.companyName} width={200} height={49} unoptimized />
                  {card.company.tagline && <div className={styles.backTagline}>{card.company.tagline}</div>}
                  <div className={styles.backContacts}>
                    {card.company.website && <span>{stripProto(card.company.website)}</span>}
                    {card.company.email && <span>{card.company.email}</span>}
                    {card.company.phone && <span>{card.company.phone}</span>}
                    {card.company.address && <span>{card.company.address}</span>}
                  </div>
                </div>
              </div>
              <figcaption className={styles.cap}>Back</figcaption>
            </figure>
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
          <p className={styles.subtitle} style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>
            Shown on every employee&apos;s business card and on document letterheads (payslips, certificates, reports).
          </p>
          <div className={styles.formGrid}>
            <label className={styles.formField}>Company name<input className={styles.input} value={company.companyName} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} /></label>
            <label className={styles.formField}>Website<input className={styles.input} value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} /></label>
            <label className={styles.formField}>Email<input className={styles.input} value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} placeholder="info@braincrop.io" /></label>
            <label className={styles.formField}>Phone<input className={styles.input} value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></label>
            <label className={`${styles.formField} ${styles.full}`}>Address<input className={styles.input} value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></label>
            <label className={`${styles.formField} ${styles.full}`}>Tagline<input className={styles.input} value={company.tagline} onChange={(e) => setCompany({ ...company, tagline: e.target.value })} /></label>
          </div>
          <div className={styles.formActions}><button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={busy}>Save company details</button></div>
        </form>
      )}
    </>
  );
}
