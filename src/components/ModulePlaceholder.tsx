import styles from './ModulePlaceholder.module.css';

export default function ModulePlaceholder({
  title,
  milestone,
  description,
}: {
  title: string;
  milestone: string;
  description: string;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.badge}>{milestone}</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{description}</p>
      </div>
    </div>
  );
}
