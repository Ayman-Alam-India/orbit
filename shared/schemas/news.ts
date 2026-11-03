import { z } from 'zod'
import {
  CountryIdSchema,
  EventIdSchema,
  ID_PREFIX,
  IsoDateTimeSchema,
  prefixedId,
  SourceIdSchema,
} from './common'
import { TrustSchema } from './trust'

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
  /** How well the story is confirmed (live headlines only; curated ones are verified by definition). */
  trust: TrustSchema.optional(),
  /**
   * important = serious (conflict, disaster, outbreak, security), widely reported (3+ outlets) or
   * ranked important by the AI · normal = everything else. Set on live headlines.
   */
  importance: z.enum(['important', 'normal']).optional(),
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

/** GET /api/news/:id/media: what the article itself shows, read from its page by the server. */
export const ArticleMediaSchema = z.object({
  headlineId: prefixedId(ID_PREFIX.news),
  /** The article's own address (Google News links are resolved to it). */
  articleUrl: z.url(),
  /** The outlet's name from the page, e.g. "Reuters". */
  siteName: z.string().min(1).optional(),
  /** The article's own short description (og:description). */
  description: z.string().min(1).optional(),
  /** Photos the article declares for previews (og:image, twitter:image), best first. */
  images: z.array(z.url()),
  /** Videos: a YouTube embed, or a video file / player the page declares (og:video). */
  videos: z.array(z.object({ url: z.url(), kind: z.enum(['youtube', 'file', 'embed']) })),
  fetchedAt: IsoDateTimeSchema,
})

export type ArticleMedia = z.infer<typeof ArticleMediaSchema>
export type NewsRefreshRequest = z.infer<typeof NewsRefreshRequestSchema>
export type NewsRefreshResult = z.infer<typeof NewsRefreshResultSchema>
