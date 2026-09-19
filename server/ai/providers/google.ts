import { AIInsightSchema, AskAnswerSchema } from '@shared'
import { generateText, Output } from 'ai'
import { ASK_SYSTEM_PROMPT, askPrompt, insightPrompt, SYSTEM_PROMPT } from '../prompt'
import type { AiContext, AiProvider } from '../types'
import { withGoogleModels } from './googleModels'

/** Give up on slow answers so the demo never hangs; index.ts then falls back (cache → mock). */
const TIMEOUT_MS = 15_000

// What we ask the model for; ORBIT adds id, provider and timestamps itself.
const InsightOutputSchema = AIInsightSchema.pick({
  summary: true,
  keyPoints: true,
  sourceIds: true,
  confidence: true,
})
const AskOutputSchema = AskAnswerSchema.pick({ answer: true, sourceIds: true })

/** Keep only source IDs that really exist in the context (models sometimes invent them). */
const knownSources = (ids: string[], context: AiContext) =>
  ids.filter((id) => context.sources.some((s) => s.id === id))

/**
 * Gemini via Google AI Studio (free tier) through the Vercel AI SDK.
 * The key comes from GOOGLE_GENERATIVE_AI_API_KEY in .env; the model from GOOGLE_MODEL.
 */
export const googleProvider: AiProvider = {
  name: 'google',

  async generateInsight({ subjectType, subjectId, context }) {
    const { output } = await withGoogleModels((model) =>
      generateText({
        model,
        maxRetries: 1,
        system: SYSTEM_PROMPT,
        prompt: insightPrompt(subjectType, context),
        output: Output.object({ schema: InsightOutputSchema, name: 'insight' }),
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    )
    return {
      ...output,
      sourceIds: knownSources(output.sourceIds, context),
      id: `ins_${subjectType}_${subjectId.toLowerCase()}`,
      subjectType,
      subjectId,
      provider: 'google',
      generatedAt: new Date().toISOString(),
    }
  },

  async ask(request, context) {
    const { output } = await withGoogleModels((model) =>
      generateText({
        model,
        maxRetries: 1,
        system: ASK_SYSTEM_PROMPT,
        prompt: askPrompt(request, context),
        output: Output.object({ schema: AskOutputSchema, name: 'answer' }),
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    )
    return {
      answer: output.answer,
      sourceIds: knownSources(output.sourceIds, context),
      provider: 'google',
      generatedAt: new Date().toISOString(),
    }
  },
}
