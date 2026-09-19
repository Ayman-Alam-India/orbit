import { Link, useParams } from 'react-router-dom'
import { paths } from '../../routes'
import { ErrorBoundary, Panel, QueryState, SeverityBadge } from '../../ui'
import { InsightCard } from '../insight/InsightCard'
import { useEvent } from './useEvents'

/** PLACEHOLDER (owner: Ayman). Route /country/:countryId/event/:eventId. */
export function EventPanel() {
  const { countryId = '', eventId = '' } = useParams()
  const event = useEvent(eventId)

  return (
    <>
      <Panel
        eyebrow={event.data?.kind === 'health' ? 'Health signal' : 'Event'}
        title={event.data?.title ?? eventId}
        actions={<Link to={paths.country(countryId)}>Back to country</Link>}
      >
        <QueryState query={event} label="event">
          {(e) => (
            <>
              <p>{e.summary}</p>
              <SeverityBadge severity={e.severity} />
              {e.kind === 'health' && e.metric && (
                <p>
                  {e.indicator}: {e.metric.value.toLocaleString()} {e.metric.unit}
                </p>
              )}
              {e.kind === 'geopolitical' && <p>Actors: {e.actors.join(', ')}</p>}
            </>
          )}
        </QueryState>
      </Panel>
      <ErrorBoundary title="Insight failed">
        <InsightCard subjectType="event" subjectId={eventId} />
      </ErrorBoundary>
    </>
  )
}
