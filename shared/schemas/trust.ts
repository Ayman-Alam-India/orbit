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

/** POST /api/trust/check: re-verify one item now (fresh outlet search + Gemini and Groq). */
export const TrustCheckRequestSchema = z.object({
  kind: z.enum(['headline', 'event', 'ripple']),
  /** The item's ID: `news_...`, `evt_...`/`hs_...` or `imp_...`. */
  id: z.string().min(1).max(200),
})

/** GET /api/status: is the live pipeline running, and did each source answer? */
export const PipelineStatusSchema = z.object({
  dataMode: z.enum(['mock', 'live']),
  /** When the last pipeline pass finished. Absent before the first pass (or in mock mode). */
  lastRunAt: IsoDateTimeSchema.optional(),
  headlines: z.number().int().nonnegative(),
  events: z.number().int().nonnegative(),
  ripples: z.number().int().nonnegative(),
  trust: z.object({
    verified: z.number().int().nonnegative(),
    corroborated: z.number().int().nonnegative(),
    unverified: z.number().int().nonnegative(),
  }),
  /** AI checkers with a key configured, e.g. ["gemini", "groq"]. Empty = outlet count only. */
  aiCheckers: z.array(z.string()),
  sources: z.array(
    z.object({
      name: z.string().min(1),
      ok: z.boolean(),
      /** e.g. "52/53 feeds", "8 prices", "6 reports". */
      detail: z.string(),
    }),
  ),
})

export type TrustCheckRequest = z.infer<typeof TrustCheckRequestSchema>
export type PipelineStatus = z.infer<typeof PipelineStatusSchema>
export type TrustStatus = z.infer<typeof TrustStatusSchema>
export type AiCheck = z.infer<typeof AiCheckSchema>
export type Trust = z.infer<typeof TrustSchema>
