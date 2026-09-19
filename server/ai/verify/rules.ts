import type { SourceId } from '@shared'
import type { AiContext } from '../types'
import type { ClaimJudgement, Verifier } from './types'

/**
 * The deterministic verifier: no AI, no network. A claim is "supported" when every figure in it
 * appears in ORBIT's data and (for claims without figures) most of its key terms match one
 * piece of evidence. It never says "contradicted": that needs understanding, which is the LLMs' job.
 */

const STOP_WORDS = new Set(
  'about after also among and are because been being between both but can could does during each from have into its more most other over same says such than that their there these they this those through under until what when where which while will with would your the for was were has had not'.split(
    ' ',
  ),
)

type Evidence = { label: string; text: string; sourceIds: SourceId[] }

const normalizeNumber = (n: string) => n.replace(/,/g, '').replace(/\.0+$/, '')
const numbersIn = (text: string) =>
  (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map(normalizeNumber).filter((n) => n.length > 0)
const termsIn = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w)),
  )

/** Every piece of text ORBIT knows for this context, with the sources behind it. */
function evidenceFor(context: AiContext): Evidence[] {
  const evidence: Evidence[] = context.events.map((e) => ({
    label: e.title,
    text: [
      e.title,
      e.summary,
      `severity ${e.severity}/5`,
      e.kind === 'health' ? `${e.indicator} ${e.metric?.value ?? ''} ${e.metric?.unit ?? ''}` : '',
      e.kind === 'geopolitical' ? `${e.category} ${e.actors.join(' ')}` : '',
    ].join(' '),
    sourceIds: e.sourceIds,
  }))
  for (const c of context.countries) {
    const countrySources = context.events
      .filter((e) => e.countryIds.includes(c.id))
      .flatMap((e) => e.sourceIds)
    evidence.push({ label: c.name, text: `${c.name} ${c.summary}`, sourceIds: countrySources })
  }
  for (const n of context.news) {
    evidence.push({ label: n.title, text: n.title, sourceIds: [n.sourceId] })
  }
  for (const i of context.impacts) {
    evidence.push({ label: i.effect, text: `${i.effect} ${i.mechanism}`, sourceIds: i.sourceIds })
  }
  for (const m of context.markets) {
    evidence.push({
      label: m.name,
      text: `${m.name} ${m.value} ${m.currency} ${m.unit ?? ''}`,
      sourceIds: [m.sourceId],
    })
  }
  // ORBIT's own register: the counts an insight may quote ("tracking 14 events across 15 countries").
  const severe = context.events.filter((e) => e.severity >= 4).length
  evidence.push({
    label: 'ORBIT event register',
    text: `ORBIT is tracking ${context.events.length} events across ${context.countries.length} countries; ${severe} rated severe 4 5 out of 5`,
    sourceIds: [],
  })
  return evidence
}

export function judgeClaim(claim: string, evidence: Evidence[]): ClaimJudgement {
  const claimNumbers = numbersIn(claim)
  const claimTerms = termsIn(claim)
  const scored = evidence
    .map((ev) => {
      const evTerms = termsIn(ev.text)
      const evNumbers = new Set(numbersIn(ev.text))
      const termHits = [...claimTerms].filter((t) => evTerms.has(t)).length
      const numberHits = claimNumbers.filter((n) => evNumbers.has(n)).length
      return { ev, termHits, numberHits, score: numberHits * 2 + termHits }
    })
    .sort((a, b) => b.score - a.score)
  const best = scored[0]
  const allNumbers = new Set(evidence.flatMap((ev) => numbersIn(ev.text)))
  const missing = claimNumbers.filter((n) => !allNumbers.has(n))
  const termShare = claimTerms.size ? (best?.termHits ?? 0) / claimTerms.size : 0
  const sourceIds = best && best.score > 0 ? [...new Set(best.ev.sourceIds)] : []

  if (claimNumbers.length) {
    return missing.length
      ? {
          verdict: 'unsupported',
          sourceIds: [],
          reason: `Figure ${missing[0]} does not appear in ORBIT's data.`,
        }
      : {
          verdict: 'supported',
          sourceIds,
          reason: `All figures match ORBIT's data (${best?.ev.label ?? 'evidence'}).`,
        }
  }
  return termShare >= 0.5
    ? {
        verdict: 'supported',
        sourceIds,
        reason: `${best.termHits} of ${claimTerms.size} key terms match "${best.ev.label}".`,
      }
    : {
        verdict: 'unsupported',
        sourceIds: [],
        reason: 'Too few key terms match any single piece of ORBIT data.',
      }
}

export const rulesVerifier: Verifier = {
  name: 'rules',
  async verify(claims, context) {
    const evidence = evidenceFor(context)
    return claims.map((claim) => judgeClaim(claim, evidence))
  },
}
