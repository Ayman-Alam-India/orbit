import type { CountryId, WeatherReport } from '@shared'
import { ApiClientError } from '../../api/client'
import { Loader, Panel } from '../../ui'
import { useCountryEvents } from '../country/useCountry'
import styles from './Weather.module.css'
import { useWeather } from './useWeather'

const DAY = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' })

/** Mosquito-borne diseases thrive in warm, wet weather: the conditions worth flagging next to them. */
const VECTOR_TAGS = ['vector-borne', 'dengue', 'west-nile', 'malaria', 'usutu']

function vectorNote(report: WeatherReport) {
  const avgMax = report.daily.reduce((s, d) => s + d.maxC, 0) / report.daily.length
  const rain = report.daily.reduce((s, d) => s + d.precipitationMm, 0)
  if (avgMax >= 25 && rain >= 10)
    return `Warm (avg high ${avgMax.toFixed(0)}°C) and wet (${rain.toFixed(0)} mm this week): conditions that favour mosquitoes.`
  if (avgMax >= 25)
    return `Warm week ahead (avg high ${avgMax.toFixed(0)}°C): mosquitoes stay active.`
  return undefined
}

/**
 * Live weather at the capital (Open-Meteo) with a 7-day outlook. When the country has a
 * mosquito-borne health signal, the card notes whether the weather favours it (ORBIT analysis).
 */
export function WeatherCard({ countryId }: { countryId: CountryId }) {
  const query = useWeather(countryId)
  const events = useCountryEvents(countryId)
  const vectorSignal = events.data?.find(
    (e) => e.kind === 'health' && e.tags.some((t) => VECTOR_TAGS.includes(t)),
  )

  return (
    <Panel eyebrow="Weather">
      {query.isPending && <Loader label="Loading weather" />}
      {query.isError && (
        <p className={styles.off}>
          {query.error instanceof ApiClientError && query.error.code === 'UPSTREAM'
            ? query.error.message
            : 'Weather is unavailable right now.'}
        </p>
      )}
      {query.isSuccess && (
        <div className={styles.weather}>
          <div className={styles.now}>
            <span className={styles.temp}>{Math.round(query.data.current.temperatureC)}°</span>
            <div>
              <p className={styles.desc}>{query.data.current.description}</p>
              <p className={styles.meta}>
                {query.data.place} · wind {Math.round(query.data.current.windKmh)} km/h ·{' '}
                {query.data.current.precipitationMm} mm rain now
              </p>
            </div>
          </div>
          <ol className={styles.days}>
            {query.data.daily.map((d) => (
              <li key={d.date} className={styles.day}>
                <span className={styles.dayName}>{DAY.format(new Date(d.date))}</span>
                <span className={styles.max}>{Math.round(d.maxC)}°</span>
                <span className={styles.min}>{Math.round(d.minC)}°</span>
                <span className={styles.rain} data-wet={d.precipitationMm >= 1}>
                  {d.precipitationMm >= 1 ? `${Math.round(d.precipitationMm)} mm` : '–'}
                </span>
              </li>
            ))}
          </ol>
          {vectorSignal && vectorNote(query.data) && (
            <p className={styles.note}>
              <span className={styles.badge}>ORBIT analysis</span> {vectorNote(query.data)} Relevant
              to: {vectorSignal.title}.
            </p>
          )}
          <p className={styles.source}>Open-Meteo · live forecast</p>
        </div>
      )}
    </Panel>
  )
}
