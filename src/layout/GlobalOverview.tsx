import { GLOBAL_SUBJECT_ID } from '@shared'
import { HealthSignalList } from '../features/health/HealthSignalList'
import { InsightCard } from '../features/insight/InsightCard'
import { NewsList } from '../features/news/NewsList'
import { ErrorBoundary, Panel } from '../ui'

/** PLACEHOLDER (owner: Arham). Route "/": the global view before any country is picked. */
export function GlobalOverview() {
  return (
    <>
      <Panel eyebrow="Global" title="World overview">
        <p>Select a country on the globe, or a marker to open an event.</p>
      </Panel>
      <ErrorBoundary title="Insight failed">
        <InsightCard subjectType="global" subjectId={GLOBAL_SUBJECT_ID} />
      </ErrorBoundary>
      <ErrorBoundary title="Health signals failed">
        <HealthSignalList />
      </ErrorBoundary>
      <ErrorBoundary title="Headlines failed">
        <NewsList />
      </ErrorBoundary>
    </>
  )
}
