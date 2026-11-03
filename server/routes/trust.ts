import { TrustCheckRequestSchema, type PipelineStatus } from '@shared'
import { Router } from 'express'
import { aiVerifiers } from '../ai/verify'
import { env } from '../env'
import { ok, parseInput } from '../http'
import { verifyNow } from '../ingest/verifyNow'
import { readLiveWorld } from '../sources/liveWorld'

/** POST /api/trust/check ("Verify now") and GET /api/status (is the live pipeline healthy?). */
export const trustRouter = Router()

trustRouter.post('/trust/check', async (req, res) => {
  ok(res, await verifyNow(parseInput(TrustCheckRequestSchema, req.body)))
})

trustRouter.get('/status', async (_req, res) => {
  const world = env.DATA_MODE === 'live' ? await readLiveWorld() : undefined
  const statuses = [
    ...(world?.events ?? []),
    ...(world?.ripples ?? []),
    ...Object.values(world?.headlineTrust ?? {}).map((trust) => ({ trust })),
  ].map((x) => x.trust?.status)
  const count = (s: string) => statuses.filter((x) => x === s).length
  const status: PipelineStatus = {
    dataMode: env.DATA_MODE,
    lastRunAt: world ? new Date(world.ranAt).toISOString() : undefined,
    headlines: Object.keys(world?.headlineTrust ?? {}).length,
    events: world?.events.length ?? 0,
    ripples: world?.ripples.length ?? 0,
    trust: {
      verified: count('verified'),
      corroborated: count('corroborated'),
      unverified: count('unverified'),
    },
    aiCheckers: aiVerifiers().map((v) => v.name),
    sources: world?.sources ?? [],
  }
  ok(res, status)
})
