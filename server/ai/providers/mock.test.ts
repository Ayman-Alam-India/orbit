// @vitest-environment node
import type { OrbitEvent } from '@shared'
import { describe, expect, it } from 'vitest'
import { topEvents } from './mock'

const event = (
  id: string,
  occurredAt: string,
  severity: number,
  status?: 'verified' | 'unverified',
) =>
  ({
    kind: 'geopolitical',
    id,
    title: id,
    summary: id,
    countryIds: ['IND'],
    location: { lat: 0, lng: 0 },
    occurredAt,
    severity,
    sourceIds: [],
    tags: [],
    origin: 'curated',
    category: 'x',
    actors: [],
    ...(status
      ? {
          trust: {
            status,
            outlets: [],
            aiCheck: 'unavailable',
            reason: 'x',
            checkedAt: occurredAt,
          },
        }
      : {}),
  }) as OrbitEvent

describe('briefings lead with what is current', () => {
  const now = Date.parse('2026-11-03T12:00:00Z')

  it('puts recent events before older, more severe ones', () => {
    const old = event('evt_september', '2026-09-14T00:00:00Z', 5)
    const fresh = event('evt_today', '2026-11-03T08:00:00Z', 3, 'verified')
    expect(topEvents([old, fresh], now).map((e) => e.id)).toEqual(['evt_today'])
  })

  it('never leads with an unconfirmed detection, and falls back to older events when nothing is new', () => {
    const rumour = event('evt_rumour', '2026-11-03T09:00:00Z', 5, 'unverified')
    const old = event('evt_september', '2026-09-14T00:00:00Z', 4)
    expect(topEvents([rumour, old], now).map((e) => e.id)).toEqual(['evt_september'])
  })
})
