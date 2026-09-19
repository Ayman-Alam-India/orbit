import { z } from 'zod'

/** ISO 3166-1 alpha-3, uppercase. Same key as `properties.id` in public/data/countries.geojson. */
export const CountryIdSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Country IDs are ISO 3166-1 alpha-3 uppercase, e.g. "IND"')

/** Every non-country ID starts with a prefix that says what it is. */
export const ID_PREFIX = {
  geopoliticalEvent: 'evt_',
  healthSignal: 'hs_',
  news: 'news_',
  source: 'src_',
  timeline: 'tl_',
  insight: 'ins_',
} as const

type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX]

/** A readable, stable ID such as `evt_ind_monsoon_floods`: prefix + lowercase letters, digits, underscores. */
export const prefixedId = (prefix: IdPrefix) =>
  z
    .string()
    .regex(new RegExp(`^${prefix}[a-z0-9_]+$`), `IDs must look like "${prefix}lowercase_slug"`)

export const SourceIdSchema = prefixedId(ID_PREFIX.source)

/** An OrbitEvent ID: `evt_...` (geopolitical) or `hs_...` (health signal). */
export const EventIdSchema = z.union([
  prefixedId(ID_PREFIX.geopoliticalEvent),
  prefixedId(ID_PREFIX.healthSignal),
])

/** ISO 8601 date-time in UTC with a trailing Z, e.g. "2026-09-19T10:00:00Z". */
export const IsoDateTimeSchema = z.iso.datetime()

/** Coordinates use the same names as the globe library: lat / lng. */
export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/** One scale for everything: 1 = low … 5 = critical. Drives colour (cyan → amber → orange). */
export const SeveritySchema = z.number().int().min(1).max(5)

export type CountryId = z.infer<typeof CountryIdSchema>
export type SourceId = z.infer<typeof SourceIdSchema>
export type EventId = z.infer<typeof EventIdSchema>
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>
export type LatLng = z.infer<typeof LatLngSchema>
export type Severity = z.infer<typeof SeveritySchema>
