import { z } from 'zod'
import { CountryIdSchema, EventIdSchema, ID_PREFIX, IsoDateTimeSchema, prefixedId } from './common'

/** How precise `date` is. A year-only fact is stored as Jan 1 of that year with precision "year". */
export const DatePrecisionSchema = z.enum(['day', 'month', 'year'])

export const TimelineEventSchema = z.object({
  id: prefixedId(ID_PREFIX.timeline),
  countryId: CountryIdSchema,
  date: IsoDateTimeSchema,
  datePrecision: DatePrecisionSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  /** Set when this timeline entry is part of the history of a current ORBIT event. */
  eventId: EventIdSchema.optional(),
})

export type DatePrecision = z.infer<typeof DatePrecisionSchema>
export type TimelineEvent = z.infer<typeof TimelineEventSchema>
