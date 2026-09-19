import { z } from 'zod'
import { ID_PREFIX, IsoDateTimeSchema, prefixedId, SourceIdSchema } from './common'

/** What an insight explains: the whole world, one country or one event. */
export const InsightSubjectTypeSchema = z.enum(['global', 'country', 'event'])
export const ConfidenceSchema = z.enum(['low', 'medium', 'high'])

/** The subjectId used when subjectType is "global". */
export const GLOBAL_SUBJECT_ID = 'world'

/**
 * An AI-generated explanation. It is "explainable" because it always says which
 * sources it used, how confident it is and which provider produced it.
 */
export const AIInsightSchema = z.object({
  id: prefixedId(ID_PREFIX.insight),
  subjectType: InsightSubjectTypeSchema,
  /** "world" for global, a country ID for country, an event ID for event. */
  subjectId: z.string().min(1),
  summary: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(1),
  sourceIds: z.array(SourceIdSchema),
  confidence: ConfidenceSchema,
  /** Which AI produced it, e.g. "mock" or "google". */
  provider: z.string().min(1),
  generatedAt: IsoDateTimeSchema,
})

export type InsightSubjectType = z.infer<typeof InsightSubjectTypeSchema>
export type Confidence = z.infer<typeof ConfidenceSchema>
export type AIInsight = z.infer<typeof AIInsightSchema>
