import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCountries } from '../features/country/useCountry'
import { useEvents } from '../features/event/useEvents'
import { paths } from '../routes'
import { Tag } from '../ui'
import styles from './SearchBox.module.css'

type Result = {
  key: string
  label: string
  detail: string
  to: string
  tag?: 'geopolitical' | 'health'
}

const MAX_RESULTS = 8

/** Search countries and events by name; arrow keys + Enter pick a result. */
export function SearchBox() {
  const navigate = useNavigate()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const countries = useCountries()
  const events = useEvents()

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const countryResults: Result[] = (countries.data ?? [])
      .filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase() === q)
      .map((c) => ({ key: c.id, label: c.name, detail: c.region, to: paths.country(c.id) }))
    const eventResults: Result[] = (events.data ?? [])
      .filter((e) => e.title.toLowerCase().includes(q))
      .map((e) => ({
        key: e.id,
        label: e.title,
        detail: e.countryIds.join(', '),
        to: paths.event(e.countryIds[0], e.id),
        tag: e.kind,
      }))
    return [...countryResults, ...eventResults].slice(0, MAX_RESULTS)
  }, [query, countries.data, events.data])

  const choose = (result: Result) => {
    navigate(result.to)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const expanded = open && results.length > 0
  return (
    <div className={styles.search}>
      <input
        className={styles.input}
        type="search"
        role="combobox"
        aria-label="Search countries and events"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
        placeholder="Search countries, events…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {expanded && (
        <ul id={listId} role="listbox" className={styles.results}>
          {results.map((r, i) => (
            <li
              key={r.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={styles.result}
              // mousedown (not click) so the input's blur doesn't close the list first
              onMouseDown={(e) => {
                e.preventDefault()
                choose(r)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={styles.label}>{r.label}</span>
              <span className={styles.detail}>
                {r.tag && <Tag kind={r.tag}>{r.tag}</Tag>} {r.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
