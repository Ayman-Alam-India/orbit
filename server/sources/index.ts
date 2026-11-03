import type { CountryId, NewsHeadline, NewsRefreshResult } from '@shared'
import { store } from '../data/store'
import { env } from '../env'
import { readCache, writeCache } from './cache'
import { fetchGdeltHeadlines } from './gdelt'
import { fetchGoogleNews } from './googleNews'
import { readLiveWorld } from './liveWorld'
import { curatedTrust } from './trustRules'

/**
 * Live-data layer. Routes ask this module for data that may come from live APIs.
 *
 * Rule for every live source: fetch → validate with the shared Zod schema → writeCache →
 * merge with seed data. On ANY failure: log `[sources] ...`, then use the cache, then seed only.
 * In DATA_MODE=mock (the default) nothing leaves the laptop.
 */

/** A feed older than this is refreshed; the background loop also re-fetches every feed this often. */
export const NEWS_FRESH_MS = 10 * 60_000
/** Gap between feeds in the background loop, so Google News sees a gentle trickle (~1 min per pass). */
export const newsLoop = { gapMs: 1_000 }
/**
 * How long a refresh button click waits. Google News answers in about a second; the limit only
 * matters when it fails and the (slow, rate-limited) GDELT fallback is tried.
 */
export const refreshTimeout = { ms: 20_000 }

type CachedFeed = { fetchedAt: number; items: NewsHeadline[] }

/** GDELT fallback query: the country's name, or (for the global feed) the countries with the most severe events. */
function gdeltQueryFor(countryId?: CountryId) {
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

/** Every headline carries trust: curated ones are verified; live ones use the pipeline's last rating. */
async function withTrust(seed: NewsHeadline[], live: NewsHeadline[]) {
  const ratings = live.length ? (await readLiveWorld())?.headlineTrust : undefined
  const verified = curatedTrust()
  return merge(
    seed.map((n) => ({ ...n, trust: verified })),
    live.map((n) => (ratings?.[n.url] ? { ...n, trust: ratings[n.url] } : n)),
  )
}

const cacheKey = (countryId?: CountryId) => `news-${countryId ?? 'global'}`
const refreshing = new Map<string, Promise<boolean>>()

/** Google News first; GDELT only when Google fails (GDELT is slow and rate-limited). Throws when both fail. */
async function fetchLiveHeadlines(countryId?: CountryId): Promise<NewsHeadline[]> {
  const countryIds = countryId ? [countryId] : []
  const name = countryId ? store.getCountry(countryId)?.name : undefined
  try {
    return await fetchGoogleNews(name, countryIds)
  } catch (err) {
    console.warn(`[sources] Google News for ${countryId ?? 'global'} failed, trying GDELT:`, err)
    const query = gdeltQueryFor(countryId)
    if (!query) throw err
    return fetchGdeltHeadlines(query, countryIds)
  }
}

/**
 * Fetches live headlines and saves them to the cache. Resolves true when fresh headlines were
 * saved. Never throws: failures are logged and the old cache stays (an empty answer, e.g. a quiet
 * day for a small country, also keeps the old headlines). Concurrent calls for one feed share a request.
 */
export function refreshNewsFeed(countryId?: CountryId): Promise<boolean> {
  const key = cacheKey(countryId)
  if (countryId && !store.getCountry(countryId)) return Promise.resolve(false)
  const pending = refreshing.get(key)
  if (pending) return pending
  const run = fetchLiveHeadlines(countryId)
    .then(async (items) => {
      if (!items.length) return false
      await writeCache(key, { fetchedAt: Date.now(), items } satisfies CachedFeed)
      return true
    })
    .catch((err) => {
      console.warn(`[sources] live news for ${countryId ?? 'global'} failed:`, err)
      return false
    })
    .finally(() => refreshing.delete(key))
  refreshing.set(key, run)
  return run
}

/**
 * Headlines for a country (or the world). Answers immediately: curated seed + whatever live
 * headlines are cached. If the cache is missing or older than 10 min, a refresh starts in the
 * background, so a slow source never delays the UI.
 */
export async function getNewsFeed(countryId?: CountryId): Promise<NewsHeadline[]> {
  const seed = store.getNews(countryId)
  if (env.DATA_MODE === 'mock') return withTrust(seed, [])

  const cached = await readCache<CachedFeed>(cacheKey(countryId))
  if (!cached || Date.now() - cached.fetchedAt >= NEWS_FRESH_MS) void refreshNewsFeed(countryId)
  return withTrust(seed, cached?.items ?? [])
}

/**
 * The refresh button: asks the live source now and waits (up to refreshTimeout.ms) for the answer.
 * In DATA_MODE=mock nothing leaves the laptop: it answers with the curated headlines and
 * `refreshed: false`. On failure or timeout it answers with the saved headlines.
 */
export async function refreshNews(countryId?: CountryId): Promise<NewsRefreshResult> {
  let refreshed = false
  if (env.DATA_MODE !== 'mock') {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), refreshTimeout.ms)
    })
    refreshed = await Promise.race([refreshNewsFeed(countryId), timeout])
    clearTimeout(timer)
    if (!refreshed)
      console.warn(`[sources] refresh for ${countryId ?? 'global'}: showing saved headlines`)
  }
  const cached =
    env.DATA_MODE === 'mock' ? undefined : await readCache<CachedFeed>(cacheKey(countryId))
  return {
    headlines: await withTrust(store.getNews(countryId), cached?.items ?? []),
    fetchedAt: cached ? new Date(cached.fetchedAt).toISOString() : undefined,
    refreshed,
  }
}

/**
 * One pass over the global feed and every country, one feed at a time (about a minute). The live
 * pipeline (server/ingest/pipeline.ts) runs this first, every 10 min.
 */
export async function refreshAllFeeds() {
  const feeds: (CountryId | undefined)[] = [undefined, ...store.getCountries().map((c) => c.id)]
  let ok = 0
  for (const countryId of feeds) {
    if (await refreshNewsFeed(countryId)) ok++
    await new Promise((resolve) => setTimeout(resolve, newsLoop.gapMs))
  }
  console.log(`[sources] live news: ${ok}/${feeds.length} feeds updated`)
}
