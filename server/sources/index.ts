import type { CountryId, NewsHeadline } from '@shared'
import { store } from '../data/store'
import { env } from '../env'

/**
 * Live-data layer. Routes ask this module for data that may come from live APIs.
 *
 * Rule for every live source: fetch → validate with the shared Zod schema → writeCache →
 * merge with seed data. On ANY failure: log `[sources] ...`, then return readCache ?? seed.
 * In DATA_MODE=mock (the default) nothing leaves the laptop.
 */
export async function getNewsFeed(countryId?: CountryId): Promise<NewsHeadline[]> {
  const seed = store.getNews(countryId)
  if (env.DATA_MODE === 'mock') return seed
  // Live news enrichment is task ORB-HAR-03 (see tasks.json). Until then live mode serves seed data.
  return seed
}
