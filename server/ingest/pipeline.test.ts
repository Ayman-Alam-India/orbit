// @vitest-environment node
import {
  HealthSignalSchema,
  ImpactLinkSchema,
  type Country,
  type NewsHeadline,
  type OrbitEvent,
  type Source,
} from '@shared'
import { describe, expect, it, vi } from 'vitest'
import { readRawSeed } from '../data/store'
import { countriesInTitle, toHealthSignals } from '../sources/who'
import { draftRipples, rulesFor } from './ripples'

const verify = vi.fn()
let configured = 0
vi.mock('../ai/verify', () => ({
  aiVerifiers: () =>
    Array.from({ length: configured }, (_, i) => ({ name: `ai${i}`, verify: verify })),
}))
const cache = new Map<string, unknown>()
vi.mock('../sources/cache', () => ({
  readCache: async (key: string) => cache.get(key),
  writeCache: async (key: string, value: unknown) => void cache.set(key, value),
}))

const { evidenceTrust, liveTrust, outletTrust, storyIndex, isOfficial } = await import('./trust')

// These rules are about the real country list, so they read the curated seed (not the test fixtures).
const seed = readRawSeed('server/data/seed')
const countries = seed.countries as Country[]
const seedSources = seed.sources as Source[]
const headline = (publisher: string, title: string): NewsHeadline => ({
  id: `news_gnews_${publisher.replace(/\W/g, '')}`,
  title,
  url: `https://${publisher}/${encodeURIComponent(title)}`,
  sourceId: 'src_google_news',
  publishedAt: '2026-11-03T09:00:00Z',
  countryIds: [],
  publisher,
})
const sources: Source[] = []

describe('WHO outbreak reports → health signals', () => {
  it('finds countries by WHO formal names without false matches', () => {
    expect(
      countriesInTitle(
        'Ebola disease caused by Bundibugyo virus, Democratic Republic of the Congo, Kenya and Nigeria',
        countries,
      ),
    ).toEqual(['COD', 'KEN', 'NGA'])
    expect(
      countriesInTitle("Avian influenza - Democratic People's Republic of Korea", countries),
    ).toEqual(['PRK'])
    expect(countriesInTitle('Cholera - South Sudan', countries)).toEqual([])
    expect(
      countriesInTitle('Middle East respiratory syndrome - Kingdom of Saudi Arabia', countries),
    ).toEqual(['SAU'])
  })

  it('puts one pin in every affected country, all citing the WHO report', () => {
    const signals = toHealthSignals(
      [
        {
          Title:
            'Ebola disease caused by Bundibugyo virus, Democratic Republic of the Congo, Kenya and Nigeria',
          UrlName: '2026-DON622',
          PublicationDateAndTime: '2026-10-23T15:03:45Z',
          Summary: '<p>Cases continue to rise. Kenya and Nigeria reported imported cases.</p>',
        },
        {
          Title: 'Cholera - Atlantis',
          UrlName: '2026-DON1',
          PublicationDateAndTime: '2026-10-23T00:00:00Z',
        },
        {
          Title: 'Old report - India',
          UrlName: '2025-DON1',
          PublicationDateAndTime: '2025-01-01T00:00:00Z',
        },
      ],
      countries,
      Date.parse('2026-11-03T12:00:00Z'),
    )
    expect(signals.map((s) => [s.id, s.countryIds[0]])).toEqual([
      ['hs_who_2026_don622', 'COD'],
      ['hs_who_2026_don622_ken', 'KEN'],
      ['hs_who_2026_don622_nga', 'NGA'],
    ])
    for (const s of signals) HealthSignalSchema.parse(s)
    expect(signals[0]).toMatchObject({
      severity: 4,
      indicator: 'Ebola disease caused by Bundibugyo virus',
    })
    expect(signals[0].summary).toBe(
      'Cases continue to rise. Kenya and Nigeria reported imported cases.',
    )
    expect(signals[1].location).toEqual(countries.find((c) => c.id === 'KEN')!.centroid)
  })
})

