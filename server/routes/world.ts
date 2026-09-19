import { CountryIdSchema, EventIdSchema } from '@shared'
import { Router } from 'express'
import { store } from '../data/store'
import { ok, parseInput } from '../http'
import { getMarkets } from '../sources/markets'
import { getWeather } from '../sources/weather'

/** Ripple effects, markets and weather: /api/impacts, /api/markets, /api/weather/:countryId. */
export const worldRouter = Router()

worldRouter.get('/impacts', (req, res) => {
  const eventId = parseInput(EventIdSchema.optional(), req.query.eventId)
  const countryId = parseInput(CountryIdSchema.optional(), req.query.countryId)
  ok(res, store.getImpacts({ eventId, countryId }))
})

worldRouter.get('/markets', async (req, res) => {
  const countryId = parseInput(CountryIdSchema.optional(), req.query.countryId)
  ok(res, await getMarkets(countryId))
})

worldRouter.get('/weather/:countryId', async (req, res) => {
  ok(res, await getWeather(parseInput(CountryIdSchema, req.params.countryId)))
})
