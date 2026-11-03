// @vitest-environment node
import {
  AIInsightSchema,
  API_ROUTES,
  ApiErrorBodySchema,
  AskAnswerSchema,
  CountrySchema,
  HealthStatusSchema,
  NewsRefreshResultSchema,
  PipelineStatusSchema,
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

  it('POST /api/news/refresh stays offline in mock mode', async () => {
    const refresh = (body: unknown) =>
      fetch(server.baseUrl + API_ROUTES.newsRefresh, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    const res = await refresh({ countryId: 'IND' })
    expect(res.status).toBe(200)
    const result = NewsRefreshResultSchema.parse(((await res.json()) as { data: unknown }).data)
    expect(result.refreshed).toBe(false)
    expect(result.headlines.length).toBeGreaterThan(0)

    expect((await refresh({ countryId: 'india' })).status).toBe(400)
    expect((await refresh({ countryId: 'XXX' })).status).toBe(404)
  })

  it('GET /api/status reports offline data in mock mode', async () => {
    const { status, body } = await get(API_ROUTES.status)
    expect(status).toBe(200)
    expect(PipelineStatusSchema.parse(body.data)).toMatchObject({
      dataMode: 'mock',
      aiCheckers: [],
      sources: [],
    })
  })

  it('POST /api/trust/check refuses to go online in mock mode', async () => {
    const check = (body: unknown) =>
      fetch(server.baseUrl + API_ROUTES.trustCheck, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    expect((await check({ kind: 'headline', id: 'news_x' })).status).toBe(503)
    expect((await check({ kind: 'rumour', id: 'x' })).status).toBe(400)
  })

  it('GET /api/news/:id/media only looks up known headlines, and stays offline in mock mode', async () => {
    expect((await get(API_ROUTES.newsMedia('news_ind_usa_chip_deal'))).status).toBe(503)
    expect((await get(API_ROUTES.newsMedia('news_unknown'))).status).toBe(404)
    expect((await get('/api/news/not-an-id/media')).status).toBe(400)
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
