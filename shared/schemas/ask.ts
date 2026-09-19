import { z } from 'zod'
import { CountryIdSchema, EventIdSchema, IsoDateTimeSchema, SourceIdSchema } from './common'

/** Body of POST /api/ask. `context` tells ORBIT what the user is currently looking at. */
export const AskRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  context: z
    .object({
      countryId: CountryIdSchema.optional(),
      eventId: EventIdSchema.optional(),
    })
    .optional(),
})

export const AskAnswerSchema = z.object({
  answer: z.string().min(1),
  sourceIds: z.array(SourceIdSchema),
  provider: z.string().min(1),
  generatedAt: IsoDateTimeSchema,
})

export type AskRequest = z.infer<typeof AskRequestSchema>
export type AskAnswer = z.infer<typeof AskAnswerSchema>
