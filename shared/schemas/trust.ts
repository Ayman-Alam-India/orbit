import { z } from 'zod'
import { IsoDateTimeSchema } from './common'

/**
 * One verification rule for everything ORBIT shows (headlines, events, ripple effects):
 * - `verified`: curated and fact-checked by the team, or published by an official source (WHO, a government, the UN).
 * - `corroborated`: reported by 3+ independent outlets, and the AI checkers (Gemini + Groq) agree when they are configured.
 * - `unverified`: a single source, too few outlets, or the AI checkers disagree.
 */
export const TrustStatusSchema = z.enum(['verified', 'corroborated', 'unverified'])

/** agree = every AI checker supports it · disagree = at least one does not · unavailable = no AI checker ran. */
export const AiCheckSchema = z.enum(['agree', 'disagree', 'unavailable'])

/** Independent outlets needed for `corroborated`. */
export const MIN_CORROBORATING_OUTLETS = 3

export const TrustSchema = z.object({
  status: TrustStatusSchema,
  /** Distinct outlets (domains such as "reuters.com") reporting the same story. */
  outlets: z.array(z.string().min(1)),
  aiCheck: AiCheckSchema,
  /** One short sentence: why this status, e.g. "Reported by 5 outlets; Gemini and Groq agree." */
  reason: z.string().min(1),
  checkedAt: IsoDateTimeSchema,
})

export type TrustStatus = z.infer<typeof TrustStatusSchema>
export type AiCheck = z.infer<typeof AiCheckSchema>
export type Trust = z.infer<typeof TrustSchema>
