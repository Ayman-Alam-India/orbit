import { useParams } from 'react-router-dom'
import { ErrorBoundary, Panel, QueryState } from '../../ui'
import { InsightCard } from '../insight/InsightCard'
import { MarketsPanel } from '../markets/MarketsPanel'
import { useMarkets } from '../markets/useMarkets'
import { RipplePanel } from '../ripple/RippleList'
import { WeatherCard } from '../weather/WeatherCard'
import { NewsList } from '../news/NewsList'
import { TimelineList } from '../timeline/TimelineList'
import { CountryEvents } from './CountryEvents'
import { CountryHero } from './CountryHero'
import { useCountry, useCountryEvents } from './useCountry'

/**
 * Route /country/:countryId (decision owner: Ayman).
 * Hero + stat strip, then Weather → Events → Ripple effects → Markets → ORBIT explains → Timeline → Headlines.
 */
export function CountryPanel() {
  const { countryId = '' } = useParams()
  const country = useCountry(countryId)
  const events = useCountryEvents(countryId)
  const markets = useMarkets(countryId)

  return (
    <>
      <QueryState query={country} label="country">
        {(c) => <CountryHero country={c} />}
      </QueryState>
      {country.isSuccess && (
        <>
          <ErrorBoundary title="Weather failed">
            <WeatherCard countryId={countryId} />
          </ErrorBoundary>
          <ErrorBoundary title="Events failed">
            <Panel eyebrow="Events">
              <QueryState query={events} label="events">
                {(list) => <CountryEvents countryId={countryId} events={list} />}
              </QueryState>
            </Panel>
          </ErrorBoundary>
          <ErrorBoundary title="Ripple effects failed">
            <RipplePanel countryId={countryId} />
          </ErrorBoundary>
          {Boolean(markets.data?.length) && (
            <ErrorBoundary title="Markets failed">
              <MarketsPanel countryId={countryId} />
            </ErrorBoundary>
          )}
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
