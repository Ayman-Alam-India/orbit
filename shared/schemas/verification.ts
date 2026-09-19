import { z } from 'zod'
import { IsoDateTimeSchema, SourceIdSchema } from './common'
import { InsightSubjectTypeSchema } from './insight'

/**
 * Claim-level verification: every claim in an AI insight is checked against ORBIT's data by
 * several independent verifiers (LLMs plus a deterministic rule-based checker).
 */

/** supported = the data backs it · unsupported = the data doesn't say · contradicted = the data says otherwise. */
export const VerdictSchema = z.enum(['supported', 'unsupported', 'contradicted'])

/** One verifier's judgement of one claim. */
export const ModelVerdictSchema = z.object({
  /** Verifier name, e.g. "gemini", "groq", "rules". */
  model: z.string().min(1),
  verdict: VerdictSchema,
  /** The evidence it relied on (source IDs that exist in ORBIT). */
  sourceIds: z.array(SourceIdSchema),
  /** One short sentence explaining the verdict. */
  reason: z.string().min(1),
})

/** agree = every verifier gave the same verdict · disagree = they differ · single = only one verifier answered. */
export const AgreementSchema = z.enum(['agree', 'disagree', 'single'])

export const VerifiedClaimSchema = z.object({
  id: z.string().regex(/^clm_[a-z0-9_]+$/),
  text: z.string().min(1),
  verdicts: z.array(ModelVerdictSchema).min(1),
  agreement: AgreementSchema,
})

export const VerificationReportSchema = z.object({
  subjectType: InsightSubjectTypeSchema,
  subjectId: z.string().min(1),
  /** Which AI wrote the insight being checked ("google", "mock", …). */
  insightProvider: z.string().min(1),
  /** Verifiers that answered, in display order. */
  models: z.array(z.string().min(1)).min(1),
  /** Verifiers that were configured but failed this time (e.g. offline, rate-limited). */
  unavailable: z.array(z.object({ model: z.string(), reason: z.string() })),
  claims: z.array(VerifiedClaimSchema),
  /** Share of claims on which all verifiers agree, 0–1. */
  agreementScore: z.number().min(0).max(1),
  generatedAt: IsoDateTimeSchema,
})

export type Verdict = z.infer<typeof VerdictSchema>
export type ModelVerdict = z.infer<typeof ModelVerdictSchema>
export type Agreement = z.infer<typeof AgreementSchema>
export type VerifiedClaim = z.infer<typeof VerifiedClaimSchema>
export type VerificationReport = z.infer<typeof VerificationReportSchema>
