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

/** POST /api/news/refresh body. Without `countryId`: the global feed. */
export const NewsRefreshRequestSchema = z.object({
  countryId: CountryIdSchema.optional(),
})

/** POST /api/news/refresh answer: the feed after asking the live source for fresh headlines. */
export const NewsRefreshResultSchema = z.object({
  /** Same list GET /api/news returns: curated + live, newest first. */
  headlines: z.array(NewsHeadlineSchema),
  /** When the saved live headlines were fetched. Absent when none are saved yet. */
  fetchedAt: IsoDateTimeSchema.optional(),
  /** false when live news is off (DATA_MODE=mock), the fetch failed or it timed out: `headlines` are the saved ones. */
  refreshed: z.boolean(),
})

export type NewsRefreshRequest = z.infer<typeof NewsRefreshRequestSchema>
export type NewsRefreshResult = z.infer<typeof NewsRefreshResultSchema>
