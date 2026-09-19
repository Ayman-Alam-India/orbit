// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  ApiErrorBodySchema,
  API_ROUTES,
  CountryIdSchema,
  EventIdSchema,
  IsoDateTimeSchema,
  OrbitEventSchema,
  SeveritySchema,
} from '.'

const baseEvent = {
  title: 'Test',
  summary: 'Test event',
  countryIds: ['IND'],
  location: { lat: 1, lng: 2 },
  occurredAt: '2026-09-19T10:00:00Z',
  severity: 3,
  sourceIds: ['src_test'],
  tags: [],
}

describe('shared contracts', () => {
  it('country IDs are uppercase alpha-3', () => {
    expect(CountryIdSchema.safeParse('IND').success).toBe(true)
    expect(CountryIdSchema.safeParse('ind').success).toBe(false)
    expect(CountryIdSchema.safeParse('IN').success).toBe(false)
  })

  it('event IDs need the evt_ or hs_ prefix and a lowercase slug', () => {
    expect(EventIdSchema.safeParse('evt_ind_trade').success).toBe(true)
    expect(EventIdSchema.safeParse('hs_bra_heat').success).toBe(true)
    expect(EventIdSchema.safeParse('event-1').success).toBe(false)
    expect(EventIdSchema.safeParse('evt_Bad_Case').success).toBe(false)
  })

  it('dates must be ISO 8601 UTC', () => {
    expect(IsoDateTimeSchema.safeParse('2026-09-19T10:00:00Z').success).toBe(true)
    expect(IsoDateTimeSchema.safeParse('19/09/2026').success).toBe(false)
  })

  it('severity is an integer from 1 to 5', () => {
    expect(SeveritySchema.safeParse(5).success).toBe(true)
    expect(SeveritySchema.safeParse(0).success).toBe(false)
    expect(SeveritySchema.safeParse(2.5).success).toBe(false)
  })

  it('OrbitEvent uses `kind` to pick the right shape', () => {
    const geo = { ...baseEvent, kind: 'geopolitical', id: 'evt_x', category: 'trade', actors: [] }
    const health = { ...baseEvent, kind: 'health', id: 'hs_x', indicator: 'Cases' }
    expect(OrbitEventSchema.safeParse(geo).success).toBe(true)
    expect(OrbitEventSchema.safeParse(health).success).toBe(true)
    // A health signal must use the hs_ prefix, not evt_.
    expect(OrbitEventSchema.safeParse({ ...health, id: 'evt_x' }).success).toBe(false)
    // A geopolitical event without its own fields is rejected.
    expect(
      OrbitEventSchema.safeParse({ ...baseEvent, kind: 'geopolitical', id: 'evt_x' }).success,
    ).toBe(false)
  })

  it('error envelope and routes have one shape', () => {
    expect(
      ApiErrorBodySchema.safeParse({ error: { code: 'NOT_FOUND', message: 'x' } }).success,
    ).toBe(true)
    expect(API_ROUTES.countryEvents('IND')).toBe('/api/countries/IND/events')
    expect(API_ROUTES.news()).toBe('/api/news')
  })
})
