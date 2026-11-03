import type { Trust } from '@shared'
import { TRUST_LABEL } from './trustLabel'
import styles from './TrustBadge.module.css'

/**
 * ORBIT's one verification label, the same on headlines, events and ripples. The tooltip says why
 * ("Reported by 5 outlets; the AI checkers agree.").
 */
export function TrustBadge({ trust, compact = false }: { trust?: Trust; compact?: boolean }) {
  if (!trust) return null
  const { icon, label } = TRUST_LABEL[trust.status]
  return (
    <span
      className={styles.badge}
      data-status={trust.status}
      title={`${label}: ${trust.reason}`}
      aria-label={`${label}: ${trust.reason}`}
    >
      <span aria-hidden>{icon}</span>
      {!compact && <span>{label}</span>}
    </span>
  )
}