describe('ripple rules', () => {
  const event = (over: Partial<OrbitEvent>): OrbitEvent =>
    ({
      kind: 'geopolitical',
      id: 'evt_auto_x',
      title: 'Tanker attacked near the Strait of Hormuz',
      summary: 'x',
      countryIds: ['IRN'],
      location: { lat: 0, lng: 0 },
      occurredAt: '2026-11-03T09:00:00Z',
      severity: 3,
      sourceIds: [],
      tags: [],
      origin: 'auto',
      category: 'security',
      actors: [],
      ...over,
    }) as OrbitEvent

  it('links a Hormuz event to the countries and markets that depend on it', () => {
    expect(rulesFor(event({})).map((r) => r.id)).toEqual(['hormuz'])
    const drafts = draftRipples([event({})], [], countries, new Set(['mkt_brent']))
    const targets = drafts.map((d) => d.link.target.id)
    expect(targets).toEqual(expect.arrayContaining(['IND', 'CHN', 'JPN', 'QAT', 'mkt_brent']))
    expect(targets).not.toContain('IRN') // never its own country
    for (const d of drafts) {
      expect(ImpactLinkSchema.parse(d.link)).toMatchObject({ origin: 'auto', basis: 'analysis' })
    }
    expect(drafts.find((d) => d.link.target.id === 'IND')!.evidenceQuery).toContain('"India"')
  })

  it('lets the curated link win and skips unknown markets', () => {
    const curated = [
      { ...draftRipples([event({})], [], countries, new Set())[0].link, origin: undefined },
    ]
    const drafts = draftRipples([event({})], curated, countries, new Set())
    expect(drafts.map((d) => d.link.target.id)).not.toContain(curated[0].target.id)
    expect(drafts.map((d) => d.link.target.id)).not.toContain('mkt_brent')
  })

  it('connects the countries of one outbreak and their neighbours', () => {
    const signals = toHealthSignals(
      [
        {
          Title: 'Ebola disease, Democratic Republic of the Congo and Kenya',
          UrlName: '2026-DON9',
          PublicationDateAndTime: '2026-11-01T00:00:00Z',
        },
      ],
      countries,
      Date.parse('2026-11-03T00:00:00Z'),
    )
    const links = draftRipples(signals, [], countries, new Set()).map((d) => d.link)
    expect(links).toContainEqual(
      expect.objectContaining({
        eventId: 'hs_who_2026_don9',
        target: { kind: 'country', id: 'KEN' },
        strength: 3,
      }),
    )
    // Neighbours of DR Congo and Kenya (Uganda) are flagged as spread risks, once each.
    expect(links.filter((l) => l.target.id === 'UGA').length).toBeGreaterThanOrEqual(1)
  })
})

describe('the one trust rule', () => {
  it('needs 3 independent outlets for corroborated', () => {
    expect(outletTrust(['reuters.com', 'b.com']).status).toBe('unverified')
    expect(outletTrust(['reuters.com', 'b.com', 'c.com']).status).toBe('corroborated')
    expect(outletTrust(['reuters.com', 'b.com', 'c.com'], 'disagree').status).toBe('unverified')
    expect(outletTrust(['a.com']).reason).toBe('Reported by 1 independent outlet (needs 3).')
    // Three unknown sites can't confirm a story on their own.
    const unknown = outletTrust(['a.com', 'b.com', 'c.com'])
    expect(unknown.status).toBe('unverified')
    expect(unknown.reason).toContain('none of them an established news organisation')
  })

  it('counts syndicated copies and aggregator republications once', () => {
    const trust = evidenceTrust([
      {
        ...headline('reuters.com', 'Magnitude 6 earthquake strikes off Japan coast'),
        publishedAt: '2026-11-03T08:00:00Z',
      },
      headline('b.com', 'Magnitude 6 earthquake strikes off Japan coast'),
      headline('msn.com', 'Japan quake: magnitude 6 hits the coast'),
      headline('c.com', 'Strong quake shakes northern Japan, no tsunami warning issued'),
    ])
    expect(trust.outlets).toEqual(['reuters.com', 'c.com'])
    expect(trust.established).toEqual(['reuters.com'])
    expect(trust.copies).toBe(2)
    expect(trust.evidence?.find((e) => e.publisher === 'b.com')?.copyOf).toBe('reuters.com')
    expect(trust.evidence?.[0]).toMatchObject({ publisher: 'reuters.com', established: true })
    expect(trust.reason).toContain('2 syndicated copies not counted')
    expect(trust.status).toBe('unverified')
  })

  it('groups headlines that tell the same story', () => {
    const index = storyIndex([
      headline('a.com', 'Port strike halts container traffic in Mumbai'),
      headline('b.com', 'Mumbai port strike halts container shipments'),
      headline('c.com', 'Cricket team wins in Mumbai'),
    ])
    const same = index.sameStory('Strike halts container traffic at Mumbai port')
    expect(same.map((h) => h.publisher)).toEqual(['a.com', 'b.com'])
  })

  it('asks the AI checkers only once 3+ outlets report it, and caches the answer', async () => {
    const evidence = [
      headline('reuters.com', 'Port strike halts Mumbai docks'),
      headline('b.com', 'Mumbai port workers walk out over pay'),
      headline('c.com', 'Strike at Mumbai port stops cargo handling'),
    ]
    configured = 0
    expect((await liveTrust('claim', evidence, sources, { left: 5 })).aiCheck).toBe('unavailable')

    configured = 2
    verify.mockResolvedValue([{ verdict: 'supported', sourceIds: [], reason: 'ok' }])
    const budget = { left: 5 }
    const agreed = await liveTrust('claim', evidence, sources, budget)
    expect(agreed).toMatchObject({ status: 'corroborated', aiCheck: 'agree' })
    expect(agreed.checks).toEqual([
      { model: 'ai0', verdict: 'supported', reason: 'ok' },
      { model: 'ai1', verdict: 'supported', reason: 'ok' },
    ])
    expect(verify).toHaveBeenCalledTimes(2)
    await liveTrust('claim', evidence, sources, budget) // cached
    expect(verify).toHaveBeenCalledTimes(2)
    expect(budget.left).toBe(4)

    verify.mockResolvedValueOnce([{ verdict: 'contradicted', sourceIds: [], reason: 'no' }])
    const disputed = await liveTrust('other claim', evidence, sources, budget)
    expect(disputed).toMatchObject({ status: 'unverified', aiCheck: 'disagree' })

    // Fewer than 3 outlets: the AI is not asked at all.
    verify.mockClear()
    expect((await liveTrust('x', evidence.slice(0, 2), sources, budget)).status).toBe('unverified')
    expect(verify).not.toHaveBeenCalled()
  })

  it('treats WHO and governments as official', () => {
    expect(isOfficial(seedSources.find((s) => s.id === 'src_who_don_live'))).toBe(true)
    expect(isOfficial(seedSources.find((s) => s.id === 'src_google_news'))).toBe(false)
  })
})

