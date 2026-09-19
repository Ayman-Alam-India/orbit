import type { CountryId, NewsHeadline } from '@shared'
import { store } from '../data/store'
import { env } from '../env'
import { readCache, writeCache } from './cache'
import { fetchGdeltHeadlines } from './gdelt'

/**
 * Live-data layer. Routes ask this module for data that may come from live APIs.
 *
 * Rule for every live source: fetch → validate with the shared Zod schema → writeCache →
 * merge with seed data. On ANY failure: log `[sources] ...`, then use the cache, then seed only.
 * In DATA_MODE=mock (the default) nothing leaves the laptop.
 */

/** Live results are reused for this long before GDELT is asked again (it is rate-limited). */
const FRESH_MS = 30 * 60_000

type CachedFeed = { fetchedAt: number; items: NewsHeadline[] }

/** What to search for: the country's name, or (for the global feed) the countries with the most severe events. */
function queryFor(countryId?: CountryId) {
  if (countryId) {
    const country = store.getCountry(countryId)
    return country ? `"${country.name}"` : undefined
  }
  const hotspots = [
    ...new Set(store.getEvents().flatMap((e) => (e.severity >= 4 ? e.countryIds : []))),
  ]
    .map((id) => store.getCountry(id)?.name)
    .filter(Boolean)
    .slice(0, 3)
  return hotspots.length ? `(${hotspots.map((n) => `"${n}"`).join(' OR ')})` : undefined
}

/** Seed headlines first (curated, event-linked), then live ones; duplicates by URL removed; newest first. */
function merge(seed: NewsHeadline[], live: NewsHeadline[]) {
  const seen = new Set(seed.map((n) => n.url))
  return [...seed, ...live.filter((n) => !seen.has(n.url) && seen.add(n.url))].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  )
}

const cacheKey = (countryId?: CountryId) => `news-${countryId ?? 'global'}`
const refreshing = new Map<string, Promise<void>>()

/**
 * Fetches live headlines and saves them to the cache. Never throws: failures are logged and the
 * old cache stays. Concurrent calls for the same feed share one request.
 */
export function refreshNewsFeed(countryId?: CountryId): Promise<void> {
  const key = cacheKey(countryId)
  const query = queryFor(countryId)
  if (!query) return Promise.resolve()
  const pending = refreshing.get(key)
  if (pending) return pending
  const run = fetchGdeltHeadlines(query, countryId ? [countryId] : [])
    .then((items) => writeCache(key, { fetchedAt: Date.now(), items } satisfies CachedFeed))
    .catch((err) => console.warn(`[sources] live news for ${countryId ?? 'global'} failed:`, err))
    .finally(() => refreshing.delete(key))
  refreshing.set(key, run)
  return run
}

/**
 * Headlines for a country (or the world). Answers immediately: curated seed + whatever live
 * headlines are cached. If the cache is missing or older than 30 min, a refresh starts in the
 * background, so GDELT's slowness never delays the UI.
 */
export async function getNewsFeed(countryId?: CountryId): Promise<NewsHeadline[]> {
  const seed = store.getNews(countryId)
  if (env.DATA_MODE === 'mock') return seed

  const cached = await readCache<CachedFeed>(cacheKey(countryId))
  if (!cached || Date.now() - cached.fetchedAt >= FRESH_MS) void refreshNewsFeed(countryId)
  return merge(seed, cached?.items ?? [])
}

/**
 * Live mode only: fetch every feed once at startup (queued to respect GDELT's rate limit, ~6 s each),
 * so live headlines are ready and cached before the demo starts.
 */
export async function warmLiveNews(): Promise<void> {
  if (env.DATA_MODE !== 'live') return
  const feeds: (CountryId | undefined)[] = [undefined, ...store.getCountries().map((c) => c.id)]
  console.log(`[sources] warming live news for ${feeds.length} feeds in the background`)
  for (const countryId of feeds) await refreshNewsFeed(countryId)
  console.log('[sources] live news warm-up finished')
}
