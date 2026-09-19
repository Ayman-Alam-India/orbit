import type { CountryId } from '@shared'
import { Link } from 'react-router-dom'
import { paths } from '../../routes'
import { ItemList, Panel, QueryState } from '../../ui'
import { formatDate } from '../event/format'
import { useSources } from '../event/useSources'
import styles from './NewsList.module.css'
import { useNews } from './useNews'

type NewsListProps = {
  /** Without a countryId: headlines from everywhere. */
  countryId?: CountryId
  /** How many headlines to show (newest first). */
  limit?: number
}

/**
 * Latest headlines (decision owner: Shrey). Each row: title (opens the source), source name and date,
 * plus a link to the ORBIT event when the headline is about one.
 */
export function NewsList({ countryId, limit = 6 }: NewsListProps) {
  const query = useNews(countryId)
  const sources = useSources()
  const sourceName = (id: string) => sources.data?.find((s) => s.id === id)?.name ?? id

  return (
    <Panel eyebrow="Headlines">
      <QueryState query={query} label="headlines">
        {(news) => (
          <ItemList
            items={news.slice(0, limit)}
            getKey={(n) => n.id}
            empty="No headlines yet."
            renderItem={(n) => (
              <div className={styles.row}>
                <a href={n.url} target="_blank" rel="noreferrer" className={styles.title}>
                  {n.title}
                </a>
                <span className={styles.meta}>
                  <span>{sourceName(n.sourceId)}</span>
                  <span>·</span>
                  <span>{formatDate(n.publishedAt)}</span>
                  {n.eventId && n.countryIds[0] && (
                    <Link to={paths.event(n.countryIds[0], n.eventId)} className={styles.eventLink}>
                      View event →
                    </Link>
                  )}
                </span>
              </div>
            )}
          />
        )}
      </QueryState>
    </Panel>
  )
}
