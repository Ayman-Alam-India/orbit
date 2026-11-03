import { Link } from 'react-router-dom'
import { paths } from '../../routes'
import { Button, ItemList, Panel, QueryState, SeverityBadge, TrustBadge } from '../../ui'
import styles from './DetectedEvents.module.css'
import { formatDate } from './format'
import { useAutoEvents } from './useEvents'
import { useScanEvents } from './useScanEvents'

/**
 * Events ORBIT found on its own in the live news feed (decision owner: Shrey).
 * They are kept apart from the curated ones and carry ORBIT's trust label (verified for WHO,
 * corroborated or unverified for headline-detected events). "Scan now" runs a detection pass while you watch.
 */
export function DetectedEvents({ limit = 4 }: { limit?: number }) {
  const query = useAutoEvents()
  const scan = useScanEvents()

  return (
    <Panel
      eyebrow="Detected by ORBIT"
      actions={
        <Button size="sm" variant="ghost" disabled={scan.isPending} onClick={() => scan.mutate()}>
          {scan.isPending ? 'Scanning…' : 'Scan now'}
        </Button>
      }
    >
      <p className={styles.note}>
        Found automatically in live headlines and WHO outbreak reports. Each is rated by one rule: ✓
        verified (official source), ◑ corroborated (3+ outlets and the AI checkers agree), ○
        unverified.
      </p>
      <QueryState query={query} label="detected events">
        {(events) => (
          <ItemList
            items={events.slice(0, limit)}
            getKey={(e) => e.id}
            empty={
              scan.isPending
                ? 'Scanning the live feed…'
                : 'Nothing new detected. Live data mode must be on.'
            }
            renderItem={(e) => (
              <div className={styles.row}>
                <div className={styles.head}>
                  <SeverityBadge severity={e.severity} />
                  {e.trust ? (
                    <TrustBadge trust={e.trust} />
                  ) : (
                    <span className={styles.flag}>Unverified</span>
                  )}
                  <span className={styles.date}>{formatDate(e.occurredAt)}</span>
                </div>
                <Link to={paths.event(e.countryIds[0], e.id)} className={styles.title}>
                  {e.title}
                </Link>
              </div>
            )}
          />
        )}
      </QueryState>
    </Panel>
  )
}