describe('every country gets current events', () => {
  it("picks a quiet country's most-reported story (3+ outlets), and nothing for a lone report", async () => {
    const { topStoryCandidate } = await import('./classify')
    const story = (publisher: string) =>
      headline(publisher, 'Reserve Bank of India holds repo rate steady')
    const top = topStoryCandidate([
      story('a.com'),
      story('b.com'),
      story('c.com'),
      headline('d.com', 'Cricket: India beat Australia'),
    ])
    expect(top).toMatchObject({ label: 'top story', severity: 2 })
    expect(top!.headlines).toHaveLength(3)
    expect(topStoryCandidate([story('a.com'), story('b.com')])).toBeUndefined()
  })
})

describe('important or normal', () => {
  it('marks serious or widely reported headlines important', async () => {
    const { ruleImportance } = await import('./importance')
    expect(ruleImportance(headline('a.com', 'Earthquake kills dozens in Gujarat'), 1)).toBe(
      'important',
    )
    expect(ruleImportance(headline('a.com', 'RBI keeps repo rate unchanged'), 4)).toBe('important')
    expect(ruleImportance(headline('a.com', 'New cafe opens in Pune'), 1)).toBe('normal')
  })

  it('checks a headline only against OTHER outlets', async () => {
    const { headlineTrust } = await import('./trust')
    configured = 2
    verify.mockClear()
    verify.mockResolvedValue([{ verdict: 'supported', sourceIds: [], reason: 'ok' }])
    const own = headline('a.com', 'Monsoon floods close Mumbai schools')
    const alone = await headlineTrust(own, [own], sources, { left: 3 })
    expect(alone).toMatchObject({
      status: 'unverified',
      aiCheck: 'unavailable',
      outlets: ['a.com'],
    })
    expect(verify).not.toHaveBeenCalled()
    const others = [
      headline('bbc.com', 'Mumbai schools shut as monsoon floods the city'),
      headline('c.com', 'Heavy rain forces Mumbai to close schools for two days'),
    ]
    const backed = await headlineTrust(own, [own, ...others], sources, { left: 3 })
    expect(backed).toMatchObject({ status: 'corroborated', aiCheck: 'agree' })
    const context = verify.mock.calls[0][1] as { news: NewsHeadline[] }
    expect(context.news.map((h) => h.publisher)).toEqual(['bbc.com', 'c.com'])
  })
})

describe('AI checks when one checker is down', () => {
  it('uses the checkers that answered (e.g. Groq while Gemini is out of quota)', async () => {
    configured = 2
    verify.mockReset()
    verify
      .mockRejectedValueOnce(new Error('quota'))
      .mockResolvedValueOnce([
        { verdict: 'supported', sourceIds: [], reason: 'Matches the reports.' },
      ])
    const evidence = [
      headline('reuters.com', 'Floods cut power across Chennai'),
      headline('b.com', 'Chennai without electricity after heavy flooding'),
      headline('c.com', 'Power outage in Chennai as rains flood streets'),
    ]
    const trust = await liveTrust('Floods cut power in Chennai', evidence, sources, { left: 3 })
    expect(trust).toMatchObject({ status: 'corroborated', aiCheck: 'agree' })
    expect(trust.checks).toEqual([
      { model: 'ai1', verdict: 'supported', reason: 'Matches the reports.' },
    ])
  })
})
