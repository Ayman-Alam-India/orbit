import type { CountryId, EventId } from '@shared'
import { ItemList, Panel, QueryState } from '../../ui'
import { useNews } from '../news/useNews'
import { formatDate } from './format'
import styles from './EventView.module.css'

/** Headlines linked to this event (NewsHeadline.eventId). */
export function RelatedHeadlines({
  countryId,
  eventId,
}: {
  countryId: CountryId
  eventId: EventId
}) {
  const news = useNews(countryId)
  return (
    <Panel eyebrow="Related headlines">
      <QueryState query={news} label="headlines">
        {(all) => (
          <ItemList
            items={all.filter((n) => n.eventId === eventId)}
            getKey={(n) => n.id}
            empty="No related headlines."
            renderItem={(n) => (
              <span className={styles.headline}>
                <a href={n.url} target="_blank" rel="noreferrer">
                  {n.title}
                </a>
                <span className={styles.headlineDate}>{formatDate(n.publishedAt)}</span>
              </span>
            )}
          />
        )}
      </QueryState>
    </Panel>
  )
}
