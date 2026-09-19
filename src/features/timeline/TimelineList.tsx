import type { CountryId, TimelineEvent } from '@shared'
import { Link } from 'react-router-dom'
import { paths } from '../../routes'
import { Panel, QueryState } from '../../ui'
import { formatDate } from '../event/format'
import styles from './TimelineList.module.css'
import { useTimeline } from './useTimeline'

function Entry({ entry }: { entry: TimelineEvent }) {
  const title = entry.eventId ? (
    <Link to={paths.event(entry.countryId, entry.eventId)} className={styles.title}>
      {entry.title} →
    </Link>
  ) : (
    <span className={styles.title}>{entry.title}</span>
  )
  return (
    <li className={styles.entry} data-linked={Boolean(entry.eventId)}>
      <time className={styles.date} dateTime={entry.date}>
        {formatDate(entry.date, entry.datePrecision)}
      </time>
      <span className={styles.dot} aria-hidden />
      <div className={styles.body}>
        {title}
        <p className={styles.description}>{entry.description}</p>
      </div>
    </li>
  )
}

/**
 * A country's history as a vertical timeline, oldest first (decision owner: Ayman).
 * Entries linked to an ORBIT event are highlighted and open that event.
 */
export function TimelineList({ countryId }: { countryId: CountryId }) {
  const query = useTimeline(countryId)
  return (
    <Panel eyebrow="Timeline">
      <QueryState query={query} label="timeline">
        {(items) =>
          items.length ? (
            <ol className={styles.timeline}>
              {items.map((entry) => (
                <Entry key={entry.id} entry={entry} />
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>No timeline entries yet.</p>
          )
        }
      </QueryState>
    </Panel>
  )
}
