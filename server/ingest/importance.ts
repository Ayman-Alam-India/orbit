import { MIN_CORROBORATING_OUTLETS, type NewsHeadline } from '@shared'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { withGoogleModels } from '../ai/providers/googleModels'
import { env } from '../env'
import { readCache, writeCache } from '../sources/cache'
import { classifyHeadlines } from './classify'

/**
 * Important or normal, for every live headline:
 * - important when the classifier rates it serious (conflict, disaster, outbreak, security: 3+),
 *   or when 3+ independent outlets report the story;
 * - for the focus country (India), Gemini also ranks the day's headlines, and may mark more of them
 *   important (a big policy, market or court decision the keyword rules can't see).
 */
export type Importance = 'important' | 'normal'

const AI_CACHE_KEY = 'ai-importance'
const AI_MAX_HEADLINES = 30
const TIMEOUT_MS = 15_000

/** The keyword and outlet rules (no AI, works offline). */
export function ruleImportance(headline: NewsHeadline, outletCount: number): Importance {
  const [candidate] = classifyHeadlines([headline])
  return (candidate && candidate.severity >= 3) || outletCount >= MIN_CORROBORATING_OUTLETS
    ? 'important'
    : 'normal'
}

const RankSchema = z.object({
  important: z.array(z.number().int()).describe('Numbers of the important headlines'),
})

/**
 * Gemini ranks up to 30 headlines about one country in one call. Answers are cached per URL, so a
 * headline is ranked once. Returns the URLs Gemini marks important (empty without a key or on failure).
 */
export async function aiImportant(headlines: NewsHeadline[], countryName: string) {
  if (env.AI_PROVIDER !== 'google' || !env.GOOGLE_GENERATIVE_AI_API_KEY) return new Set<string>()
  const cache = (await readCache<Record<string, Importance>>(AI_CACHE_KEY)) ?? {}
  const todo = headlines.filter((h) => !cache[h.url]).slice(0, AI_MAX_HEADLINES)
  if (todo.length) {
    try {
      const { output } = await withGoogleModels((model) =>
        generateText({
          model,
          maxRetries: 1,
          system:
            `You rank news headlines about ${countryName} for a government and business intelligence dashboard. ` +
            'A headline is important when it reports something with national impact: security, conflict, disasters, ' +
            'public health, major economic or market moves, fuel or price changes, major policy, court or election news. ' +
            'Sport, entertainment, celebrity, lifestyle, local crime and opinion pieces are not important.',
          prompt: todo.map((h, i) => `${i + 1}. ${h.title}`).join('\n'),
          output: Output.object({ schema: RankSchema, name: 'ranking' }),
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        }),
      )
      const picked = new Set(output.important)
      todo.forEach((h, i) => (cache[h.url] = picked.has(i + 1) ? 'important' : 'normal'))
      await writeCache(AI_CACHE_KEY, cache)
    } catch (err) {
      console.warn('[ai] importance ranking failed, using the rules only:', err)
    }
  }
  return new Set(headlines.filter((h) => cache[h.url] === 'important').map((h) => h.url))
}
