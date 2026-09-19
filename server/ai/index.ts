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
function buildContext(subjectType: InsightSubjectType, subjectId: string): AiContext {
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

/** Runs the real provider, validates its output, and falls back to mock on any failure. */
async function withFallback<T>(
  label: string,
  run: (provider: AiProvider) => Promise<unknown>,
  validate: (value: unknown) => T,
): Promise<T> {
  const provider = selectedProvider()
  try {
    return validate(await run(provider))
  } catch (err) {
    if (provider === mockProvider) throw err
    console.warn(`[ai] ${provider.name} ${label} failed, falling back to mock:`, err)
    return validate(await run(mockProvider))
  }
}

export function generateInsight(
  subjectType: InsightSubjectType,
  subjectId: string,
): Promise<AIInsight> {
  const context = buildContext(subjectType, subjectId)
  return withFallback(
    'insight',
    (p) => p.generateInsight({ subjectType, subjectId, context }),
    (v) => AIInsightSchema.parse(v),
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
