import { CountryIdSchema, type CountryId } from '@shared'
import { Router } from 'express'
import { store } from '../data/store'
import { notFound, ok, parseInput } from '../http'
import { getAutoEvents } from '../ingest/events'
import { curatedTrust } from '../sources/trustRules'

export const countriesRouter = Router()

function requireCountry(rawId: unknown): CountryId {
  const id = parseInput(CountryIdSchema, rawId)
  if (!store.getCountry(id)) throw notFound(`Country "${id}"`)
  return id
}

countriesRouter.get('/', (_req, res) => ok(res, store.getCountries()))

countriesRouter.get('/:id', (req, res) => ok(res, store.getCountry(requireCountry(req.params.id))))

/** Curated events (verified) plus live ones for this country (WHO signals, detected events), newest first. */
countriesRouter.get('/:id/events', async (req, res) => {
  const id = requireCountry(req.params.id)
  const verified = curatedTrust()
  const live = (await getAutoEvents()).filter((e) => e.countryIds.includes(id))
  ok(
    res,
    [...store.getEventsByCountry(id).map((e) => ({ ...e, trust: verified })), ...live].sort(
      (a, b) => b.occurredAt.localeCompare(a.occurredAt),
    ),
  )
})

countriesRouter.get('/:id/timeline', (req, res) =>
  ok(res, store.getTimeline(requireCountry(req.params.id))),
)
