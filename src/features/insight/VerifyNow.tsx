import type { Trust, TrustCheckRequest } from '@shared'
import { Button, TrustBadge } from '../../ui'
import { HowWeKnow } from './HowWeKnow'
import styles from './VerifyNow.module.css'
import { useVerifyNow } from './useVerifyNow'

/**
 * The badge, plus a "Verify now" button while the item is unverified. With `explain`, the "How we
 * know" panel (reports and AI checks) follows, updated after Verify now.
 */
export function TrustWithVerify({
  trust,
  request,
  compact = false,
  explain = false,
}: {
  trust?: Trust
  request: TrustCheckRequest
  compact?: boolean
  explain?: boolean
}) {
  const verify = useVerifyNow()
  const result = verify.data
  const shown = result ?? trust
  if (!shown) return null
  const badge = (
    <span className={styles.wrap}>
      <TrustBadge trust={shown} compact={compact} />
      {shown.status === 'unverified' && !result && (
        <Button
          size="sm"
          variant="ghost"
          disabled={verify.isPending}
          onClick={(e) => {
            // Rows are often links: verifying must not open them.
            e.preventDefault()
            e.stopPropagation()
            verify.mutate(request)
          }}
        >
          {verify.isPending ? 'Verifying…' : 'Verify now'}
        </Button>
      )}
      {result && (
        <span className={styles.result} role="status">
          {result.reason}
        </span>
      )}
      {verify.isError && (
        <span className={styles.result} role="status">
          Couldn't verify right now.
        </span>
      )}
    </span>
  )
  if (!explain) return badge
  return (
    <div className={styles.explained}>
      {badge}
      <HowWeKnow trust={shown} />
    </div>
  )
}
