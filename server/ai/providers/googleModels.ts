import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import { env } from '../../env'

/** GOOGLE_MODEL may list several models ("a,b"): free-tier models get overloaded or run out of quota. */
export const googleModelIds = () =>
  env.GOOGLE_MODEL.split(',')
    .map((id) => id.trim())
    .filter(Boolean)

/** Runs `task` with each configured Gemini model in turn until one succeeds; throws the last error. */
export async function withGoogleModels<T>(task: (model: LanguageModel) => Promise<T>): Promise<T> {
  const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })
  let lastError: unknown = new Error('GOOGLE_MODEL is empty')
  for (const id of googleModelIds()) {
    try {
      return await task(google(id))
    } catch (err) {
      lastError = err
      console.warn(`[ai] Gemini model ${id} failed, trying the next one if configured`)
    }
  }
  throw lastError
}
