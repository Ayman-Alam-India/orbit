import type { HealthStatus } from '@shared'
import { Router } from 'express'
import { activeProviderName } from '../ai'
import { store } from '../data/store'
import { env } from '../env'
import { ok } from '../http'

/** Small routes that describe the server itself: /api/health and /api/sources. */
export const metaRouter = Router()

metaRouter.get('/health', (_req, res) => {
  const status: HealthStatus = {
    status: 'ok',
    dataMode: env.DATA_MODE,
    aiProvider: activeProviderName(),
  }
  ok(res, status)
})

metaRouter.get('/sources', (_req, res) => ok(res, store.getSources()))
