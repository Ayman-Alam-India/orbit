import { z } from 'zod'
import {
  CountryIdSchema,
  ID_PREFIX,
  IsoDateTimeSchema,
  LatLngSchema,
  prefixedId,
  SeveritySchema,
  SourceIdSchema,
} from './common'

/**
 * Fields every event has, whatever its kind.
 * Never name a type `Event`: it clashes with the browser's built-in DOM `Event`.
 */
const OrbitEventBaseSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  /** Countries involved. The first one is the primary country. */
  countryIds: z.array(CountryIdSchema).min(1),
  /** Where the marker goes on the globe. */
  location: LatLngSchema,
  occurredAt: IsoDateTimeSchema,
  severity: SeveritySchema,
  sourceIds: z.array(SourceIdSchema),
  tags: z.array(z.string()),
})

export const GeopoliticalEventSchema = OrbitEventBaseSchema.extend({
  kind: z.literal('geopolitical'),
  id: prefixedId(ID_PREFIX.geopoliticalEvent),
  /** Free text for now (e.g. "diplomacy"). The category list is decided during feature design. */
  category: z.string().min(1),
  /** People, governments or organisations involved. */
  actors: z.array(z.string()),
})

export const HealthSignalSchema = OrbitEventBaseSchema.extend({
  kind: z.literal('health'),
  id: prefixedId(ID_PREFIX.healthSignal),
  /** What is being tracked, e.g. "Dengue cases". */
  indicator: z.string().min(1),
  metric: z.object({ value: z.number(), unit: z.string().min(1) }).optional(),
})

/** Any event on the globe. Check `kind` to know which one you have. */
export const OrbitEventSchema = z.discriminatedUnion('kind', [
  GeopoliticalEventSchema,
  HealthSignalSchema,
])

export const OrbitEventKindSchema = z.enum(['geopolitical', 'health'])

export type GeopoliticalEvent = z.infer<typeof GeopoliticalEventSchema>
export type HealthSignal = z.infer<typeof HealthSignalSchema>
export type OrbitEvent = z.infer<typeof OrbitEventSchema>
export type OrbitEventKind = z.infer<typeof OrbitEventKindSchema>
