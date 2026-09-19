import type { Country, ImpactLink, MarketQuote, OrbitEvent } from '@shared'

export type TourStop = {
  id: string
  kind: 'intro' | 'event' | 'ripple' | 'outro'
  /** Small label above the title, e.g. "Health signal · Critical". */
  eyebrow: string
  title: string
  /** One or two sentences shown on screen. */
  caption: string
  /** What is read aloud: built only from ORBIT's verified data, never free AI text. */
  narration: string
  camera: { lat: number; lng: number; altitude: number }
  /** Where "Open" takes the viewer, if anywhere. */
  eventId?: string
  countryId?: string
}

const SEVERITY_WORD = ['', 'Low', 'Guarded', 'Elevated', 'High', 'Critical']
const firstSentence = (text: string) => text.match(/^.+?[.!?](\s|$)/)?.[0].trim() ?? text

function targetName(link: ImpactLink, countries: Country[], markets: MarketQuote[]) {
  return link.target.kind === 'country'
    ? (countries.find((c) => c.id === link.target.id)?.name ?? link.target.id)
    : (markets.find((m) => m.id === link.target.id)?.name ?? link.target.id)
}

/**
 * The guided tour: intro → the most severe events → the strongest ripple chain → outro.
 * Everything said comes from event summaries and sourced ripple links.
 */
export function buildTourStops(
  events: OrbitEvent[],
  impacts: ImpactLink[],
  countries: Country[],
  markets: MarketQuote[],
  maxEvents = 5,
): TourStop[] {
  const top = [...events]
    .sort((a, b) => b.severity - a.severity || b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, maxEvents)
  const severe = events.filter((e) => e.severity >= 4).length

  const stops: TourStop[] = [
    {
      id: 'intro',
      kind: 'intro',
      eyebrow: 'ORBIT briefing',
      title: 'The world right now',
      caption: `ORBIT is tracking ${events.length} events across ${countries.length} countries. ${severe} are rated severe.`,
      narration: `Welcome to ORBIT. We are tracking ${events.length} events across ${countries.length} countries, and ${severe} of them are rated severe. Here is what matters most today.`,
      camera: { lat: 20, lng: 30, altitude: 2.6 },
    },
  ]

  for (const e of top) {
    const ripple = impacts
      .filter((i) => i.eventId === e.id)
      .sort((a, b) => b.strength - a.strength)[0]
    const rippleLine = ripple
      ? `Ripple effect: ${ripple.effect.toLowerCase()} for ${targetName(ripple, countries, markets)}.`
      : ''
    stops.push({
      id: `event_${e.id}`,
      kind: 'event',
      eyebrow: `${e.kind === 'health' ? 'Health signal' : 'Geopolitics'} · ${SEVERITY_WORD[e.severity]}`,
      title: e.title,
      caption: [firstSentence(e.summary), rippleLine].filter(Boolean).join(' '),
      narration: [`${e.title}.`, e.summary, rippleLine].filter(Boolean).join(' '),
      camera: { ...e.location, altitude: 1.6 },
      eventId: e.id,
      countryId: e.countryIds[0],
    })
  }

  // The strongest chain (a link with follow-on links), told end to end.
  const chainRoot = [...impacts]
    .filter((i) => !i.followsImpactId && impacts.some((c) => c.followsImpactId === i.id))
    .sort((a, b) => b.strength - a.strength)[0]
  if (chainRoot) {
    const chain: ImpactLink[] = [chainRoot]
    for (let next = impacts.find((i) => i.followsImpactId === chainRoot.id); next; ) {
      chain.push(next)
      const current: ImpactLink = next
      next = impacts.find((i) => i.followsImpactId === current.id)
    }
    const cause = events.find((e) => e.id === chainRoot.eventId)
    const landing = chain
      .map((l) => (l.target.kind === 'country' ? countries.find((c) => c.id === l.target.id) : undefined))
      .find(Boolean)
    const steps = chain.map((l) => `${l.effect.toLowerCase()} (${targetName(l, countries, markets)})`)
    stops.push({
      id: `ripple_${chainRoot.id}`,
      kind: 'ripple',
      eyebrow: 'Ripple effect',
      title: `How ${cause?.title ?? 'one event'} spreads`,
      caption: steps.join(' → '),
      narration: `Now watch the ripple. ${cause?.title ?? 'This event'} leads to ${steps.join(', then ')}. Some of these links are ORBIT analysis built on sourced facts, and ORBIT always says which.`,
      camera: landing ? { ...landing.centroid, altitude: 2 } : { lat: 20, lng: 60, altitude: 2.2 },
      eventId: cause?.id,
      countryId: cause?.countryIds[0],
    })
  }

  stops.push({
    id: 'outro',
    kind: 'outro',
    eyebrow: 'Your turn',
    title: 'Ask ORBIT anything',
    caption: 'Open any country or event, ask ORBIT a question, verify its claims, or test a what-if scenario.',
    narration:
      'That is the briefing. Open any country or event, ask ORBIT a question and check its claims, or try a what-if scenario.',
    camera: { lat: 15, lng: 10, altitude: 2.6 },
  })
  return stops
}
