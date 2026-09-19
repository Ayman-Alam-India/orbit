import type { Severity } from '@shared'
import styles from './SeverityBadge.module.css'

const LABELS: Record<Severity, string> = {
  1: 'Low',
  2: 'Guarded',
  3: 'Elevated',
  4: 'High',
  5: 'Critical',
}

/** Shows a value on the shared 1–5 severity scale, coloured by the --severity-N tokens. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={styles.badge} data-severity={severity}>
      {LABELS[severity]} · {severity}/5
    </span>
  )
}
