import type { ReactNode } from 'react'
import styles from './StatTile.module.css'

type StatTileProps = {
  /** Short uppercase label, e.g. "Capital". */
  label: string
  value: ReactNode
  /** Optional small line under the value, e.g. a unit. */
  hint?: ReactNode
  /** Smaller value text, for words rather than figures (e.g. a list of actors). */
  compact?: boolean
}

/** One labelled figure. Put several in a row for a stat strip. */
export function StatTile({ label, value, hint, compact = false }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <span className={compact ? `${styles.value} ${styles.compact}` : styles.value}>{value}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
