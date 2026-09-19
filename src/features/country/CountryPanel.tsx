import { useParams } from 'react-router-dom'
import { ErrorBoundary, Panel, QueryState } from '../../ui'
import { InsightCard } from '../insight/InsightCard'
import { NewsList } from '../news/NewsList'
import { TimelineList } from '../timeline/TimelineList'
import { CountryEvents } from './CountryEvents'
import { CountryHero } from './CountryHero'
import { useCountry, useCountryEvents } from './useCountry'

/**
 * Route /country/:countryId (decision owner: Ayman).
 * Hero + stat strip, then Events → ORBIT explains → Timeline → Headlines.
 */
export function CountryPanel() {
  const { countryId = '' } = useParams()
  const country = useCountry(countryId)
  const events = useCountryEvents(countryId)

  return (
    <>
      <QueryState query={country} label="country">
        {(c) => <CountryHero country={c} />}
      </QueryState>
      {country.isSuccess && (
        <>
          <ErrorBoundary title="Events failed">
            <Panel eyebrow="Events">
              <QueryState query={events} label="events">
                {(list) => <CountryEvents countryId={countryId} events={list} />}
              </QueryState>
            </Panel>
          </ErrorBoundary>
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
      )}
    </>
  )
}
