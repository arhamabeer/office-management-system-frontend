import type { ReactNode } from 'react';
import styles from './StatCard.module.css';

export default function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.iconWrap}>{icon}</span>
      </div>
      <span className={styles.value}>{value}</span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}
