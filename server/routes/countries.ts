import { CountryIdSchema, type CountryId } from '@shared'
import { Router } from 'express'
import { store } from '../data/store'
import { notFound, ok, parseInput } from '../http'

export const countriesRouter = Router()

function requireCountry(rawId: unknown): CountryId {
  const id = parseInput(CountryIdSchema, rawId)
  if (!store.getCountry(id)) throw notFound(`Country "${id}"`)
  return id
}

countriesRouter.get('/', (_req, res) => ok(res, store.getCountries()))

countriesRouter.get('/:id', (req, res) => ok(res, store.getCountry(requireCountry(req.params.id))))

countriesRouter.get('/:id/events', (req, res) =>
  ok(res, store.getEventsByCountry(requireCountry(req.params.id))),
)

countriesRouter.get('/:id/timeline', (req, res) =>
  ok(res, store.getTimeline(requireCountry(req.params.id))),
)
