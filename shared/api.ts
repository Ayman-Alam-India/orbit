import { z } from 'zod'
import type { CountryId, EventId, InsightSubjectType, OrbitEventKind } from './schemas'

const query = (params: Record<string, string | undefined>) => {
  const entries = Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}

/**
 * Every API path in one place. The frontend and server both use these, so a path
 * can never be spelled two different ways. See docs/API.md for shapes and examples.
 */
export const API_ROUTES = {
  health: '/api/health',
  countries: '/api/countries',
  country: (id: CountryId) => `/api/countries/${id}`,
  countryEvents: (id: CountryId) => `/api/countries/${id}/events`,
  countryTimeline: (id: CountryId) => `/api/countries/${id}/timeline`,
  events: (kind?: OrbitEventKind) => (kind ? `/api/events?kind=${kind}` : '/api/events'),
  event: (id: EventId) => `/api/events/${id}`,
  /** Events ORBIT detected in live headlines by itself (origin "auto", unverified). */
  autoEvents: '/api/events/auto',
  /** Runs a detection scan now instead of waiting for the background one. */
  scanEvents: '/api/events/scan',
  news: (countryId?: CountryId) => (countryId ? `/api/news?countryId=${countryId}` : '/api/news'),
  sources: '/api/sources',
  insight: (subjectType: InsightSubjectType, subjectId: string) =>
    `/api/insights/${subjectType}/${subjectId}`,
  ask: '/api/ask',
  /** POST { text } → audio/wav (the narrator's voice), or a 503 error when no voice is available. */
  speech: '/api/speech',
  verify: (subjectType: InsightSubjectType, subjectId: string) =>
    `/api/verify/${subjectType}/${subjectId}`,
  markets: (countryId?: CountryId) => `/api/markets${query({ countryId })}`,
  impacts: (filter: { eventId?: EventId; countryId?: CountryId } = {}) =>
    `/api/impacts${query(filter)}`,
  weather: (countryId: CountryId) => `/api/weather/${countryId}`,
  scenarios: '/api/scenarios',
  simulate: (scenarioId: string, brentPct: number) =>
    `/api/simulate${query({ scenario: scenarioId, brentPct: String(brentPct) })}`,
} as const

/** Successful responses always look like `{ "data": ... }`. */
export type ApiSuccess<T> = { data: T }

export const ApiErrorCodeSchema = z.enum(['NOT_FOUND', 'VALIDATION', 'UPSTREAM', 'INTERNAL'])

/** Failed responses always look like `{ "error": { "code", "message" } }` with a 4xx/5xx status. */
export const ApiErrorBodySchema = z.object({
  error: z.object({ code: ApiErrorCodeSchema, message: z.string() }),
})

export const DataModeSchema = z.enum(['mock', 'live'])

/** GET /api/health */
export const HealthStatusSchema = z.object({
  status: z.literal('ok'),
  dataMode: DataModeSchema,
  aiProvider: z.string(),
})

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>
export type DataMode = z.infer<typeof DataModeSchema>
export type HealthStatus = z.infer<typeof HealthStatusSchema>
