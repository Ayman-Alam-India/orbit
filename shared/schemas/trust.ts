import { z } from 'zod'
import { IsoDateTimeSchema } from './common'

/**
 * One verification rule for everything ORBIT shows (headlines, events, ripple effects):
 * - `verified`: curated and fact-checked by the team, or published by an official source (WHO, a government, the UN).
 * - `corroborated`: reported by 3+ INDEPENDENT outlets (syndicated copies and aggregators count once), at least one
 *   of them an established news organisation, and the AI checkers (Gemini + Groq) agree when they are configured.
 * - `unverified`: otherwise.
 */
export const TrustStatusSchema = z.enum(['verified', 'corroborated', 'unverified'])

/** agree = every AI checker supports it · disagree = at least one does not · unavailable = no AI checker ran. */
export const AiCheckSchema = z.enum(['agree', 'disagree', 'unavailable'])

/** Independent outlets needed for `corroborated`. */
export const MIN_CORROBORATING_OUTLETS = 3

/** One report behind a rating, for the "How we know" panel. */
export const TrustEvidenceSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  publisher: z.string().min(1),
  publishedAt: IsoDateTimeSchema,
  /** An established news organisation (wire service, public broadcaster, national paper of record…). */
  established: z.boolean(),
  /** Set when this is a syndicated copy (or an aggregator's republication) of another outlet's report. */
  copyOf: z.string().min(1).optional(),
})

/** One AI checker's answer, for the "How we know" panel. */
export const TrustCheckSchema = z.object({
  model: z.string().min(1),
  verdict: z.enum(['supported', 'unsupported', 'contradicted']),
  reason: z.string().min(1),
})

/** Established outlets needed (among the independent ones) for `corroborated`. */
export const MIN_ESTABLISHED_OUTLETS = 1

export const TrustSchema = z.object({
  status: TrustStatusSchema,
  /** Independent outlets (domains such as "reuters.com") reporting the same story. */
  outlets: z.array(z.string().min(1)),
  aiCheck: AiCheckSchema,
  /** One short sentence: why this status, e.g. "Reported by 5 independent outlets (2 established); Gemini and Groq agree." */
  reason: z.string().min(1),
  checkedAt: IsoDateTimeSchema,
  /** The established outlets among `outlets`. */
  established: z.array(z.string().min(1)).optional(),
  /** Syndicated copies and aggregator republications found, which were not counted. */
  copies: z.number().int().nonnegative().optional(),
  /** The reports behind the rating (max 8), independent ones first. */
  evidence: z.array(TrustEvidenceSchema).max(8).optional(),
  /** What each AI checker said, when one ran. */
  checks: z.array(TrustCheckSchema).optional(),
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
export type TrustEvidence = z.infer<typeof TrustEvidenceSchema>
export type TrustCheck = z.infer<typeof TrustCheckSchema>
export type AiCheck = z.infer<typeof AiCheckSchema>
export type Trust = z.infer<typeof TrustSchema>
