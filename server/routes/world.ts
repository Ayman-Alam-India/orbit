import { CountryIdSchema, EventIdSchema, ScenarioIdSchema } from '@shared'
import { z } from 'zod'
import { Router } from 'express'
import { store } from '../data/store'
import { AppError, notFound, ok, parseInput } from '../http'
import { simulate } from '../sim/simulate'
import { getMarkets } from '../sources/markets'
import { getWeather } from '../sources/weather'

/**
 * Ripple effects, markets, weather and the what-if simulator:
 * /api/impacts, /api/markets, /api/weather/:countryId, /api/scenarios, /api/simulate.
 */
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

worldRouter.get('/scenarios', (_req, res) => ok(res, store.getScenarios()))

worldRouter.get('/simulate', async (req, res) => {
  const scenarioId = parseInput(ScenarioIdSchema, req.query.scenario)
  const brentPct = parseInput(z.coerce.number().finite(), req.query.brentPct)
  const scenario = store.getScenario(scenarioId)
  if (!scenario) throw notFound(`Scenario "${scenarioId}"`)
  const markets = await getMarkets()
  const find = (id: string) => markets.find((m) => m.id === id)
  const brent = find('mkt_brent')
  const usdInr = find('mkt_usd_inr')
  if (!brent || !usdInr)
    throw new AppError('INTERNAL', 500, 'Brent or USD/INR market data is missing')
  ok(res, simulate({ scenario, brentPct, brent, usdInr, petrol: find('mkt_petrol_delhi') }))
})
