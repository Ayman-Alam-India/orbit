// @vitest-environment node
import {
  AIInsightSchema,
  API_ROUTES,
  ApiErrorBodySchema,
  AskAnswerSchema,
  CountrySchema,
  HealthStatusSchema,
  OrbitEventSchema,
} from '@shared'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { startTestServer } from './testServer'

let server: Awaited<ReturnType<typeof startTestServer>>

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  server = await startTestServer()
})
afterAll(() => server.close())

const get = async (path: string) => {
  const res = await fetch(server.baseUrl + path)
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

describe('API responses match the shared contracts', () => {
  it('GET /api/health', async () => {
    const { status, body } = await get(API_ROUTES.health)
    expect(status).toBe(200)
    expect(HealthStatusSchema.parse(body.data).status).toBe('ok')
  })

  it('GET /api/countries and /api/countries/:id/events', async () => {
    const countries = await get(API_ROUTES.countries)
    expect(z.array(CountrySchema).parse(countries.body.data).length).toBeGreaterThan(0)
    const events = await get(API_ROUTES.countryEvents('IND'))
    const list = z.array(OrbitEventSchema).parse(events.body.data)
    expect(list.every((e) => e.countryIds.includes('IND'))).toBe(true)
  })

  it('GET /api/insights/country/:id returns an explainable insight', async () => {
    const { body } = await get(API_ROUTES.insight('country', 'IND'))
    const insight = AIInsightSchema.parse(body.data)
    expect(insight.provider).toBe('mock')
  })

  it('POST /api/ask answers with context', async () => {
    const res = await fetch(server.baseUrl + API_ROUTES.ask, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is happening?', context: { countryId: 'BRA' } }),
    })
    expect(res.status).toBe(200)
    expect(AskAnswerSchema.parse(((await res.json()) as { data: unknown }).data).answer).toContain(
      'Brazil',
    )
  })

  it('errors use the { error: { code, message } } envelope', async () => {
    const missing = await get(API_ROUTES.country('XXX'))
    expect(missing.status).toBe(404)
    expect(ApiErrorBodySchema.parse(missing.body).error.code).toBe('NOT_FOUND')

    const invalid = await get('/api/countries/india')
    expect(invalid.status).toBe(400)
    expect(ApiErrorBodySchema.parse(invalid.body).error.code).toBe('VALIDATION')

    const unknownRoute = await get('/api/nope')
    expect(unknownRoute.status).toBe(404)
  })
})
