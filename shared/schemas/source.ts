import { z } from 'zod'
import { SourceIdSchema } from './common'

export const SourceTypeSchema = z.enum([
  'news',
  'government',
  'international_org',
  'research',
  'dataset',
])
export const ReliabilitySchema = z.enum(['high', 'medium', 'low'])

/** Where a piece of information came from. Events, news and AI insights cite sources by ID. */
export const SourceSchema = z.object({
  id: SourceIdSchema,
  name: z.string().min(1),
  url: z.url(),
  type: SourceTypeSchema,
  reliability: ReliabilitySchema,
})

export type SourceType = z.infer<typeof SourceTypeSchema>
export type Reliability = z.infer<typeof ReliabilitySchema>
export type Source = z.infer<typeof SourceSchema>
