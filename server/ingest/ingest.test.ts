// @vitest-environment node
import type { NewsHeadline } from '@shared'
import { describe, expect, it, vi } from 'vitest'
import { GDELT_SOURCE_ID } from '../sources/gdelt'
import { classifyHeadlines, mentionsCountry, numbersGrounded } from './classify'

// The live feed is replaced by fixed headlines, so detection is tested without touching GDELT.
const headlines = vi.hoisted(() => [] as unknown[])
vi.mock('../sources', () => ({
  getNewsFeed: async (countryId?: string) => (countryId === 'IND' ? headlines : []),
}))

const { scanForAutoEvents } = await import('./events')

const headline = (title: string, url: string, ago = 1): NewsHeadline => ({
  id: `news_${url.slice(-6)}`,
  title,
  url: `https://example.org/${url}`,
  sourceId: GDELT_SOURCE_ID,
  publisher: 'Example Wire',
  publishedAt: new Date(Date.now() - ago * 3600_000).toISOString(),
  countryIds: ['IND'],
})

describe('classifying headlines', () => {
  it('recognises the kind of event and raises severity for casualties', () => {
    const [conflict] = classifyHeadlines([headline('Missile strike hits port, dozens killed', 'a')])
    expect(conflict).toMatchObject({ kind: 'geopolitical', label: 'conflict', severity: 5 })
    const [health] = classifyHeadlines([headline('Cholera outbreak spreads in the north', 'b')])
    expect(health).toMatchObject({ kind: 'health', label: 'outbreak', severity: 4 })
  })

  it('skips headlines that match nothing instead of guessing', () => {
    expect(classifyHeadlines([headline('Local museum reopens after refurbishment', 'c')])).toEqual(
      [],
    )
  })

  it('groups headlines that tell the same story', () => {
    const candidates = classifyHeadlines([
      headline('Missile strike hits Mumbai port terminal', 'd'),
      headline('Second missile strike reported at Mumbai port', 'e'),
      headline('Trade summit opens in New Delhi', 'f'),
    ])
    expect(candidates).toHaveLength(2)
    expect(candidates[0].headlines).toHaveLength(2)
  })

  it('matches whole words only: "Anwar" is not a war, "deadline" is not a death', () => {
    expect(
      classifyHeadlines([headline('Anwar meets Gandhi over breakfast in New Delhi', 'w')]),
    ).toEqual([])
    const [candidate] = classifyHeadlines([
      headline('Missile strike hits port before deadline', 'x'),
    ])
    expect(candidate.severity).toBe(4) // not escalated to 5 by "deadline"
  })

  it('only files a headline under a country it actually names', () => {
    const india = { id: 'IND', name: 'India', capital: 'New Delhi' }
    expect(mentionsCountry('Cyclone floods coastal districts of India', india)).toBe(true)
    expect(mentionsCountry('Cyclone floods coastal districts', india)).toBe(false)
  })

  it('rejects a summary that contains a figure the headlines do not', () => {
    const evidence = [headline('Floods displace 2,000 people', 'g')]
    expect(numbersGrounded('Floods displaced 2,000 people.', evidence)).toBe(true)
    expect(numbersGrounded('Floods displaced 9,000 people.', evidence)).toBe(false)
  })
})

describe('scanning the live feed', () => {
  it('builds a valid, clearly unverified event from live headlines', async () => {
    headlines.length = 0
    headlines.push(headline('Cyclone floods coastal districts in India, thousands evacuated', 'h'))
    const [event, ...rest] = await scanForAutoEvents()
    expect(rest).toHaveLength(0)
    expect(event).toMatchObject({
      origin: 'auto',
      countryIds: ['IND'],
      sourceIds: [GDELT_SOURCE_ID],
      tags: ['disaster', 'auto-detected'],
    })
    expect(event.id).toMatch(/^evt_auto_[a-z0-9]+$/)
    // No AI key in tests: the summary quotes the headline rather than inventing prose.
    expect(event.summary).toContain('Cyclone floods coastal districts in India')
    expect(event.summary).toContain('has not verified it')
    expect(event.headlineUrls).toEqual(['https://example.org/h'])
  })

  it('leaves curated events alone: a headline about one is not detected again', async () => {
    headlines.length = 0
    // The fixture dataset already has "Dengue cases rise after late monsoon" for India.
    headlines.push(headline('Dengue cases rise sharply after the late monsoon', 'i'))
    expect(await scanForAutoEvents()).toEqual([])
  })

  it('ignores headlines that are too old to be news', async () => {
    headlines.length = 0
    headlines.push(headline('Missile strike hits port in India', 'j', 24 * 45))
    expect(await scanForAutoEvents()).toEqual([])
  })
})
