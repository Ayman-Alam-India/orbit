import type { AskRequest, InsightSubjectType } from '@shared'
import type { AiContext } from './types'

/**
 * How ORBIT talks (tone chosen by Claude on Ayman's instruction; the decision owner is Affan):
 * a calm intelligence analyst. Short, factual, never speculative beyond the data, always citing sources.
 */
export const SYSTEM_PROMPT = `You are ORBIT, a global intelligence analyst.
Rules:
- Use ONLY the facts in the CONTEXT JSON. Never add outside knowledge, numbers or events.
- Cite evidence with source IDs exactly as given in CONTEXT (e.g. "src_who"). Never invent source IDs.
- If CONTEXT does not answer the question, say so plainly.
- Ripple effects marked "ORBIT analysis" are reasoning, not reported fact: say so when you use them.
- Be concise, neutral and specific. No hype, no speculation, no advice.`

/** A compact JSON view of the context: only what the model needs, to keep prompts small and cheap. */
export function contextJson(context: AiContext) {
  return JSON.stringify({
    countries: context.countries.map((c) => ({
      id: c.id,
      name: c.name,
      region: c.region,
      riskLevel: c.riskLevel,
      summary: c.summary,
    })),
    events: context.events.map((e) => ({
      id: e.id,
      kind: e.kind,
      title: e.title,
      summary: e.summary,
      severity: e.severity,
      occurredAt: e.occurredAt,
      countryIds: e.countryIds,
      sourceIds: e.sourceIds,
      ...(e.kind === 'health'
        ? { indicator: e.indicator, metric: e.metric }
        : { category: e.category, actors: e.actors }),
    })),
    headlines: context.news.map((n) => ({
      title: n.title,
      sourceId: n.sourceId,
      eventId: n.eventId,
    })),
    ripple_effects: context.impacts.map((i) => ({
      causedBy: i.eventId,
      affects: i.target.id,
      channel: i.channel,
      direction: i.direction,
      effect: i.effect,
      mechanism: i.mechanism,
      basis: i.basis === 'sourced' ? 'stated by source' : 'ORBIT analysis',
      sourceIds: i.sourceIds,
    })),
    markets: context.markets.map((m) => ({
      id: m.id,
      name: m.name,
      value: m.value,
      currency: m.currency,
      unit: m.unit,
      previousClose: m.previousClose,
      asOf: m.asOf,
      sourceId: m.sourceId,
    })),
    sources: context.sources.map((s) => ({ id: s.id, name: s.name, reliability: s.reliability })),
  })
}

export function insightPrompt(subjectType: InsightSubjectType, context: AiContext) {
  const subject =
    subjectType === 'global'
      ? 'the current state of the world across all events'
      : subjectType === 'country'
        ? `the country ${context.countries[0]?.name ?? ''}`
        : `the event "${context.events[0]?.title ?? ''}"`
  return `Explain ${subject} for a decision-maker.
Return: a 2-3 sentence summary, 2-4 key points (each one short sentence), the source IDs you relied on,
and your confidence (low | medium | high) given how much evidence CONTEXT contains.

CONTEXT:
${contextJson(context)}`
}

export function askPrompt(request: AskRequest, context: AiContext) {
  return `Answer the user's question in 2-5 sentences using CONTEXT only, and list the source IDs you relied on.

QUESTION: ${request.question}

CONTEXT:
${contextJson(context)}`
}
