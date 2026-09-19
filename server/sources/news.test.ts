// @vitest-environment node
import { NewsHeadlineSchema } from '@shared'
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

const { getNewsFeed, refreshNewsFeed } = await import('.')

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

describe('live news feed', () => {
  it('merges live headlines after the curated ones and caches them', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ articles: [gdeltArticle] }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)
    // First call answers at once with curated headlines and starts a background refresh.
    const first = await getNewsFeed('BRA')
    expect(first.every((n) => n.sourceId !== 'src_gdelt')).toBe(true)
    await refreshNewsFeed('BRA')
    const feed = await getNewsFeed('BRA')
    expect(feed.some((n) => n.publisher === 'example.net')).toBe(true)
    expect(feed.some((n) => n.sourceId !== 'src_gdelt')).toBe(true)
    expect(String(fetchMock.mock.calls[0][0])).toContain('%22Brazil%22')
    expect(cache.has('news-BRA')).toBe(true)

    // Within 30 minutes the cache is fresh: no new request.
    await getNewsFeed('BRA')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('falls back to curated headlines when GDELT fails (e.g. no wifi)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await refreshNewsFeed('IND')
    const feed = await getNewsFeed('IND')
    expect(feed.length).toBeGreaterThan(0)
    expect(feed.every((n) => n.sourceId !== 'src_gdelt')).toBe(true)
  })

  it('treats a rate-limit text reply as a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Please limit requests to one every 5 seconds')),
    )
    await refreshNewsFeed('USA')
    const feed = await getNewsFeed('USA')
    expect(feed.every((n) => n.sourceId !== 'src_gdelt')).toBe(true)
  })
})
