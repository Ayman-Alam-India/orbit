import {
  MIN_CORROBORATING_OUTLETS,
  type AiCheck,
  type NewsHeadline,
  type Source,
  type Trust,
} from '@shared'
import { createHash } from 'node:crypto'
import { aiVerifiers } from '../ai/verify'
import { readCache, writeCache } from '../sources/cache'
import { outletTrust, outletsOf } from '../sources/trustRules'
import { significantWords } from './classify'

export {
  curatedTrust,
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
export const aiBudget = { perPass: 12 }
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

type AiCache = Record<string, AiCheck>

/**
 * Asks every configured AI checker (Gemini, Groq) whether the headlines support the claim.
 * agree = all say "supported" · disagree = any says otherwise · unavailable = none configured,
 * budget used up, or a checker failed. Answers are cached, so a claim is checked once.
 */
export async function aiCrossCheck(
  claim: string,
  evidence: NewsHeadline[],
  sources: Source[],
  budget: { left: number },
): Promise<AiCheck> {
  const verifiers = aiVerifiers()
  if (!verifiers.length || !evidence.length) return 'unavailable'
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
  if (cache[key]) return cache[key]
  if (budget.left <= 0) return 'unavailable'
  budget.left--
  const context = {
    countries: [],
    events: [],
    news: evidence.slice(0, 8),
    sources: sources.filter((s) => evidence.some((h) => h.sourceId === s.id)),
    impacts: [],
    markets: [],
  }
  try {
    const results = await Promise.all(verifiers.map((v) => v.verify([claim], context)))
    const check: AiCheck = results.every((r) => r[0]?.verdict === 'supported')
      ? 'agree'
      : 'disagree'
    await writeCache(AI_CACHE_KEY, { ...cache, [key]: check })
    return check
  } catch (err) {
    console.warn('[ai] trust cross-check failed:', err)
    return 'unavailable'
  }
}

/** Live items (auto events, auto ripples): outlets first; the AI is only asked once 3+ outlets report it. */
export async function liveTrust(
  claim: string,
  evidence: NewsHeadline[],
  sources: Source[],
  budget: { left: number },
): Promise<Trust> {
  const outlets = outletsOf(evidence)
  if (outlets.length < MIN_CORROBORATING_OUTLETS) return outletTrust(outlets)
  return outletTrust(outlets, await aiCrossCheck(claim, evidence, sources, budget))
}
