import type { OrbitEvent } from '@shared'
import { Link } from 'react-router-dom'
import { paths } from '../../routes'
import { SeverityBadge, StatTile, Tag } from '../../ui'
import { useCountries } from '../country/useCountry'
import { countryNames, formatDate, shortSourceName } from './format'
import styles from './EventView.module.css'
import { useSources } from './useSources'

/** The briefing card: kind + severity, title, when/where, summary, key facts. */
export function EventBriefing({ event, countryId }: { event: OrbitEvent; countryId: string }) {
  const countries = useCountries()
  const sources = useSources()
  const sourceList = (sources.data ?? []).filter((s) => event.sourceIds.includes(s.id))

  return (
    <section className={styles.briefing}>
      <div className={styles.top}>
        <span className={styles.badges}>
          <Tag kind={event.kind}>{event.kind === 'health' ? 'Health signal' : 'Geopolitical'}</Tag>
          <SeverityBadge severity={event.severity} />
          {event.origin === 'auto' && (
            <span className={styles.autoFlag}>Auto-detected · unverified</span>
          )}
        </span>
        <Link to={paths.country(countryId)} className={styles.back}>
          ← Back to country
        </Link>
      </div>
      <h1 className={styles.title}>{event.title}</h1>
      <p className={styles.whenWhere}>
        {formatDate(event.occurredAt)} · {countryNames(event.countryIds, countries.data)}
      </p>
      <p className={styles.summary}>{event.summary}</p>

      <div className={styles.facts}>
        <p className={styles.factsLabel}>Key facts</p>
        <div className={styles.factGrid}>
          {event.kind === 'health' ? (
            <StatTile
              label={event.indicator}
              value={event.metric ? event.metric.value.toLocaleString('en') : 'No figure yet'}
              hint={event.metric?.unit}
            />
          ) : (
            <>
              <StatTile label="Category" value={event.category} compact />
              <StatTile
                compact
                label="Actors"
                value={event.actors.length ? event.actors.join(', ') : 'Not specified'}
              />
            </>
          )}
        </div>
        <p className={styles.sources}>
          Sources:{' '}
          {sourceList.length
            ? sourceList.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ', '}
                  <a href={s.url} target="_blank" rel="noreferrer" title={s.name}>
                    {shortSourceName(s.name)}
                  </a>
                </span>
              ))
            : event.sourceIds.join(', ') || 'none listed'}
        </p>
      </div>
    </section>
  )
}
