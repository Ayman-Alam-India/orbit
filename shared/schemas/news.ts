import { z } from 'zod'
import {
  CountryIdSchema,
  EventIdSchema,
  ID_PREFIX,
  IsoDateTimeSchema,
  prefixedId,
  SourceIdSchema,
} from './common'

export const NewsHeadlineSchema = z.object({
  id: prefixedId(ID_PREFIX.news),
  title: z.string().min(1),
  url: z.url(),
  sourceId: SourceIdSchema,
  publishedAt: IsoDateTimeSchema,
  countryIds: z.array(CountryIdSchema),
  /** Set when the headline is about a specific ORBIT event. */
  eventId: EventIdSchema.optional(),
})

export type NewsHeadline = z.infer<typeof NewsHeadlineSchema>
