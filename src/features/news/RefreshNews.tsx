import type { CountryId } from '@shared'
import { useEffect, useState } from 'react'
import { Button } from '../../ui'
import styles from './RefreshNews.module.css'
import { updatedAgo } from './updatedAgo'
import { useDataMode, useRefreshNews } from './useNews'

/**
 * The ↻ button in the Headlines panel header (decisions: Shrey). Disabled in DATA_MODE=mock,
 * spins while GDELT answers, then shows "Updated X ago" or a fallback message.
 */
export function RefreshNews({ countryId }: { countryId?: CountryId }) {
  const dataMode = useDataMode()
  const refresh = useRefreshNews(countryId)
  const [now, setNow] = useState(() => Date.now())
  const result = refresh.data
  const live = dataMode.data === 'live'

  // Keep "Updated X ago" current while it is on screen.
  useEffect(() => {
    if (!result?.refreshed) return
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [result])

  // A new country starts without a status line.
  const { reset } = refresh
  useEffect(() => reset(), [countryId, reset])

  const failed = refresh.isError || (result && !result.refreshed)
  const status = refresh.isPending
    ? 'Refreshing…'
    : failed
      ? "Couldn't refresh, showing saved headlines"
      : result?.fetchedAt
        ? `Updated ${updatedAgo(result.fetchedAt, now)}`
        : undefined
  const label = live ? 'Refresh headlines' : 'Live news is off (mock mode)'

  return (
    <div className={styles.wrap}>
      {status && (
        <span
          className={failed ? `${styles.status} ${styles.failed}` : styles.status}
          role="status"
        >
          {status}
        </span>
      )}
      {/* A disabled button shows no tooltip in some browsers, so the wrapper carries it. */}
      <span title={label}>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={label}
          disabled={!live || refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          <span
            aria-hidden
            className={refresh.isPending ? `${styles.icon} ${styles.spin}` : styles.icon}
          >
            ↻
          </span>
        </Button>
      </span>
    </div>
  )
}
