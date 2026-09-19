import styles from './Loader.module.css'

/** Standard loading state. Every query shows this (or a skeleton) while loading. */
export function Loader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className={styles.loader} role="status">
      <span className={styles.pulse} aria-hidden />
      <span>{label}…</span>
    </div>
  )
}
