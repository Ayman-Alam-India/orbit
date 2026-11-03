import type { CountryId } from '@shared'
import { Link } from 'react-router-dom'
import { paths } from '../../routes'
import { ItemList, Panel, QueryState } from '../../ui'
import { TrustWithVerify } from '../insight/VerifyNow'
import { formatDate, shortSourceName } from '../event/format'
import { useSources } from '../event/useSources'
import styles from './NewsList.module.css'
import { RefreshNews } from './RefreshNews'
import { recentAgo, useNow } from './updatedAgo'
import { useNews } from './useNews'

type NewsListProps = {
  /** Without a countryId: headlines from everywhere. */
  countryId?: CountryId
  /** How many headlines to show (newest first). */
  limit?: number
}

/**
 * Latest headlines (decision owner: Shrey). Each row: title (opens the source), source name and
 * time ("12 min ago" today, the date before that), plus a link to the ORBIT event when there is one.
 */
export function NewsList({ countryId, limit = 6 }: NewsListProps) {
  const query = useNews(countryId)
  const now = useNow()
  const sources = useSources()
  const sourceName = (id: string) => {
    const name = sources.data?.find((s) => s.id === id)?.name
    return name ? shortSourceName(name) : id
  }

  return (
    <Panel eyebrow="Headlines" actions={<RefreshNews countryId={countryId} />}>
      <QueryState query={query} label="headlines">
        {(news) => (
          <ItemList
            // Like a news front page: important stories first, each group newest first.
            items={[...news]
              .sort(
                (a, b) =>
                  Number(b.importance === 'important') - Number(a.importance === 'important'),
              )
              .slice(0, limit)}
            getKey={(n) => n.id}
            empty="No headlines yet."
            renderItem={(n) => (
              <div className={styles.row}>
                {n.importance === 'important' && (
                  <span className={styles.important}>Important</span>
                )}
                <a href={n.url} target="_blank" rel="noreferrer" className={styles.title}>
                  {n.title}
                </a>
                <span className={styles.meta}>
                  <TrustWithVerify
                    trust={n.trust}
                    request={{ kind: 'headline', id: n.id }}
                    compact
                  />
                  <span>{n.publisher ?? sourceName(n.sourceId)}</span>
                  <span>·</span>
                  <span>{recentAgo(n.publishedAt, now) ?? formatDate(n.publishedAt)}</span>
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
