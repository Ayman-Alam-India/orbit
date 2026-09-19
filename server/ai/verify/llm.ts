import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { VerdictSchema } from '@shared'
import { generateText, Output, type LanguageModel } from 'ai'
import { z } from 'zod'
import { env } from '../../env'
import { contextJson } from '../prompt'
import type { AiContext } from '../types'
import type { ClaimJudgement, Verifier } from './types'

const TIMEOUT_MS = 20_000

const FACT_CHECK_SYSTEM = `You are an independent fact-checker for ORBIT, a global intelligence platform.
Judge each numbered CLAIM ONLY against the CONTEXT JSON. Do not use outside knowledge.
- "supported": CONTEXT clearly states or directly implies the claim, including its numbers.
- "contradicted": CONTEXT states something incompatible with the claim (e.g. a different figure or date).
- "unsupported": CONTEXT does not say either way.
For each claim give the source IDs from CONTEXT that you relied on and one short reason.`

const OutputSchema = z.object({
  results: z.array(
    z.object({
      claim: z.number().int(),
      verdict: VerdictSchema,
      sourceIds: z.array(z.string()),
      reason: z.string(),
    }),
  ),
})

/** An LLM-backed verifier; `model` is only created when a check runs (keys are read then). */
export function llmVerifier(name: string, model: () => LanguageModel): Verifier {
  return {
    name,
    async verify(claims: string[], context: AiContext): Promise<ClaimJudgement[]> {
      const { output } = await generateText({
        model: model(),
        system: FACT_CHECK_SYSTEM,
        prompt: `CLAIMS:\n${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nCONTEXT:\n${contextJson(context)}`,
        output: Output.object({ schema: OutputSchema, name: 'fact_check' }),
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const known = new Set(context.sources.map((s) => s.id))
      return claims.map((_, i) => {
        const r = output.results.find((x) => x.claim === i + 1)
        return r
          ? {
              verdict: r.verdict,
              sourceIds: r.sourceIds.filter((id) => known.has(id)),
              reason: r.reason.trim() || 'No reason given.',
            }
          : {
              verdict: 'unsupported',
              sourceIds: [],
              reason: 'The model returned no verdict for this claim.',
            }
      })
    },
  }
}

/** Gemini (Google AI Studio free tier). */
export const geminiVerifier = llmVerifier('gemini', () =>
  createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(env.GOOGLE_MODEL),
)

/** Groq (free tier): a different model family from Gemini, for an independent second opinion. */
export const groqVerifier = llmVerifier('groq', () =>
  createGroq({ apiKey: env.GROQ_API_KEY })(env.GROQ_MODEL),
)
