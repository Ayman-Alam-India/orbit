import { ArticleMediaSchema, type ArticleMedia, type NewsHeadline } from '@shared'
import { createHash } from 'node:crypto'
import { readCache, writeCache } from './cache'

/**
 * The photos and videos an article shows, for ORBIT's in-app article preview. The server reads the
 * article page's own preview tags (og:image, og:video, twitter:image, YouTube embeds), the same ones
 * social networks use for link cards. Only headlines ORBIT already has are looked up, never arbitrary URLs.
 */
const TIMEOUT_MS = 10_000
/** Pages bigger than this are cut off: the preview tags are in the <head>. */
const MAX_BYTES = 1_500_000
const UA = 'Mozilla/5.0 (ORBIT hackathon demo; article preview)'

const cacheKey = (url: string) =>
  `media-${createHash('sha1').update(url).digest('hex').slice(0, 16)}`

async function fetchText(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`)
  const text = await res.text()
  return { text: text.slice(0, MAX_BYTES), finalUrl: res.url || url }
}

const attr = (html: string, name: string) =>
  new RegExp(`data-n-a-${name}="([^"]+)"`).exec(html)?.[1]

/**
 * Google News links are not redirects: the page carries the article's ID, timestamp and signature,
 * and Google's own decoder (the call its redirect makes) returns the real address.
 */
export async function resolveGoogleNewsUrl(url: string): Promise<string> {
  if (!new URL(url).hostname.endsWith('news.google.com')) return url
  const { text } = await fetchText(url)
  const id = attr(text, 'id')
  const ts = attr(text, 'ts')
  const sg = attr(text, 'sg')
  if (!id || !ts || !sg) throw new Error('Google News page had no article reference')
  const inner = JSON.stringify([
    'garturlreq',
    [
      [
        'X',
        'X',
        ['X', 'X'],
        null,
        null,
        1,
        1,
        'US:en',
        null,
        1,
        null,
        null,
        null,
        null,
        null,
        0,
        1,
      ],
      'X',
      'X',
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    id,
    Number(ts),
    sg,
  ])
  const body = new URLSearchParams({
    'f.req': JSON.stringify([[['Fbv4je', inner, null, 'generic']]]),
  })
  const { text: answer } = await fetchText(
    'https://news.google.com/_/DotsSplashUi/data/batchexecute',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
    },
  )
  // The address sits JSON-escaped in the answer (slashes may or may not be escaped).
  const m = /https?:(?:\\*\/){2}[^"\\]+/.exec(answer)
  if (!m) throw new Error('Google News decoder returned no address')
  return m[0].replace(/\\+\//g, '/')
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()

/** Every <meta property|name="key" content="…"> value, in page order. */
function metas(html: string, keys: string[]) {
  const found: string[] = []
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]
    if (key && content && keys.includes(key)) found.push(decode(content))
  }
  return found
}

/** Absolute http(s) URL or nothing. */
function absolute(url: string, base: string) {
  try {
    const u = new URL(url, base)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

const youtubeId = (url: string) =>
  /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(
    url,
  )?.[1]

/** Reads an article page's preview photos, videos, site name and description. */
export function parseArticlePage(html: string, pageUrl: string) {
  const head = html.slice(0, MAX_BYTES)
  const unique = (xs: (string | undefined)[]) => [
    ...new Set(xs.filter((x): x is string => Boolean(x))),
  ]
  const images = unique(
    metas(head, [
      'og:image:secure_url',
      'og:image',
      'og:image:url',
      'twitter:image',
      'twitter:image:src',
    ]).map((u) => absolute(u, pageUrl)),
  )
    // Logos and tracking pixels are not photos.
    .filter((u) => !/logo|favicon|sprite|pixel|placeholder|default-share/i.test(u))
    .slice(0, 4)

  const videos: ArticleMedia['videos'] = []
  const seen = new Set<string>()
  const add = (url: string | undefined, kind: ArticleMedia['videos'][number]['kind']) => {
    if (url && !seen.has(url)) {
      seen.add(url)
      videos.push({ url, kind })
    }
  }
  const declared = metas(head, [
    'og:video:secure_url',
    'og:video',
    'og:video:url',
    'twitter:player',
  ])
  const iframes = [...head.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map(
    (m) => m[1],
  )
  for (const raw of [...declared, ...iframes]) {
    const url = absolute(decode(raw), pageUrl)
    if (!url) continue
    const yt = youtubeId(url)
    if (yt) add(`https://www.youtube-nocookie.com/embed/${yt}`, 'youtube')
    else if (/\.(mp4|webm|m3u8)(\?|$)/i.test(url)) add(url, 'file')
    else if (declared.includes(raw)) add(url, 'embed')
  }
  for (const m of head.matchAll(/<video\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi))
    add(absolute(decode(m[1]), pageUrl), 'file')

  return {
    siteName: metas(head, ['og:site_name'])[0] || undefined,
    description:
      metas(head, ['og:description', 'description', 'twitter:description'])[0]?.slice(0, 400) ||
      undefined,
    images,
    videos: videos.slice(0, 2),
  }
}

/**
 * Photos and videos for one headline. Cached per article, so each one is fetched once (and the
 * preview still opens offline). Throws when the page can't be read.
 */
export async function getArticleMedia(headline: NewsHeadline): Promise<ArticleMedia> {
  const cached = ArticleMediaSchema.safeParse(await readCache(cacheKey(headline.url)))
  if (cached.success) return cached.data
  const articleUrl = await resolveGoogleNewsUrl(headline.url)
  const { text, finalUrl } = await fetchText(articleUrl)
  const media = ArticleMediaSchema.parse({
    headlineId: headline.id,
    articleUrl: finalUrl,
    ...parseArticlePage(text, finalUrl),
    fetchedAt: new Date().toISOString(),
  })
  await writeCache(cacheKey(headline.url), media)
  return media
}
