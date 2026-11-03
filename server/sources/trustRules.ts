import {
  MIN_CORROBORATING_OUTLETS,
  MIN_ESTABLISHED_OUTLETS,
  type AiCheck,
  type NewsHeadline,
  type Source,
  type Trust,
  type TrustCheck,
  type TrustEvidence,
} from '@shared'
import { significantWords } from '../ingest/classify'
import { isAggregator, isEstablished } from './outlets'

/**
 * The pure parts of ORBIT's one verification rule (no AI, no I/O), so any layer can use them.
 * The AI cross-check lives in server/ingest/trust.ts.
 */

export const iso = (now: number) => new Date(now).toISOString()

export function curatedTrust(now = Date.now()): Trust {
  return {
    status: 'verified',
    outlets: [],
    aiCheck: 'unavailable',
    reason: 'Curated and fact-checked by the ORBIT team.',
    checkedAt: iso(now),
  }
}

export function officialTrust(sourceName: string, now = Date.now()): Trust {
  return {
    status: 'verified',
    outlets: [],
    aiCheck: 'unavailable',
    reason: `Published by an official source: ${sourceName}.`,
    checkedAt: iso(now),
  }
}

/** Official = governments and international organisations rated highly reliable (e.g. WHO). */
export const isOfficial = (source: Source | undefined) =>
  Boolean(
    source &&
    source.reliability === 'high' &&
    (source.type === 'government' || source.type === 'international_org'),
  )

/** Outlet of a headline: its publisher domain, e.g. "reuters.com". */
const outletOf = (h: NewsHeadline) => h.publisher?.toLowerCase()

/** Distinct outlets among some headlines. */
export const outletsOf = (headlines: NewsHeadline[]) => [
  ...new Set(headlines.map(outletOf).filter((o): o is string => Boolean(o))),
]

export type AiResult = { check: AiCheck; checks?: TrustCheck[] }

/** The outlet rule: 3+ independent outlets, at least one established, and no AI disagreement. */
export function outletTrust(
  outlets: string[],
  aiCheck: AiCheck = 'unavailable',
  now = Date.now(),
  extra: { copies?: number; evidence?: TrustEvidence[]; checks?: TrustCheck[] } = {},
): Trust {
  const n = outlets.length
  const established = outlets.filter((o) => isEstablished(o))
  const enough = n >= MIN_CORROBORATING_OUTLETS
  const hasEstablished = established.length >= MIN_ESTABLISHED_OUTLETS
  const status = enough && hasEstablished && aiCheck !== 'disagree' ? 'corroborated' : 'unverified'
  const count =
    n === 0
      ? 'No independent outlet found yet'
      : `Reported by ${n} independent outlet${n === 1 ? '' : 's'}`
  const need = enough ? '' : ` (needs ${MIN_CORROBORATING_OUTLETS})`
  const est =
    n === 0
      ? ''
      : established.length
        ? `, ${established.length} established (${established.slice(0, 3).join(', ')})`
        : enough
          ? ', none of them an established news organisation (needs 1)'
          : ''
  const copies = extra.copies
    ? `; ${extra.copies} syndicated cop${extra.copies === 1 ? 'y' : 'ies'} not counted`
    : ''
  const NAMES: Record<string, string> = { gemini: 'Gemini', groq: 'Groq' }
  const who = (extra.checks ?? []).map((c) => NAMES[c.model] ?? c.model)
  const ai =
    aiCheck === 'agree'
      ? who.length === 1
        ? `; ${who[0]} agrees (the other AI checker didn't answer)`
        : who.length
          ? `; ${who.join(' and ')} agree`
          : '; the AI checkers agree'
      : aiCheck === 'disagree'
        ? '; an AI checker does not support it'
        : ''
  return {
    status,
    outlets,
    aiCheck,
    reason: `${count}${need}${est}${copies}${ai}.`,
    checkedAt: iso(now),
    established,
    ...(extra.copies ? { copies: extra.copies } : {}),
    ...(extra.evidence?.length ? { evidence: extra.evidence.slice(0, 8) } : {}),
    ...(extra.checks?.length ? { checks: extra.checks } : {}),
  }
}

/** Near-identical headlines from different outlets are one syndicated report (wire copy). */
const SYNDICATED_SIMILARITY = 0.8

function similarity(a: Set<string>, b: Set<string>) {
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  const union = a.size + b.size - shared
  return union ? shared / union : 0
}

/**
 * The full rule from the reports themselves: aggregators and syndicated copies are found and
 * counted once (the earliest report is the original), then the outlet rule decides.
 */
export function evidenceTrust(
  headlines: NewsHeadline[],
  ai: AiResult = { check: 'unavailable' },
  now = Date.now(),
): Trust {
  const reports = [...new Map(headlines.map((h) => [h.url, h])).values()].sort((a, b) =>
    a.publishedAt.localeCompare(b.publishedAt),
  )
  const originals: { outlet: string; words: Set<string> }[] = []
  const independent: TrustEvidence[] = []
  const copies: TrustEvidence[] = []
  for (const h of reports) {
    const outlet = outletOf(h)
    if (!outlet) continue
    const item = {
      title: h.title,
      url: h.url,
      publisher: outlet,
      publishedAt: h.publishedAt,
      established: isEstablished(outlet),
    }
    if (isAggregator(outlet)) {
      copies.push({ ...item, copyOf: 'another outlet (aggregator)' })
      continue
    }
    if (originals.some((o) => o.outlet === outlet)) continue // the same outlet twice
    const words = new Set(significantWords(h.title))
    const original = originals.find((o) => similarity(o.words, words) >= SYNDICATED_SIMILARITY)
    if (original) {
      copies.push({ ...item, copyOf: original.outlet })
      continue
    }
    originals.push({ outlet, words })
    independent.push(item)
  }
  // Established outlets first in the "How we know" list, then the rest, then copies.
  const evidence = [
    ...independent.filter((e) => e.established),
    ...independent.filter((e) => !e.established),
    ...copies,
  ]
  return outletTrust(
    independent.map((e) => e.publisher),
    ai.check,
    now,
    { copies: copies.length, evidence: reports.length > 1 ? evidence : [], checks: ai.checks },
  )
}
