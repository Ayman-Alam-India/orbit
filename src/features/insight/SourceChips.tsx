import type { SourceId } from '@shared'
import { shortSourceName } from '../event/format'
import { useSources } from '../event/useSources'
import styles from './Insight.module.css'

/** Source IDs rendered as small linked chips (name + reliability). Shared by insights and Ask ORBIT. */
export function SourceChips({ ids }: { ids: SourceId[] }) {
  const sources = useSources()
  if (!ids.length) return <span className={styles.noSources}>No sources cited</span>
  return (
    <span className={styles.chips}>
      {ids.map((id) => {
        const source = sources.data?.find((s) => s.id === id)
        return source ? (
          <a
            key={id}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className={styles.chip}
            title={`${source.name} · reliability: ${source.reliability}`}
          >
            {shortSourceName(source.name)}
          </a>
        ) : (
          <span key={id} className={styles.chip}>
            {id}
          </span>
        )
      })}
    </span>
  )
}
