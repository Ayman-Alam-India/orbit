import {
  AIInsightSchema,
  AskAnswerSchema,
  GLOBAL_SUBJECT_ID,
  type AIInsight,
  type AskAnswer,
  type AskRequest,
  type ImpactLink,
  type InsightSubjectType,
  type OrbitEvent,
} from '@shared'
import { store } from '../data/store'
import { env } from '../env'
import { notFound } from '../http'
import { getAutoEvent, getAutoEvents } from '../ingest/events'
import { simulate } from '../sim/simulate'
import { getNewsFeed } from '../sources'
import { readCache, writeCache } from '../sources/cache'
import { readLiveWorld } from '../sources/liveWorld'
import { getMarkets } from '../sources/markets'
import { googleProvider } from './providers/google'
import { mockProvider } from './providers/mock'
import type { AiContext, AiProvider } from './types'

/** The one entry point for AI. Routes never talk to a provider directly. */
function selectedProvider(): AiProvider {
  if (env.AI_PROVIDER === 'google') {
    if (env.GOOGLE_GENERATIVE_AI_API_KEY) return googleProvider
    console.warn('[ai] AI_PROVIDER=google but GOOGLE_GENERATIVE_AI_API_KEY is empty; using mock')
  }
  return mockProvider
}

export const activeProviderName = () => selectedProvider().name

/** A curated event, or one ORBIT detected in live headlines itself (origin "auto"). */
async function findEvent(id: string): Promise<OrbitEvent | undefined> {
  return store.getEvent(id) ?? (await getAutoEvent(id))
}

/** How many live headlines a briefing sees (newest first). */
const LIVE_NEWS_IN_CONTEXT = 25

/**
 * What the live pipeline knows about a country (or the world): WHO signals and detected events,
 * the newest headlines and the ripples ORBIT found. Empty in mock mode or before the first pass.
 */
async function liveExtras(countryId?: string) {
  const [events, world, news] = await Promise.all([
    getAutoEvents(),
    readLiveWorld(),
    getNewsFeed(countryId as Parameters<typeof getNewsFeed>[0]),
  ])
  const touches = (ids: string[]) => !countryId || ids.includes(countryId)
  const liveEvents = events.filter((e) => touches(e.countryIds))
  const ids = new Set(liveEvents.map((e) => e.id))
  return {
    events: liveEvents,
    news: news.slice(0, LIVE_NEWS_IN_CONTEXT),
    impacts: (world?.ripples ?? []).filter(
      (l) => ids.has(l.eventId) || (l.target.kind === 'country' && touches([l.target.id])),
    ),
  }
}

/** Collects the data an answer should be based on. Unknown IDs become 404s. */
export async function buildContext(
  subjectType: InsightSubjectType,
  subjectId: string,
): Promise<AiContext> {
  const sources = store.getSources()
  if (subjectType === 'global') {
    if (subjectId !== GLOBAL_SUBJECT_ID) throw notFound(`Global subject "${subjectId}"`)
    const live = await liveExtras()
    return withRipples(
      {
        countries: store.getCountries(),
        events: [...store.getEvents(), ...live.events],
        news: live.news,
        sources,
      },
      [...store.getImpacts(), ...live.impacts],
    )
  }
  if (subjectType === 'country') {
    const country = store.getCountries().find((c) => c.id === subjectId)
    if (!country) throw notFound(`Country "${subjectId}"`)
    const live = await liveExtras(country.id)
    return withRipples(
      {
        countries: [country],
        events: [...store.getEventsByCountry(country.id), ...live.events],
        news: live.news,
        sources,
      },
      [...store.getImpacts({ countryId: country.id }), ...live.impacts],
    )
  }
  const event = await findEvent(subjectId)
  if (!event) throw notFound(`Event "${subjectId}"`)
  // An auto-detected event is based on live headlines: give the model exactly those.
  const headlineUrls = new Set(event.headlineUrls ?? [])
  const liveNews = headlineUrls.size
    ? (await getNewsFeed()).concat(
        ...(await Promise.all(event.countryIds.map((id) => getNewsFeed(id)))),
      )
    : []
  const news = [
    ...store.getNews().filter((n) => n.eventId === event.id),
    ...new Map(liveNews.filter((n) => headlineUrls.has(n.url)).map((n) => [n.url, n])).values(),
  ]
  return withRipples(
    {
      countries: store.getCountries().filter((c) => event.countryIds.includes(c.id)),
      events: [event],
      news,
      sources,
    },
    store.getImpacts({ eventId: event.id }),
  )
}

/**
 * Adds ripple effects to a context: the links themselves, the market figures they point to, and the
 * events that cause them (so a question about India also sees the Red Sea crisis that affects it).
 */
