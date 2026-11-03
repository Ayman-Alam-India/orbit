import type { Trust } from '@shared'
import { formatDate } from '../event/format'
import { recentAgo, useNow } from '../news/updatedAgo'
import styles from './HowWeKnow.module.css'

const VERDICT: Record<string, string> = {
  supported: 'supports it',
  unsupported: "can't confirm it",
  contradicted: 'contradicts it',
}
const MODEL: Record<string, string> = { gemini: 'Gemini', groq: 'Groq', rules: 'Rule checker' }

/**
 * "How we know": the evidence behind a trust badge. Which outlets reported it (established ones
 * marked, syndicated copies labelled), and what each AI checker concluded. Collapsed by default.
 */
export function HowWeKnow({ trust }: { trust?: Trust }) {
  const now = useNow()
  if (!trust || trust.status === 'verified') return null
  const evidence = trust.evidence ?? []
  const checks = trust.checks ?? []
  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>How we know</summary>
      <p className={styles.reason}>{trust.reason}</p>
      {evidence.length > 0 && (
        <ul className={styles.reports} aria-label="Reports behind this rating">
          {evidence.map((e) => (
            <li key={e.url} data-copy={Boolean(e.copyOf)}>
              <span className={styles.outlet}>
                {e.publisher}
                {e.established && <span className={styles.established}>Established</span>}
                {e.copyOf && <span className={styles.copy}>Copy of {e.copyOf}, not counted</span>}
              </span>
              <a href={e.url} target="_blank" rel="noreferrer">
                {e.title}
              </a>
              <span className={styles.when}>
                {recentAgo(e.publishedAt, now) ?? formatDate(e.publishedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.heading}>AI checks</p>
      {checks.length ? (
        <ul className={styles.checks}>
          {checks.map((c) => (
            <li key={c.model} data-verdict={c.verdict}>
              <strong>{MODEL[c.model] ?? c.model}</strong> {VERDICT[c.verdict] ?? c.verdict}:{' '}
              {c.reason}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>
          {trust.aiCheck === 'unavailable'
            ? 'Not run: the AI checkers only look at stories that 3+ independent outlets report, or when you press Verify now.'
            : `The AI checkers ${trust.aiCheck === 'agree' ? 'agree' : 'disagree'}.`}
        </p>
      )}
    </details>
  )
}
