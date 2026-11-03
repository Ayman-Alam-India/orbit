import { NewsHeadlineSchema, type CountryId, type NewsHeadline } from '@shared'

/**
 * Google News RSS: free, keyless, updated all day, and answers in about a second, so it can keep
 * every country's feed fresh. ORBIT's main live news source; GDELT is the fallback.
 */
const BASE = 'https://news.google.com/rss'
const EDITION = 'hl=en-US&gl=US&ceid=US:en'
const TIMEOUT_MS = 10_000
const MAX_ITEMS = 10

/** Every Google News headline cites this source (it exists in server/data/seed/sources.json). */
export const GOOGLE_NEWS_SOURCE_ID = 'src_google_news'

/** Names that also match a different country ("Sudan" is inside "South Sudan"): that one is excluded. */
const EXCLUDE: Record<string, string> = { Sudan: 'South Sudan' }

/** World top stories, or the last two days of English news that mention the country by name. */
export function googleNewsUrl(countryName?: string) {
  if (!countryName) return `${BASE}/headlines/section/topic/WORLD?${EDITION}`
  const exclude = EXCLUDE[countryName] ? ` -"${EXCLUDE[countryName]}"` : ''
  const q = encodeURIComponent(`"${countryName}"${exclude} when:2d`)
  return `${BASE}/search?q=${q}&${EDITION}`
}

/** Stable, readable ID from the article link (FNV-1a hash). */
function idFor(url: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `news_gnews_${(hash >>> 0).toString(16)}`
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** XML text → plain text: CDATA, named and numeric entities. */
function decode(text: string) {
  return text
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
    .trim()
}

const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml)
  return m ? decode(m[1]) : undefined
}

/** "reuters.com" from the <source url="https://www.reuters.com"> attribute. */
function publisherDomain(item: string) {
  const url = /<source\s[^>]*url="([^"]+)"/.exec(item)?.[1]
  if (!url) return undefined
  try {
    return new URL(decode(url)).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/** Turns an RSS document into valid NewsHeadlines, newest first; items that don't fit the contract are dropped. */
export function parseGoogleNews(xml: string, countryIds: CountryId[]): NewsHeadline[] {
  const headlines: NewsHeadline[] = []
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const link = tag(item, 'link')
    const outlet = tag(item, 'source')
    const date = tag(item, 'pubDate')
    // Google appends " - Outlet" to every title; the outlet is shown separately.
    let title = tag(item, 'title')
    if (title && outlet && title.endsWith(` - ${outlet}`))
      title = title.slice(0, -outlet.length - 3)
    const parsed = NewsHeadlineSchema.safeParse({
      id: link ? idFor(link) : undefined,
      title: title?.trim(),
      url: link,
      sourceId: GOOGLE_NEWS_SOURCE_ID,
      publishedAt:
        date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : undefined,
      countryIds,
      publisher: publisherDomain(item) ?? outlet,
    })
    if (parsed.success) headlines.push(parsed.data)
  }
  return headlines.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, MAX_ITEMS)
}

async function fetchRss(url: string, countryIds: CountryId[]): Promise<NewsHeadline[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'ORBIT-hackathon-prototype' },
  })
  if (!res.ok) throw new Error(`Google News responded ${res.status}`)
  const xml = await res.text()
  if (!xml.includes('<rss')) throw new Error(`Google News returned non-RSS: ${xml.slice(0, 120)}`)
  return parseGoogleNews(xml, countryIds)
}

/** Latest headlines for a country (by name) or the world. Throws on any failure. */
export function fetchGoogleNews(
  countryName: string | undefined,
  countryIds: CountryId[],
): Promise<NewsHeadline[]> {
  return fetchRss(googleNewsUrl(countryName), countryIds)
}

/** Free-text search (Google News syntax, e.g. `"Red Sea" "Egypt" when:7d`). Throws on any failure. */
export function searchGoogleNews(query: string, countryIds: CountryId[] = []) {
  return fetchRss(`${BASE}/search?q=${encodeURIComponent(query)}&${EDITION}`, countryIds)
}
