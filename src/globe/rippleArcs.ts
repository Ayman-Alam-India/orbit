import type { Country, ImpactChannel, ImpactLink, MarketQuote, OrbitEvent } from '@shared'

export type RippleArc = {
  id: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  channel: ImpactChannel
  strength: number
  /** Tooltip text, e.g. "India: Higher crude import bill". */
  label: string
}

/**
 * Turns ripple links into globe arcs: from the event's location to the affected country's centroid
 * (a market target lands on its country, e.g. USD/INR → India). Links without a place on the map
 * (Brent) are skipped. With `focusCountryId`, only arcs touching that country are kept.
 */
export function rippleArcs(
  impacts: ImpactLink[],
  events: OrbitEvent[],
  countries: Country[],
  markets: MarketQuote[],
  focusCountryId?: string,
): RippleArc[] {
  const arcs: RippleArc[] = []
  const seen = new Set<string>()
  for (const link of impacts) {
    const event = events.find((e) => e.id === link.eventId)
    const targetCountryId =
      link.target.kind === 'country'
        ? link.target.id
        : markets.find((m) => m.id === link.target.id)?.countryId
    const target = countries.find((c) => c.id === targetCountryId)
    if (!event || !target || event.countryIds.includes(target.id)) continue
    if (
      focusCountryId &&
      target.id !== focusCountryId &&
      !event.countryIds.includes(focusCountryId)
    )
      continue
    // One arc per event → country pair: several links along the same path would just overlap.
    const pair = `${event.id}->${target.id}`
    if (seen.has(pair)) continue
    seen.add(pair)
    arcs.push({
      id: link.id,
      startLat: event.location.lat,
      startLng: event.location.lng,
      endLat: target.centroid.lat,
      endLng: target.centroid.lng,
      channel: link.channel,
      strength: link.strength,
      label: `${target.name}: ${link.effect}`,
    })
  }
  return arcs
}

type Ring = [number, number][]
type Shape = { properties: { id: string }; geometry: { type: string; coordinates: unknown } }

/** Rough visual centre of a country shape: the average point of its largest outer ring. */
export function shapeCenter(shape: Shape): { lat: number; lng: number } | undefined {
  const polygons: Ring[][] =
    shape.geometry.type === 'Polygon'
      ? [shape.geometry.coordinates as Ring[]]
      : shape.geometry.type === 'MultiPolygon'
        ? (shape.geometry.coordinates as Ring[][])
        : []
  const ring = polygons.map((p) => p[0]).sort((a, b) => b.length - a.length)[0]
  if (!ring?.length) return undefined
  const lng = ring.reduce((s, [x]) => s + x, 0) / ring.length
  const lat = ring.reduce((s, [, y]) => s + y, 0) / ring.length
  return { lat, lng }
}

/** What-if arcs: from the scenario's chokepoint to every affected country (coloured as energy). */
export function simulationArcs(
  chokepoint: { lat: number; lng: number },
  affected: { countryId: string; role: string }[],
  shapes: Shape[],
): RippleArc[] {
  return affected.flatMap((a) => {
    const shape = shapes.find((s) => s.properties.id === a.countryId)
    const center = shape && shapeCenter(shape)
    return center
      ? [
          {
            id: `sim_${a.countryId}`,
            startLat: chokepoint.lat,
            startLng: chokepoint.lng,
            endLat: center.lat,
            endLng: center.lng,
            channel: 'energy' as const,
            strength: a.role === 'importer' ? 3 : 2,
            label: `${a.countryId}: ${a.role}`,
          },
        ]
      : []
  })
}
