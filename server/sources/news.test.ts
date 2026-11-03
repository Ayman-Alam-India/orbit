// @vitest-environment node
import { NewsHeadlineSchema, NewsRefreshResultSchema } from '@shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gdeltThrottle, toHeadlines } from './gdelt'

vi.mock('../env', () => ({ env: { DATA_MODE: 'live' } }))

const cache = new Map<string, unknown>()
vi.mock('./cache', () => ({
  readCache: async (key: string) => cache.get(key),
  writeCache: async (key: string, value: unknown) => void cache.set(key, value),
}))

const gdeltArticle = {
  url: 'https://www.example.net/brazil-story',
  title: 'Brazil  story , update ',
  seendate: '20260917T101500Z',
  domain: 'example.net',
}

const { getNewsFeed, refreshNews, refreshNewsFeed, refreshTimeout } = await import('.')
const { googleNewsUrl, parseGoogleNews } = await import('./googleNews')

beforeEach(() => {
  gdeltThrottle.minGapMs = 0
  gdeltThrottle.backoffMs = 0
  cache.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllGlobals())

describe('GDELT mapping', () => {
  it('turns articles into valid headlines and drops broken ones', () => {
    const items = toHeadlines([gdeltArticle, { title: 'no url' }], ['BRA'])
    expect(items).toHaveLength(1)
    const [h] = items
    expect(NewsHeadlineSchema.parse(h)).toMatchObject({
      title: 'Brazil story, update',
      publishedAt: '2026-09-17T10:15:00Z',
      countryIds: ['BRA'],
      sourceId: 'src_gdelt',
      publisher: 'example.net',
    })
    expect(h.id).toMatch(/^news_gdelt_[0-9a-f]+$/)
  })
})

const rss = (items: string) =>
  `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`
const rssItem = (title: string, link: string, date = 'Tue, 03 Nov 2026 09:00:00 GMT') =>
  `<item><title>${title} - Reuters</title><link>${link}</link><pubDate>${date}</pubDate><source url="https://www.reuters.com">Reuters</source></item>`
const googleOk = () =>
  new Response(
    rss(rssItem('Brazil &amp; Chile sign deal', 'https://news.google.com/rss/articles/abc')),
  )
const gdeltOk = () => new Response(JSON.stringify({ articles: [gdeltArticle] }), { status: 200 })
/** fetch stub that answers per host, so a test can fail one source and not the other. */
const byHost =
  (google: () => Promise<Response> | Response, gdelt: () => Promise<Response> | Response) =>
  async (url: string | URL) => (String(url).includes('news.google.com') ? google() : gdelt())

describe('Google News mapping', () => {
  it('turns RSS items into valid headlines with the outlet split off the title', () => {
    const [h] = parseGoogleNews(
      rss(rssItem('Brazil &amp; Chile sign deal', 'https://news.google.com/rss/articles/abc')),
      ['BRA'],
    )
    expect(NewsHeadlineSchema.parse(h)).toMatchObject({
      title: 'Brazil & Chile sign deal',
      publishedAt: '2026-11-03T09:00:00.000Z',
      sourceId: 'src_google_news',
      publisher: 'reuters.com',
      countryIds: ['BRA'],
    })
    expect(h.id).toMatch(/^news_gnews_[0-9a-f]+$/)
  })

  it('drops broken items and keeps the newest first', () => {
    const items = parseGoogleNews(
      rss(
        rssItem('Older', 'https://example.org/1', 'Mon, 02 Nov 2026 09:00:00 GMT') +
          '<item><title>No link</title></item>' +
          rssItem('Newer', 'https://example.org/2'),
      ),
      [],
    )
    expect(items.map((n) => n.title)).toEqual(['Newer', 'Older'])
  })

  it('searches by country name, or uses world top stories', () => {
    expect(googleNewsUrl('Brazil')).toContain('q=%22Brazil%22')
    expect(googleNewsUrl()).toContain('/topic/WORLD')
  })
})

describe('live news feed', () => {
  it('merges Google headlines after the curated ones and caches them', async () => {
    const fetchMock = vi.fn(byHost(googleOk, gdeltOk))
    vi.stubGlobal('fetch', fetchMock)
    // First call answers at once with curated headlines and starts a background refresh.
    const first = await getNewsFeed('BRA')
    expect(first.every((n) => n.sourceId !== 'src_google_news')).toBe(true)
    await refreshNewsFeed('BRA')
    const feed = await getNewsFeed('BRA')
    expect(feed.some((n) => n.title === 'Brazil & Chile sign deal')).toBe(true)
    expect(String(fetchMock.mock.calls[0][0])).toContain('news.google.com')
    expect(cache.has('news-BRA')).toBe(true)

    // Within 10 minutes the cache is fresh: no new request, and GDELT was never needed.
    await getNewsFeed('BRA')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('falls back to GDELT when Google News fails', async () => {
    vi.stubGlobal('fetch', vi.fn(byHost(() => new Response('nope', { status: 503 }), gdeltOk)))
    expect(await refreshNewsFeed('BRA')).toBe(true)
    const feed = await getNewsFeed('BRA')
    expect(feed.some((n) => n.publisher === 'example.net')).toBe(true)
  })

  it('falls back to curated headlines when both fail (e.g. no wifi)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    expect(await refreshNewsFeed('IND')).toBe(false)
    const feed = await getNewsFeed('IND')
    expect(feed.length).toBeGreaterThan(0)
    expect(feed.every((n) => n.sourceId !== 'src_google_news' && n.sourceId !== 'src_gdelt')).toBe(
      true,
    )
  })

  it('keeps the saved headlines when a quiet country returns none', async () => {
    vi.stubGlobal('fetch', vi.fn(byHost(googleOk, gdeltOk)))
    await refreshNewsFeed('BRA')
    vi.stubGlobal('fetch', vi.fn(byHost(() => new Response(rss('')), gdeltOk)))
    expect(await refreshNewsFeed('BRA')).toBe(false)
    expect((await getNewsFeed('BRA')).some((n) => n.title === 'Brazil & Chile sign deal')).toBe(
      true,
    )
  })

  it('treats a GDELT rate-limit text reply as a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        byHost(
          () => new Response('nope', { status: 503 }),
          () => new Response('Please limit requests to one every 5 seconds'),
        ),
      ),
    )
    expect(await refreshNewsFeed('USA')).toBe(false)
  })
})

describe('refresh button (refreshNews)', () => {
  it('waits for the live source and answers with the fresh headlines', async () => {
    vi.stubGlobal('fetch', vi.fn(byHost(googleOk, gdeltOk)))
    const result = NewsRefreshResultSchema.parse(await refreshNews('BRA'))
    expect(result.refreshed).toBe(true)
    expect(result.fetchedAt).toBeDefined()
    expect(result.headlines.some((n) => n.publisher === 'reuters.com')).toBe(true)
  })

  it('answers with the saved headlines when every source fails', async () => {
    vi.stubGlobal('fetch', vi.fn(byHost(googleOk, gdeltOk)))
    await refreshNewsFeed('BRA')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const result = await refreshNews('BRA')
    expect(result.refreshed).toBe(false)
    expect(result.headlines.some((n) => n.publisher === 'reuters.com')).toBe(true)
  })

  it('gives up after the timeout instead of hanging the click', async () => {
    const previous = refreshTimeout.ms
    refreshTimeout.ms = 10
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    )
    const result = await refreshNews('IND')
    refreshTimeout.ms = previous
    expect(result.refreshed).toBe(false)
    expect(result.fetchedAt).toBeUndefined()
    expect(result.headlines.length).toBeGreaterThan(0)
  })
})
