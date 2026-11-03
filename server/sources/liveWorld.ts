import type { ImpactLink, OrbitEvent, Trust } from '@shared'
import { readCache } from './cache'

/**
 * What the live pipeline (server/ingest/pipeline.ts) produced on its last pass, saved to
 * server/.cache/live-world.json so routes can serve it instantly and the demo works offline.
 */
export type LiveWorld = {
  ranAt: number
  /** WHO health signals and events ORBIT detected in headlines, each with trust. */
  events: OrbitEvent[]
  /** Ripple links made by ORBIT's rules, each with evidence and trust. */
  ripples: ImpactLink[]
  /** Trust per live headline URL. */
  headlineTrust: Record<string, Trust>
  /** Important or normal per live headline URL. */
  headlineImportance?: Record<string, 'important' | 'normal'>
  /** Whether each live source answered on this pass, for GET /api/status. */
  sources?: { name: string; ok: boolean; detail: string }[]
}

export const LIVE_WORLD_KEY = 'live-world'

export const readLiveWorld = () => readCache<LiveWorld>(LIVE_WORLD_KEY)
