import { GLOBAL_SUBJECT_ID } from '@shared'
import { useCountries } from '../features/country/useCountry'
import { useEvents } from '../features/event/useEvents'
import { HealthSignalList } from '../features/health/HealthSignalList'
import { InsightCard } from '../features/insight/InsightCard'
import { NewsList } from '../features/news/NewsList'
import { RING_MIN_SEVERITY } from '../globe/globeStyle'
import { ErrorBoundary, Panel, StatTile } from '../ui'
import styles from './GlobalOverview.module.css'

/**
 * Route "/": the global view, in the right-hand column next to the globe (decision owner: Arham).
 * World status strip → ORBIT explains (global) → health signals → headlines.
 */
export function GlobalOverview() {
  const countries = useCountries()
  const events = useEvents()
  const count = (n?: number) => (n === undefined ? '–' : String(n))
  const severe = events.data?.filter((e) => e.severity >= RING_MIN_SEVERITY).length

  return (
    <>
      <Panel eyebrow="Global" title="World overview">
        <div className={styles.stats}>
          <StatTile label="Countries" value={count(countries.data?.length)} hint="monitored" />
          <StatTile label="Events" value={count(events.data?.length)} hint="tracked" />
          <StatTile label="Severe" value={count(severe)} hint="severity 4–5" />
        </div>
        <p className={styles.hint}>Select a country on the globe, or a marker to open an event.</p>
      </Panel>
      <ErrorBoundary title="Insight failed">
        <InsightCard subjectType="global" subjectId={GLOBAL_SUBJECT_ID} />
      </ErrorBoundary>
      <ErrorBoundary title="Health signals failed">
        <HealthSignalList limit={3} />
      </ErrorBoundary>
      <ErrorBoundary title="Headlines failed">
        <NewsList limit={5} />
      </ErrorBoundary>
    </>
  )
}
