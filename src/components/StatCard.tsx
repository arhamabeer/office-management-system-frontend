import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './StatCard.module.css';

export default function StatCard({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  /** When set, the whole card becomes a link to this route. */
  href?: string;
}) {
  const body = (
    <>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.iconWrap}>{icon}</span>
      </div>
      <span className={styles.value}>{value}</span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${styles.card} ${styles.clickable}`}>
        {body}
      </Link>
    );
  }

  return <div className={styles.card}>{body}</div>;
}
