import type { NewsHeadline } from '@shared'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useNews } from '../features/news/useNews'
import { paths } from '../routes'
import styles from './HeadlineTicker.module.css'

/** Seconds each headline is on screen; the loop gets longer as headlines are added. */
const SECONDS_PER_HEADLINE = 8

function HeadlineLink({ headline, hidden }: { headline: NewsHeadline; hidden?: boolean }) {
  const countryId = headline.countryIds[0]
  const common = { className: styles.item, tabIndex: hidden ? -1 : undefined }
  // Headlines about an ORBIT event open that event; others open their source.
  return headline.eventId && countryId ? (
    <Link {...common} to={paths.event(countryId, headline.eventId)}>
      {headline.title}
    </Link>
  ) : (
    <a {...common} href={headline.url} target="_blank" rel="noreferrer">
      {headline.title}
    </a>
  )
}

/** Scrolling strip of the latest headlines in the top bar. Pauses on hover and keyboard focus. */
export function HeadlineTicker() {
  const news = useNews()
  const headlines = news.data ?? []
  if (!headlines.length) return <div className={styles.ticker} aria-hidden />

  const style = {
    '--ticker-duration': `${headlines.length * SECONDS_PER_HEADLINE}s`,
  } as CSSProperties
  return (
    <nav className={styles.ticker} aria-label="Latest headlines">
      <span className={styles.label}>Live</span>
      <div className={styles.viewport}>
        <div className={styles.track} style={style}>
          {headlines.map((h) => (
            <HeadlineLink key={h.id} headline={h} />
          ))}
          {/* Second copy makes the loop seamless; hidden from screen readers and keyboard. */}
          <span aria-hidden className={styles.copy}>
            {headlines.map((h) => (
              <HeadlineLink key={h.id} headline={h} hidden />
            ))}
          </span>
        </div>
      </div>
    </nav>
  )
}
