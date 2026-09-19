import { useParams } from 'react-router-dom'
import { ErrorBoundary, QueryState } from '../../ui'
import { InsightCard } from '../insight/InsightCard'
import { EventBriefing } from './EventBriefing'
import { RelatedHeadlines } from './RelatedHeadlines'
import { useEvent } from './useEvents'

/**
 * Route /country/:countryId/event/:eventId (decision owner: Ayman).
 * Briefing card → ORBIT explains → related headlines.
 */
export function EventPanel() {
  const { countryId = '', eventId = '' } = useParams()
  const event = useEvent(eventId)

  return (
    <QueryState query={event} label="event">
      {(e) => (
        <>
          <EventBriefing event={e} countryId={countryId} />
          <ErrorBoundary title="Insight failed">
            <InsightCard subjectType="event" subjectId={e.id} />
          </ErrorBoundary>
          <ErrorBoundary title="Headlines failed">
            <RelatedHeadlines countryId={countryId} eventId={e.id} />
          </ErrorBoundary>
        </>
      )}
    </QueryState>
  )
}
