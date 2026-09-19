// @vitest-environment node
import {
  API_ROUTES,
  ApiErrorBodySchema,
  ImpactLinkSchema,
  MarketQuoteSchema,
  WeatherReportSchema,
} from '@shared'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { store } from './data/store'
import { fetchYahooQuote } from './sources/markets'
import { describeWeatherCode } from './sources/weather'
import { startTestServer } from './testServer'

let server: Awaited<ReturnType<typeof startTestServer>>
beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  server = await startTestServer()
})
afterAll(() => server.close())
afterEach(() => vi.unstubAllGlobals())

const get = async (path: string) => {
  const res = await fetch(server.baseUrl + path)
  return { status: res.status, body: (await res.json()) as { data?: unknown; error?: unknown } }
}

describe('ripple effects API', () => {
  it('filters links by event', async () => {
    const { body } = await get(API_ROUTES.impacts({ eventId: 'evt_usa_tariff_review' }))
    const links = z.array(ImpactLinkSchema).parse(body.data)
    expect(links.map((l) => l.id)).toEqual(['imp_tariff_review_brent', 'imp_tariff_review_india'])
  })

  it('finds links that touch a country directly or through one of its markets', async () => {
    const { body } = await get(API_ROUTES.impacts({ countryId: 'IND' }))
    const links = z.array(ImpactLinkSchema).parse(body.data)
    expect(links.map((l) => l.id)).toContain('imp_tariff_review_india')
  })
})

describe('markets API', () => {
  it('serves the curated snapshot in mock mode', async () => {
    const { body } = await get(API_ROUTES.markets())
    const quotes = z.array(MarketQuoteSchema).parse(body.data)
    expect(quotes.every((q) => !q.live)).toBe(true)
    const india = z.array(MarketQuoteSchema).parse((await get(API_ROUTES.markets('IND'))).body.data)
    expect(india.map((q) => q.id)).toEqual(['mkt_usd_inr'])
  })

  it('maps a Yahoo Finance chart into a live quote with history', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: { regularMarketPrice: 81.234, regularMarketTime: 1_789_800_000 },
                  timestamp: [1_789_600_000, 1_789_700_000],
                  indicators: { quote: [{ close: [79.5, 81.234] }] },
                },
              ],
            },
          }),
        ),
      ),
    )
    const quote = await fetchYahooQuote(store.getMarket('mkt_brent')!)
    expect(quote).toMatchObject({ value: 81.23, previousClose: 79.5, live: true })
    expect(quote.history).toHaveLength(2)
  })
})

describe('weather API', () => {
  it('explains that live weather is off in mock mode', async () => {
    const { status, body } = await get(API_ROUTES.weather('IND'))
    expect(status).toBe(503)
    expect(ApiErrorBodySchema.parse(body).error.code).toBe('UPSTREAM')
  })

  it('names WMO weather codes', () => {
    expect(describeWeatherCode(0)).toBe('Clear sky')
    expect(describeWeatherCode(63)).toBe('Rain')
    expect(describeWeatherCode(95)).toBe('Thunderstorm')
  })

  it('weather reports follow the shared contract', () => {
    expect(
      WeatherReportSchema.safeParse({
        countryId: 'IND',
        place: 'New Delhi',
        location: { lat: 28.6, lng: 77.2 },
        current: {
          temperatureC: 31,
          precipitationMm: 0,
          windKmh: 9,
          weatherCode: 1,
          description: 'Partly cloudy',
        },
        daily: [{ date: '2026-09-19T00:00:00Z', maxC: 34, minC: 26, precipitationMm: 2 }],
        asOf: '2026-09-19T10:00:00Z',
        sourceId: 'src_open_meteo',
      }).success,
    ).toBe(true)
  })
})
