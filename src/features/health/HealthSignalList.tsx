import { Link } from 'react-router-dom'
import { paths } from '../../routes'
import { Panel, QueryState, SeverityBadge } from '../../ui'
import { useCountries } from '../country/useCountry'
import { countryNames, formatDate } from '../event/format'
import { useEvents } from '../event/useEvents'
import styles from './HealthSignalList.module.css'

/**
 * Latest health signals worldwide, most severe first (decision owner: Shrey).
 * Each card: severity, country and date, title, and the headline metric.
 */
export function HealthSignalList({ limit = 5 }: { limit?: number }) {
  const query = useEvents('health')
  const countries = useCountries()

  return (
    <Panel eyebrow="Health signals">
      <QueryState query={query} label="health signals">
        {(signals) =>
          signals.length ? (
            <ul className={styles.list}>
              {[...signals]
                .sort((a, b) => b.severity - a.severity)
                .slice(0, limit)
                .map((s) => (
                  <li key={s.id}>
                    <Link to={paths.event(s.countryIds[0], s.id)} className={styles.card}>
                      <span className={styles.meta}>
                        <SeverityBadge severity={s.severity} />
                        <span>
                          {countryNames(s.countryIds, countries.data)} · {formatDate(s.occurredAt)}
                        </span>
                      </span>
                      <span className={styles.title}>{s.title}</span>
                      {s.kind === 'health' && s.metric && (
                        <span className={styles.metric}>
                          <strong>{s.metric.value.toLocaleString('en')}</strong> {s.metric.unit}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
            </ul>
          ) : (
            <p className={styles.empty}>No health signals right now.</p>
          )
        }
      </QueryState>
    </Panel>
  )
}
