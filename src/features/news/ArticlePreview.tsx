import type { ArticleMedia, NewsHeadline } from '@shared'
import { useEffect, useRef } from 'react'
import { useUiStore } from '../../state/uiStore'
import { Button, Loader } from '../../ui'
import { formatDate } from '../event/format'
import { TrustWithVerify } from '../insight/VerifyNow'
import styles from './ArticlePreview.module.css'
import { recentAgo, useNow } from './updatedAgo'
import { useArticleMedia } from './useNews'

function Video({ video, title }: { video: ArticleMedia['videos'][number]; title: string }) {
  if (video.kind === 'file')
    return <video className={styles.video} src={video.url} controls preload="metadata" />
  return (
    <iframe
      className={styles.video}
      src={video.url}
      title={`Video: ${title}`}
      // Third-party players get no access to ORBIT itself.
      sandbox="allow-scripts allow-same-origin allow-presentation"
      allow="encrypted-media; picture-in-picture; fullscreen"
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  )
}

/** The article's own photos and videos, then its description. */
function Media({ headline }: { headline: NewsHeadline }) {
  const media = useArticleMedia(headline.id)
  if (media.isPending) return <Loader label="Loading the article's photos and videos" />
  if (media.isError)
    return (
      <p className={styles.note}>
        {media.error.message.includes('live data')
          ? 'Photos and videos need live data (DATA_MODE=live).'
          : "This article's page couldn't be read, so there's nothing to preview."}
      </p>
    )
  const { images, videos, description } = media.data
  return (
    <>
      {videos.map((v) => (
        <Video key={v.url} video={v} title={headline.title} />
      ))}
      {images.length > 0 && (
        <div className={styles.images}>
          {images.slice(0, videos.length ? 1 : 3).map((src, i) => (
            <img
              key={src}
              src={src}
              alt={i === 0 ? `Photo from the article: ${headline.title}` : ''}
              className={i === 0 ? styles.hero : styles.thumb}
              // Many outlets refuse images requested from other sites with a referrer.
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ))}
        </div>
      )}
      {!images.length && !videos.length && (
        <p className={styles.note}>This article has no photos or videos to preview.</p>
      )}
      {description && <p className={styles.description}>{description}</p>}
    </>
  )
}

/**
 * In-app article preview (opens when a headline is clicked): title, outlet, time and trust, the
 * article's photos and videos, its description, and a link to read the full article at the source.
 */
export function ArticlePreview() {
  const { articlePreview: headline, openArticle } = useUiStore()
  const close = () => openArticle(undefined)
  const dialog = useRef<HTMLElement>(null)
  const media = useArticleMedia(headline?.id)
  const now = useNow()

  useEffect(() => {
    if (!headline) return
    dialog.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && openArticle(undefined)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [headline, openArticle])

  if (!headline) return null
  const outlet = media.data?.siteName ?? headline.publisher ?? 'the source'
  return (
    <div className={styles.backdrop} onClick={close}>
      <article
        className={styles.card}
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="article-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <p className={styles.meta}>
            <span>{headline.publisher ?? outlet}</span>
            <span>·</span>
            <span>{recentAgo(headline.publishedAt, now) ?? formatDate(headline.publishedAt)}</span>
            {headline.importance === 'important' && (
              <span className={styles.important}>Important</span>
            )}
          </p>
          <Button variant="ghost" size="sm" iconOnly aria-label="Close preview" onClick={close}>
            ✕
          </Button>
        </header>
        <h2 id="article-preview-title" className={styles.title}>
          {headline.title}
        </h2>
        <TrustWithVerify trust={headline.trust} request={{ kind: 'headline', id: headline.id }} />
        <Media headline={headline} />
        <a
          className={styles.read}
          href={media.data?.articleUrl ?? headline.url}
          target="_blank"
          rel="noreferrer"
        >
          Read the full article on {outlet} ↗
        </a>
      </article>
    </div>
  )
}