function withRipples(
  base: Omit<AiContext, 'impacts' | 'markets'>,
  impacts: ImpactLink[],
): AiContext {
  const marketIds = new Set(
    impacts.flatMap((i) => [i.marketId, i.target.kind === 'market' ? i.target.id : undefined]),
  )
  const causes = impacts
    .map((i) => store.getEvent(i.eventId))
    .filter((e): e is OrbitEvent => Boolean(e) && !base.events.some((b) => b.id === e?.id))
  return {
    ...base,
    events: [...base.events, ...new Map(causes.map((e) => [e.id, e])).values()],
    impacts,
    markets: store.getMarkets().filter((m) => marketIds.has(m.id)),
  }
}

/**
 * Runs the real provider and validates its output. Successful real answers are saved to the disk
 * cache (when a cacheKey is given). On any failure: the cached answer if there is one, then mock.
 * So once an insight has been seen online, the demo shows the same real text with wifi off.
 */
async function withFallback<T>(
  label: string,
  run: (provider: AiProvider) => Promise<unknown>,
  validate: (value: unknown) => T,
  cacheKey?: string,
): Promise<T> {
  const provider = selectedProvider()
  try {
    const result = validate(await run(provider))
    if (cacheKey && provider !== mockProvider) {
      await writeCache(cacheKey, result).catch((err) =>
        console.warn('[ai] cache write failed', err),
      )
    }
    return result
  } catch (err) {
    if (provider === mockProvider) throw err
    const cached = cacheKey ? await readCache<unknown>(cacheKey) : undefined
    const fromCache = cached === undefined ? undefined : safeValidate(validate, cached)
    if (fromCache !== undefined) {
      console.warn(`[ai] ${provider.name} ${label} failed, serving cached answer:`, err)
      return fromCache
    }
    console.warn(`[ai] ${provider.name} ${label} failed, falling back to mock:`, err)
    return validate(await run(mockProvider))
  }
}

/** A cached file that no longer matches the contract is ignored rather than served. */
function safeValidate<T>(validate: (value: unknown) => T, value: unknown): T | undefined {
  try {
    return validate(value)
  } catch {
    return undefined
  }
}

/** A real-model insight is reused for this long: the same text is shown and verified, and quota is saved. */
const INSIGHT_FRESH_MS = 30 * 60_000

export async function generateInsight(
  subjectType: InsightSubjectType,
  subjectId: string,
): Promise<AIInsight> {
  const context = await buildContext(subjectType, subjectId)
  const cacheKey = `ai-insight-${subjectType}-${subjectId.toLowerCase()}`
  const provider = selectedProvider()
  if (provider !== mockProvider) {
    const cached = AIInsightSchema.safeParse(await readCache(cacheKey))
    const age = cached.success ? Date.now() - Date.parse(cached.data.generatedAt) : Infinity
    if (cached.success && cached.data.provider === provider.name && age < INSIGHT_FRESH_MS) {
      return cached.data
    }
  }
  return withFallback(
    'insight',
    (p) => p.generateInsight({ subjectType, subjectId, context }),
    (v) => AIInsightSchema.parse(v),
    cacheKey,
  )
}

export async function askOrbit(request: AskRequest): Promise<AskAnswer> {
  const { eventId, simulation } = request.context ?? {}
  // Full briefing so "pollution in India" still works while the globe is on another event.
  // Unknown event ids still 404 (the open card must be real); auto-detected events count as real.
  const openEvent = eventId ? await findEvent(eventId) : undefined
  if (eventId && !openEvent) throw notFound(`Event "${eventId}"`)
  const context = await buildContext('global', GLOBAL_SUBJECT_ID)
  if (openEvent && !context.events.some((e) => e.id === openEvent.id))
    context.events = [openEvent, ...context.events]
  if (simulation)
    context.simulation = await simulationFor(simulation.scenarioId, simulation.brentPct)
  return withFallback(
    'ask',
    (p) => p.ask(request, context),
    (v) => AskAnswerSchema.parse(v),
  )
}

/** The what-if result the user is looking at, for Ask ORBIT on the simulator page. */
async function simulationFor(scenarioId: string, brentPct: number) {
  const scenario = store.getScenario(scenarioId)
  if (!scenario) throw notFound(`Scenario "${scenarioId}"`)
  const markets = await getMarkets()
  const find = (id: string) => markets.find((m) => m.id === id)
  const brent = find('mkt_brent')
  const usdInr = find('mkt_usd_inr')
  if (!brent || !usdInr) return undefined
  return simulate({ scenario, brentPct, brent, usdInr, petrol: find('mkt_petrol_delhi') })
}
