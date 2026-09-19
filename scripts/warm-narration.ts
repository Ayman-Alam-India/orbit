// Generates the narrator's voice for every tour stop ahead of the demo, so the tour plays instantly
// (and offline: clips are saved in server/.cache/speech). Needs the dev server running: npm run dev.
// Run from the repo root: npm run warm:voice
import type { Country, ImpactLink, MarketQuote, OrbitEvent } from '@shared'
import { API_ROUTES } from '@shared'
import { buildTourStops } from '../src/features/tour/buildTourStops'

const BASE = process.env.ORBIT_API ?? 'http://localhost:8787'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return ((await res.json()) as { data: T }).data
}

const stops = buildTourStops(
  await get<OrbitEvent[]>(API_ROUTES.events()),
  await get<ImpactLink[]>(API_ROUTES.impacts()),
  await get<Country[]>(API_ROUTES.countries),
  await get<MarketQuote[]>(API_ROUTES.markets()),
)

let failed = 0
for (const [i, stop] of stops.entries()) {
  const started = Date.now()
  const res = await fetch(BASE + API_ROUTES.speech, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: stop.narration }),
  })
  const took = ((Date.now() - started) / 1000).toFixed(1)
  if (res.ok) console.log(`✓ ${i + 1}/${stops.length} ${stop.title} (${took}s)`)
  else {
    failed++
    console.log(`✗ ${i + 1}/${stops.length} ${stop.title}: ${res.status} ${await res.text()}`)
  }
}
console.log(failed ? `${failed} clip(s) missing: those stops use the browser voice.` : 'All narration ready.')
