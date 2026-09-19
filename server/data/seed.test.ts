// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readRawSeed, SeedValidationError, validateSeed, type RawSeed } from './store'

const clone = (raw: RawSeed): RawSeed => structuredClone(raw)

describe.each([
  ['curated seed (what the app shows)', 'server/data/seed'],
  ['test fixtures', 'server/data/fixtures'],
])('%s', (_label, dir) => {
  it('every file matches the shared schemas and every ID reference exists', () => {
    const seed = validateSeed(readRawSeed(dir))
    expect(seed.countries.length).toBeGreaterThan(0)
    expect(seed.events.some((e) => e.kind === 'geopolitical')).toBe(true)
    expect(seed.events.some((e) => e.kind === 'health')).toBe(true)
  })
})

describe('curated seed', () => {
  it('every country ID exists on the globe map', () => {
    const shapes = JSON.parse(readFileSync('public/data/countries.geojson', 'utf8')) as {
      features: { properties: { id: string } }[]
    }
    const mapIds = new Set(shapes.features.map((f) => f.properties.id))
    const seed = validateSeed(readRawSeed('server/data/seed'))
    expect(seed.countries.filter((c) => !mapIds.has(c.id)).map((c) => c.id)).toEqual([])
  })

  it('cites no placeholder sources', () => {
    const seed = validateSeed(readRawSeed('server/data/seed'))
    expect(seed.sources.filter((s) => /example\.(org|com)/.test(s.url))).toEqual([])
  })
})

describe('seed validation', () => {
  it('reports the file and field when an item breaks the schema', () => {
    const raw = clone(readRawSeed())
    ;(raw.countries as { id: string }[])[0].id = 'india'
    expect(() => validateSeed(raw)).toThrow(/countries\.json at \[0\.id\]/)
  })

  it('rejects references to things that do not exist', () => {
    const raw = clone(readRawSeed())
    ;(raw.news as { sourceId: string }[])[0].sourceId = 'src_missing'
    expect(() => validateSeed(raw)).toThrow(SeedValidationError)
    expect(() => validateSeed(raw)).toThrow(/unknown source "src_missing"/)
  })
})
