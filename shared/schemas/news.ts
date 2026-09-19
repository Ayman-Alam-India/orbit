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
  /** The outlet that published it (e.g. "reuters.com"), when the source is an aggregator like GDELT. */
  publisher: z.string().min(1).optional(),
})

export type NewsHeadline = z.infer<typeof NewsHeadlineSchema>
