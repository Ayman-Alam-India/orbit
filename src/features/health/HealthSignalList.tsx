import { Link } from 'react-router-dom'
import { paths } from '../../routes'
import { ItemList, Panel, QueryState, SeverityBadge } from '../../ui'
import { useEvents } from '../event/useEvents'

/** PLACEHOLDER (owner: Shrey). The latest health signals worldwide. */
export function HealthSignalList() {
  const query = useEvents('health')
  return (
    <Panel eyebrow="Health signals">
      <QueryState query={query} label="health signals">
        {(signals) => (
          <ItemList
            items={signals}
            getKey={(s) => s.id}
            empty="No health signals right now."
            renderItem={(s) => (
              <Link to={paths.event(s.countryIds[0], s.id)}>
                {s.title} <SeverityBadge severity={s.severity} />
              </Link>
            )}
          />
        )}
      </QueryState>
    </Panel>
  )
}
