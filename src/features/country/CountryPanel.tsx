import { Link, useParams } from 'react-router-dom'
import { paths } from '../../routes'
import { ErrorBoundary, ItemList, Panel, QueryState, SeverityBadge } from '../../ui'
import { InsightCard } from '../insight/InsightCard'
import { NewsList } from '../news/NewsList'
import { TimelineList } from '../timeline/TimelineList'
import { useCountry, useCountryEvents } from './useCountry'

/** PLACEHOLDER (owner: Ayman). Route /country/:countryId. */
export function CountryPanel() {
  const { countryId = '' } = useParams()
  const country = useCountry(countryId)
  const events = useCountryEvents(countryId)

  return (
    <>
      <Panel
        eyebrow="Country"
        title={country.data?.name ?? countryId}
        actions={<Link to={paths.global()}>Globe</Link>}
      >
        <QueryState query={country} label="country">
          {(c) => (
            <>
              <p>{c.summary}</p>
              <SeverityBadge severity={c.riskLevel} />
            </>
          )}
        </QueryState>
      </Panel>
      <Panel eyebrow="Events">
        <QueryState query={events} label="events">
          {(list) => (
            <ItemList
              items={list}
              getKey={(e) => e.id}
              empty="No tracked events for this country."
              renderItem={(e) => (
                <Link to={paths.event(countryId, e.id)}>
                  {e.title} <SeverityBadge severity={e.severity} />
                </Link>
              )}
            />
          )}
        </QueryState>
      </Panel>
      <ErrorBoundary title="Insight failed">
        <InsightCard subjectType="country" subjectId={countryId} />
      </ErrorBoundary>
      <ErrorBoundary title="Timeline failed">
        <TimelineList countryId={countryId} />
      </ErrorBoundary>
      <ErrorBoundary title="Headlines failed">
        <NewsList countryId={countryId} />
      </ErrorBoundary>
    </>
  )
}
