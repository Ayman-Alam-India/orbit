import type { AskRequest, CountryId, OrbitEvent } from '@shared'
import type { AiContext, AiProvider } from '../types'

const bySeverity = (events: OrbitEvent[]) => [...events].sort((a, b) => b.severity - a.severity)
const sourcesOf = (events: OrbitEvent[]) => [...new Set(events.flatMap((e) => e.sourceIds))]
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** One short line per event: the facts a briefing leads with. */
function eventPoint(e: OrbitEvent) {
  const detail =
    e.kind === 'health' && e.metric
      ? `${e.metric.value.toLocaleString('en')} ${e.metric.unit}`
      : `severity ${e.severity}/5`
  return `${e.title} (${detail})`
}

function focusName(request: AskRequest, context: AiContext) {
  const eventId = request.context?.eventId
  if (eventId) return context.events.find((e) => e.id === eventId)?.title ?? 'this event'
  const countryId = request.context?.countryId
  if (countryId) return context.countries.find((c) => c.id === countryId)?.name ?? countryId
  return 'the world'
}

/** Prefer events the question names; otherwise the open country/event. */
function eventsForQuestion(request: AskRequest, context: AiContext): OrbitEvent[] {
  const q = request.question.toLowerCase()
  const named = context.countries.filter(
    (c) => q.includes(c.name.toLowerCase()) || q.includes(c.id.toLowerCase()),
  )
  if (named.length) {
    const ids = new Set(named.map((c) => c.id))
    return bySeverity(context.events.filter((e) => e.countryIds.some((id) => ids.has(id))))
  }
  const eventId = request.context?.eventId
  if (eventId) {
    const open = context.events.find((e) => e.id === eventId)
    return open ? [open] : []
  }
  const countryId = request.context?.countryId as CountryId | undefined
  if (countryId) return bySeverity(context.events.filter((e) => e.countryIds.includes(countryId)))
  return bySeverity(context.events)
}

/**
 * Offline analysis: rule-based summaries built only from ORBIT's data. Works with no API key and no
 * network, and is always the fallback when a real provider fails. It never invents facts.
 */
export const mockProvider: AiProvider = {
  name: 'mock',

  async generateInsight({ subjectType, subjectId, context }) {
    const top = bySeverity(context.events)
    const severe = top.filter((e) => e.severity >= 4).length
    const summary =
      subjectType === 'event' && top[0]
        ? top[0].summary
        : subjectType === 'country' && context.countries[0]
          ? context.countries[0].summary
          : `ORBIT is tracking ${count(context.events.length, 'event', 'events')} across ${count(
              context.countries.length,
              'country',
              'countries',
            )}; ${severe} ${severe === 1 ? 'is' : 'are'} rated severe (4–5 out of 5).`
    return {
      id: `ins_${subjectType}_${subjectId.toLowerCase()}`,
      subjectType,
      subjectId,
      summary,
      keyPoints: top.length
        ? top.slice(0, 3).map(eventPoint)
        : ['No tracked events for this subject yet.'],
      sourceIds: sourcesOf(top.slice(0, 3)),
      confidence: top.length ? 'medium' : 'low',
      provider: 'mock',
      generatedAt: new Date().toISOString(),
    }
  },

  async ask(request, context) {
    const top = eventsForQuestion(request, context).slice(0, 2)
    const facts = top.map((e) => `${e.title}: ${e.summary}`).join(' ')
    const focus = focusName(request, context)
    return {
      answer: top.length
        ? `Offline analysis for ${focus} (the AI model is not connected, so this is a summary of ORBIT's data rather than a direct answer). ${facts}`
        : `Offline analysis for ${focus}: ORBIT has no tracked events here yet.`,
      sourceIds: sourcesOf(top),
      provider: 'mock',
      generatedAt: new Date().toISOString(),
    }
  },
}
