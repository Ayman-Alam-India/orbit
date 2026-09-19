import { EventIdSchema, OrbitEventKindSchema } from '@shared'
import { Router } from 'express'
import { store } from '../data/store'
import { notFound, ok, parseInput } from '../http'

export const eventsRouter = Router()

eventsRouter.get('/', (req, res) => {
  const kind = parseInput(OrbitEventKindSchema.optional(), req.query.kind)
  ok(res, store.getEvents(kind))
})

eventsRouter.get('/:id', (req, res) => {
  const id = parseInput(EventIdSchema, req.params.id)
  const event = store.getEvent(id)
  if (!event) throw notFound(`Event "${id}"`)
  ok(res, event)
})
