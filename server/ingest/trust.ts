import {
  MIN_CORROBORATING_OUTLETS,
  type AiCheck,
  type NewsHeadline,
  type Source,
  type Trust,
  type TrustCheck,
} from '@shared'
import { createHash } from 'node:crypto'
import { aiVerifiers } from '../ai/verify'
import { readCache, writeCache } from '../sources/cache'
import { evidenceTrust, type AiResult } from '../sources/trustRules'
import { significantWords } from './classify'

export {
  curatedTrust,
  evidenceTrust,
  isOfficial,
  officialTrust,
  outletTrust,
  outletsOf,
} from '../sources/trustRules'

/**
 * ORBIT's one verification rule, applied to every headline, event and ripple (shared/schemas/trust.ts):
 * verified = curated or official · corroborated = 3+ outlets and the AI checkers agree · unverified = otherwise.
 */

/** Two headlines tell the same story when their titles share this many significant words. */
const SAME_STORY_WORDS = 3
/** AI checks per pipeline pass, to stay inside the free quotas. Results are cached. */
export const aiBudget = { perPass: 6 }
const AI_CACHE_KEY = 'ai-trust'

/** An index of live headlines for "who else reports this story?" lookups. */
export function storyIndex(headlines: NewsHeadline[]) {
  const unique = [...new Map(headlines.map((h) => [h.url, h])).values()]
  const words = unique.map((h) => new Set(significantWords(h.title)))
  return {
    /** Headlines telling the same story as `title` (including any whose URL is listed). */
    sameStory(title: string, urls: string[] = []) {
      const target = new Set(significantWords(title))
      const listed = new Set(urls)
      return unique.filter((h, i) => {
        if (listed.has(h.url)) return true
        let shared = 0
        for (const w of words[i]) if (target.has(w) && ++shared >= SAME_STORY_WORDS) return true
        return false
      })
    },
  }
}

/** Older cache entries hold just the verdict; newer ones also keep what each checker said. */
type AiCache = Record<string, AiCheck | AiResult>

/**
 * Asks every configured AI checker (Gemini, Groq) whether the reports support the claim.
 * agree = all say "supported" · disagree = any says otherwise · unavailable = none configured,
 * budget used up, or a checker failed. Answers (with each checker's reason) are cached, so a
 * claim is checked once.
 */
export async function aiCrossCheck(
  claim: string,
  evidence: NewsHeadline[],
  sources: Source[],
  budget: { left: number },
): Promise<AiResult> {
  const verifiers = aiVerifiers()
  if (!verifiers.length || !evidence.length) return { check: 'unavailable' }
  const key = createHash('sha1')
    .update(
      claim +
        evidence
          .map((h) => h.url)
          .sort()
          .join('|'),
    )
    .digest('hex')
    .slice(0, 16)
  const cache = (await readCache<AiCache>(AI_CACHE_KEY)) ?? {}
  const hit = cache[key]
  if (hit) return typeof hit === 'string' ? { check: hit } : hit
  if (budget.left <= 0) return { check: 'unavailable' }
  budget.left--
  const context = {
    countries: [],
    events: [],
    news: evidence.slice(0, 8),
    sources: sources.filter((s) => evidence.some((h) => h.sourceId === s.id)),
    impacts: [],
    markets: [],
  }
  // Each checker answers on its own: one that fails (e.g. Gemini out of quota) doesn't throw away
  // the others' answers. The verdict uses whoever answered.
  const settled = await Promise.allSettled(verifiers.map((v) => v.verify([claim], context)))
  const checks: TrustCheck[] = settled.flatMap((r, i) =>
    r.status === 'fulfilled'
      ? [
          {
            model: verifiers[i].name,
            verdict: r.value[0]?.verdict ?? 'unsupported',
            reason: r.value[0]?.reason ?? 'No answer.',
          },
        ]
      : [],
  )
  const failed = settled.filter((r) => r.status === 'rejected').length
  if (failed)
    console.warn(`[ai] trust cross-check: ${failed} of ${verifiers.length} checkers failed`)
  if (!checks.length) return { check: 'unavailable' }
  const result: AiResult = {
    check: checks.every((c) => c.verdict === 'supported') ? 'agree' : 'disagree',
    checks,
  }
  // Only a complete answer is cached, so a checker that was down gets its turn next time.
  if (!failed) await writeCache(AI_CACHE_KEY, { ...cache, [key]: result })
  return result
}

/**
 * Live items (auto events, auto ripples): the reports decide first (independent outlets, copies
 * counted once); the AI is only asked once enough independent outlets report it.
 */
export async function liveTrust(
  claim: string,
  evidence: NewsHeadline[],
  sources: Source[],
  budget: { left: number },
): Promise<Trust> {
  const byReports = evidenceTrust(evidence)
  if (byReports.outlets.length < MIN_CORROBORATING_OUTLETS) return byReports
  return evidenceTrust(evidence, await aiCrossCheck(claim, evidence, sources, budget))
}

/**
 * One headline: its own report plus every other outlet's report of the same story; the AI
 * checkers judge it only against the OTHER outlets' reports (a headline always "supports" itself).
 */
export async function headlineTrust(
  headline: NewsHeadline,
  others: NewsHeadline[],
  sources: Source[],
  budget: { left: number },
): Promise<Trust> {
  const evidence = others.filter(
    (h) => h.url !== headline.url && h.publisher !== headline.publisher,
  )
  const ai: AiResult = evidence.length
    ? await aiCrossCheck(headline.title, evidence, sources, budget)
    : { check: 'unavailable' }
  return evidenceTrust([headline, ...evidence], ai)
}
