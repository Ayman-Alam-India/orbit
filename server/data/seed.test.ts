// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readRawSeed, SeedValidationError, validateSeed, type RawSeed } from './store'

const clone = (raw: RawSeed): RawSeed => structuredClone(raw)

describe('seed data', () => {
  it('every seed file matches the shared schemas and every ID reference exists', () => {
    const seed = validateSeed(readRawSeed())
    expect(seed.countries.length).toBeGreaterThan(0)
    expect(seed.events.some((e) => e.kind === 'geopolitical')).toBe(true)
    expect(seed.events.some((e) => e.kind === 'health')).toBe(true)
  })

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
