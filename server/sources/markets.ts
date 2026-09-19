import { MarketQuoteSchema, type CountryId, type MarketQuote } from '@shared'
import { store } from '../data/store'
import { env } from '../env'
import { readCache, writeCache } from './cache'

/**
 * Market figures. The curated snapshot (server/data/seed/markets.json) is always the base. In
 * DATA_MODE=live, quotes with a `symbol` are refreshed from Yahoo Finance's public chart endpoint
 * in the background (free, keyless, unofficial) and cached, so a slow or blocked request never
 * delays the UI and the last good values survive going offline. Fuel prices stay curated.
 */
const FRESH_MS = 15 * 60_000
const TIMEOUT_MS = 10_000
const CACHE_KEY = 'markets-live'

type CachedQuotes = { fetchedAt: number; quotes: MarketQuote[] }

type YahooChart = {
  chart?: {
    result?: {
      meta: { regularMarketPrice: number; regularMarketTime: number; currency?: string }
      timestamp?: number[]
      indicators: { quote: { close: (number | null)[] }[] }
    }[]
  }
}

const round = (n: number) => Math.round(n * 100) / 100
const isoSeconds = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z')

/** Updates one curated quote with Yahoo's latest price and 1-month daily history. Throws on failure. */
export async function fetchYahooQuote(base: MarketQuote): Promise<MarketQuote> {
  if (!base.symbol) return base
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(base.symbol)}?range=1mo&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (ORBIT hackathon demo)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Yahoo Finance responded ${res.status} for ${base.symbol}`)
  const result = ((await res.json()) as YahooChart).chart?.result?.[0]
  if (!result) throw new Error(`Yahoo Finance returned no data for ${base.symbol}`)
  const closes = result.indicators.quote[0]?.close ?? []
  const history = (result.timestamp ?? [])
    .map((t, i) => ({ date: `${isoSeconds(t * 1000).slice(0, 10)}T00:00:00Z`, value: closes[i] }))
    .filter((p): p is { date: string; value: number } => typeof p.value === 'number')
    .map((p) => ({ ...p, value: round(p.value) }))
  return MarketQuoteSchema.parse({
    ...base,
    value: round(result.meta.regularMarketPrice),
    previousClose: history.length > 1 ? history[history.length - 2].value : base.previousClose,
    history,
    asOf: isoSeconds(result.meta.regularMarketTime * 1000),
    live: true,
  })
}

let refreshing: Promise<void> | undefined

/** Fetches every live-updatable quote (one at a time) and caches the ones that succeed. Never throws. */
export function refreshMarkets(): Promise<void> {
  refreshing ??= (async () => {
    const quotes: MarketQuote[] = []
    for (const base of store.getMarkets().filter((m) => m.symbol)) {
      try {
        quotes.push(await fetchYahooQuote(base))
      } catch (err) {
        console.warn(
          `[sources] market ${base.id} failed:`,
          err instanceof Error ? err.message : err,
        )
      }
    }
    if (quotes.length)
      await writeCache(CACHE_KEY, { fetchedAt: Date.now(), quotes } satisfies CachedQuotes)
  })().finally(() => (refreshing = undefined))
  return refreshing
}

/** Curated snapshot, with cached live values swapped in where available. Answers immediately. */
export async function getMarkets(countryId?: CountryId): Promise<MarketQuote[]> {
  const base = store.getMarkets(countryId)
  if (env.DATA_MODE === 'mock') return base
  const cached = await readCache<CachedQuotes>(CACHE_KEY)
  if (!cached || Date.now() - cached.fetchedAt >= FRESH_MS) void refreshMarkets()
  const live = new Map((cached?.quotes ?? []).map((q) => [q.id, q]))
  return base.map((m) => {
    const parsed = MarketQuoteSchema.safeParse(live.get(m.id))
    return parsed.success ? parsed.data : m
  })
}
