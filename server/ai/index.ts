import {
  AIInsightSchema,
  AskAnswerSchema,
  GLOBAL_SUBJECT_ID,
  type AIInsight,
  type AskAnswer,
  type AskRequest,
  type InsightSubjectType,
} from '@shared'
import { store } from '../data/store'
import { env } from '../env'
import { notFound } from '../http'
import { readCache, writeCache } from '../sources/cache'
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

/** Collects the seed data an answer should be based on. Unknown IDs become 404s. */
export function buildContext(subjectType: InsightSubjectType, subjectId: string): AiContext {
  const sources = store.getSources()
  if (subjectType === 'global') {
    if (subjectId !== GLOBAL_SUBJECT_ID) throw notFound(`Global subject "${subjectId}"`)
    return {
      countries: store.getCountries(),
      events: store.getEvents(),
      news: store.getNews(),
      sources,
    }
  }
  if (subjectType === 'country') {
    const country = store.getCountries().find((c) => c.id === subjectId)
    if (!country) throw notFound(`Country "${subjectId}"`)
    return {
      countries: [country],
      events: store.getEventsByCountry(country.id),
      news: store.getNews(country.id),
      sources,
    }
  }
  const event = store.getEvent(subjectId)
  if (!event) throw notFound(`Event "${subjectId}"`)
  return {
    countries: store.getCountries().filter((c) => event.countryIds.includes(c.id)),
    events: [event],
    news: store.getNews().filter((n) => n.eventId === event.id),
    sources,
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
  const context = buildContext(subjectType, subjectId)
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

export function askOrbit(request: AskRequest): Promise<AskAnswer> {
  const { countryId, eventId } = request.context ?? {}
  const context = eventId
    ? buildContext('event', eventId)
    : countryId
      ? buildContext('country', countryId)
      : buildContext('global', GLOBAL_SUBJECT_ID)
  return withFallback(
    'ask',
    (p) => p.ask(request, context),
    (v) => AskAnswerSchema.parse(v),
  )
}
