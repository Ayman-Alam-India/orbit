import {
  CountrySchema,
  NewsHeadlineSchema,
  OrbitEventSchema,
  SourceSchema,
  TimelineEventSchema,
  type Country,
  type CountryId,
  type NewsHeadline,
  type OrbitEvent,
  type OrbitEventKind,
  type Source,
  type TimelineEvent,
} from '@shared'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

/** Each seed file and the schema every item in it must match. */
const SEED_FILES = {
  countries: { file: 'countries.json', schema: z.array(CountrySchema) },
  sources: { file: 'sources.json', schema: z.array(SourceSchema) },
  events: { file: 'events.json', schema: z.array(OrbitEventSchema) },
  news: { file: 'news.json', schema: z.array(NewsHeadlineSchema) },
  timeline: { file: 'timeline.json', schema: z.array(TimelineEventSchema) },
} as const

/**
 * Folder with the seed JSON, relative to the repo root (npm scripts always run from there, same
 * convention as mcp/server.mjs). The app uses the curated data in server/data/seed; tests set
 * ORBIT_SEED_DIR=server/data/fixtures (vitest.config.ts) so they never depend on real content.
 */
export const SEED_DIR = process.env.ORBIT_SEED_DIR ?? 'server/data/seed'

export type SeedData = {
  countries: Country[]
  sources: Source[]
  events: OrbitEvent[]
  news: NewsHeadline[]
  timeline: TimelineEvent[]
}

export type RawSeed = Record<keyof typeof SEED_FILES, unknown>

export class SeedValidationError extends Error {}

export function readRawSeed(dir: string = SEED_DIR): RawSeed {
  const raw = {} as RawSeed
  for (const [key, { file }] of Object.entries(SEED_FILES)) {
    try {
      raw[key as keyof RawSeed] = JSON.parse(
        readFileSync(resolve(process.cwd(), dir, file), 'utf8'),
      )
    } catch (err) {
      throw new SeedValidationError(`${dir}/${file}: cannot read JSON (${String(err)})`)
    }
  }
  return raw
}

/** Checks every seed file against its schema, then checks that every ID reference points at something real. */
export function validateSeed(raw: RawSeed): SeedData {
  const problems: string[] = []
  const parsed: Partial<SeedData> = {}

  for (const [key, { file, schema }] of Object.entries(SEED_FILES)) {
    const result = schema.safeParse(raw[key as keyof RawSeed])
    if (result.success) {
      Object.assign(parsed, { [key]: result.data })
    } else {
      for (const issue of result.error.issues) {
        problems.push(`${file} at [${issue.path.join('.')}]: ${issue.message}`)
      }
    }
  }
  if (problems.length) throw new SeedValidationError(problems.join('\n'))

  const data = parsed as SeedData
  const countryIds = new Set(data.countries.map((c) => c.id))
  const sourceIds = new Set(data.sources.map((s) => s.id))
  const eventIds = new Set(data.events.map((e) => e.id))
  const check = (ok: boolean, message: string) => ok || problems.push(message)

  for (const list of Object.values(data)) {
    const seen = new Set<string>()
    for (const item of list) {
      check(!seen.has(item.id), `Duplicate id "${item.id}"`)
      seen.add(item.id)
    }
  }
  for (const e of data.events) {
    e.countryIds.forEach((id) =>
      check(countryIds.has(id), `events.json ${e.id}: unknown country "${id}"`),
    )
    e.sourceIds.forEach((id) =>
      check(sourceIds.has(id), `events.json ${e.id}: unknown source "${id}"`),
    )
  }
  for (const n of data.news) {
    check(sourceIds.has(n.sourceId), `news.json ${n.id}: unknown source "${n.sourceId}"`)
    n.countryIds.forEach((id) =>
      check(countryIds.has(id), `news.json ${n.id}: unknown country "${id}"`),
    )
    if (n.eventId) check(eventIds.has(n.eventId), `news.json ${n.id}: unknown event "${n.eventId}"`)
  }
  for (const t of data.timeline) {
    check(countryIds.has(t.countryId), `timeline.json ${t.id}: unknown country "${t.countryId}"`)
    if (t.eventId)
      check(eventIds.has(t.eventId), `timeline.json ${t.id}: unknown event "${t.eventId}"`)
  }
  if (problems.length) throw new SeedValidationError(problems.join('\n'))
  return data
}

let cached: SeedData | undefined

/** The validated seed data. Loaded once; throws SeedValidationError if any file is wrong. */
export function getSeed(): SeedData {
  cached ??= validateSeed(readRawSeed())
  return cached
}

const newestFirst =
  <T>(key: (item: T) => string) =>
  (a: T, b: T) =>
    key(b).localeCompare(key(a))

export const store = {
  getCountries: () => getSeed().countries,
  getCountry: (id: CountryId) => getSeed().countries.find((c) => c.id === id),
  getSources: () => getSeed().sources,
  getEvents: (kind?: OrbitEventKind) =>
    getSeed()
      .events.filter((e) => !kind || e.kind === kind)
      .sort(newestFirst((e) => e.occurredAt)),
  getEvent: (id: string) => getSeed().events.find((e) => e.id === id),
  getEventsByCountry: (id: CountryId) => store.getEvents().filter((e) => e.countryIds.includes(id)),
  getNews: (countryId?: CountryId) =>
    getSeed()
      .news.filter((n) => !countryId || n.countryIds.includes(countryId))
      .sort(newestFirst((n) => n.publishedAt)),
  getTimeline: (countryId: CountryId) =>
    getSeed()
      .timeline.filter((t) => t.countryId === countryId)
      .sort((a, b) => a.date.localeCompare(b.date)),
}
