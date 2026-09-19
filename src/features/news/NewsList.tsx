import type { CountryId } from '@shared'
import { ItemList, Panel, QueryState } from '../../ui'
import { useNews } from './useNews'

/** PLACEHOLDER (owner: Shrey). Latest headlines, for one country or for the world. */
export function NewsList({ countryId }: { countryId?: CountryId }) {
  const query = useNews(countryId)
  return (
    <Panel eyebrow="Headlines">
      <QueryState query={query} label="headlines">
        {(news) => (
          <ItemList
            items={news}
            getKey={(n) => n.id}
            empty="No headlines yet."
            renderItem={(n) => (
              <a href={n.url} target="_blank" rel="noreferrer">
                {n.title}
              </a>
            )}
          />
        )}
      </QueryState>
    </Panel>
  )
}
