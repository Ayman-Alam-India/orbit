import { EventIdSchema, OrbitEventKindSchema } from '@shared'
import { Router } from 'express'
import { store } from '../data/store'
import { notFound, ok, parseInput } from '../http'
import { getAutoEvent, getAutoEvents, runScan } from '../ingest/events'

export const eventsRouter = Router()

eventsRouter.get('/', (req, res) => {
  const kind = parseInput(OrbitEventKindSchema.optional(), req.query.kind)
  ok(res, store.getEvents(kind))
})

// Both must come before /:id, or they would be read as event IDs.
eventsRouter.get('/auto', async (_req, res) => ok(res, await getAutoEvents()))

eventsRouter.post('/scan', async (_req, res) => ok(res, await runScan()))

eventsRouter.get('/:id', async (req, res) => {
  const id = parseInput(EventIdSchema, req.params.id)
  const event = store.getEvent(id) ?? (await getAutoEvent(id))
  if (!event) throw notFound(`Event "${id}"`)
  ok(res, event)
})
