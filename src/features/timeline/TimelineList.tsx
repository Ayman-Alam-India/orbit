import type { CountryId, TimelineEvent } from '@shared'
import { ItemList, Panel, QueryState } from '../../ui'
import { useTimeline } from './useTimeline'

/** Formats a timeline date at the precision it was recorded with. */
function formatDate({ date, datePrecision }: TimelineEvent) {
  const d = new Date(date)
  if (datePrecision === 'year') return String(d.getUTCFullYear())
  return d.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    ...(datePrecision === 'day' ? { day: 'numeric' } : {}),
  })
}

/** PLACEHOLDER (owner: Ayman). A country's history, oldest first. */
export function TimelineList({ countryId }: { countryId: CountryId }) {
  const query = useTimeline(countryId)
  return (
    <Panel eyebrow="Timeline">
      <QueryState query={query} label="timeline">
        {(items) => (
          <ItemList
            items={items}
            getKey={(t) => t.id}
            empty="No timeline entries yet."
            renderItem={(t) => (
              <>
                <strong>{formatDate(t)}</strong> · {t.title}
              </>
            )}
          />
        )}
      </QueryState>
    </Panel>
  )
}
