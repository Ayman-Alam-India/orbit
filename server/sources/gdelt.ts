import { NewsHeadlineSchema, type CountryId, type NewsHeadline } from '@shared'

/**
 * GDELT DOC 2.0 API: free, keyless, global news search (https://www.gdeltproject.org/).
 * GDELT allows one request every 5 seconds, so requests go through a small queue.
 */
const GDELT_URL = 'https://api.gdeltproject.org/api/v2/doc/doc'
/**
 * GDELT asks for one request every 5 s but rate-limits bursts harder than that in practice,
 * so ORBIT waits 10 s between requests and backs off 20 s (once) after a 429. Tests set both to 0.
 */
export const gdeltThrottle = { minGapMs: 10_000, backoffMs: 20_000 }
const TIMEOUT_MS = 30_000

/** Every live headline cites this source (it exists in server/data/seed/sources.json). */
export const GDELT_SOURCE_ID = 'src_gdelt'

type GdeltArticle = { url?: string; title?: string; seendate?: string; domain?: string }

let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

/** Runs `task` after any earlier GDELT request, at least gdeltThrottle.minGapMs after the previous one started. */
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + gdeltThrottle.minGapMs - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastRequestAt = Date.now()
    return task()
  })
  queue = run.catch(() => undefined)
  return run
}

/** Stable, readable ID from the article URL (FNV-1a hash). */
function idFor(url: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `news_gdelt_${(hash >>> 0).toString(16)}`
}

/** "20260903T090000Z" → "2026-09-03T09:00:00Z" */
function isoFromSeenDate(seen: string) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seen)
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : undefined
}

/** Turns raw GDELT articles into valid NewsHeadlines; anything that doesn't fit the contract is dropped. */
export function toHeadlines(articles: GdeltArticle[], countryIds: CountryId[]): NewsHeadline[] {
  const headlines: NewsHeadline[] = []
  for (const a of articles) {
    const parsed = NewsHeadlineSchema.safeParse({
      id: a.url ? idFor(a.url) : undefined,
      // GDELT tokenises titles ("Ukraine , says"): collapse spaces and re-attach punctuation.
      title: a.title
        ?.replace(/\s+/g, ' ')
        .replace(/\s+([,.:;!?])/g, '$1')
        .trim(),
      url: a.url,
      sourceId: GDELT_SOURCE_ID,
      publishedAt: a.seendate ? isoFromSeenDate(a.seendate) : undefined,
      countryIds,
      publisher: a.domain || undefined,
    })
    if (parsed.success) headlines.push(parsed.data)
  }
  return headlines
}

/** Latest English-language articles matching `query` from the last 7 days. Throws on any failure. */
export async function fetchGdeltHeadlines(
  query: string,
  countryIds: CountryId[],
): Promise<NewsHeadline[]> {
  const params = new URLSearchParams({
    query: `${query} sourcelang:english`,
    mode: 'artlist',
    format: 'json',
    maxrecords: '10',
    timespan: '7d',
    sort: 'datedesc',
  })
  const request = () => fetch(`${GDELT_URL}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  return throttled(async () => {
    let res = await request()
    if (res.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, gdeltThrottle.backoffMs))
      res = await request()
    }
    if (!res.ok) throw new Error(`GDELT responded ${res.status}`)
    // GDELT answers rate-limit and query errors with plain text, not JSON.
    const text = await res.text()
    let body: { articles?: GdeltArticle[] }
    try {
      body = JSON.parse(text)
    } catch {
      throw new Error(`GDELT returned non-JSON: ${text.slice(0, 120)}`)
    }
    return toHeadlines(body.articles ?? [], countryIds)
  })
}
