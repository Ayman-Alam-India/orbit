import type { CountryId, OrbitEvent } from '@shared'
import { Link } from 'react-router-dom'
import { paths } from '../../routes'
import { SeverityBadge, Tag } from '../../ui'
import { formatDate } from '../event/format'
import styles from './CountryView.module.css'

/** The country's events as cards, newest first (the API already sorts them). */
export function CountryEvents({
  countryId,
  events,
}: {
  countryId: CountryId
  events: OrbitEvent[]
}) {
  if (!events.length) return <p className={styles.empty}>No tracked events for this country.</p>
  return (
    <ul className={styles.eventList}>
      {events.map((e) => (
        <li key={e.id}>
          <Link to={paths.event(countryId, e.id)} className={styles.eventCard}>
            <span className={styles.eventMeta}>
              <Tag kind={e.kind}>{e.kind}</Tag>
              <SeverityBadge severity={e.severity} />
              <span className={styles.date}>{formatDate(e.occurredAt)}</span>
            </span>
            <span className={styles.eventTitle}>{e.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
