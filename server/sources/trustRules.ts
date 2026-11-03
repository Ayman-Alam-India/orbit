import {
  MIN_CORROBORATING_OUTLETS,
  type AiCheck,
  type NewsHeadline,
  type Source,
  type Trust,
} from '@shared'

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

/** The outlet rule alone (used for headlines, and whenever no AI checker ran). */
export function outletTrust(
  outlets: string[],
  aiCheck: AiCheck = 'unavailable',
  now = Date.now(),
): Trust {
  const n = outlets.length
  const enough = n >= MIN_CORROBORATING_OUTLETS
  const ai =
    aiCheck === 'agree'
      ? '; the AI checkers agree'
      : aiCheck === 'disagree'
        ? ', but an AI checker does not support it'
        : ''
  const status = enough && aiCheck !== 'disagree' ? 'corroborated' : 'unverified'
  const count =
    n === 0 ? 'No independent outlet found yet' : `Reported by ${n} outlet${n === 1 ? '' : 's'}`
  const need = enough ? '' : ` (needs ${MIN_CORROBORATING_OUTLETS})`
  return {
    status,
    outlets,
    aiCheck,
    reason: `${count}${need}${ai}.`,
    checkedAt: iso(now),
  }
}
