import { CountryIdSchema, EventIdSchema, ScenarioIdSchema, type ImpactLink } from '@shared'
import { z } from 'zod'
import { Router } from 'express'
import { store } from '../data/store'
import { AppError, notFound, ok, parseInput } from '../http'
import { simulate } from '../sim/simulate'
import { getMarkets } from '../sources/markets'
import { getWeather } from '../sources/weather'
import { readLiveWorld } from '../sources/liveWorld'
import { curatedTrust } from '../sources/trustRules'

/**
 * Ripple effects, markets, weather and the what-if simulator:
 * /api/impacts, /api/markets, /api/weather/:countryId, /api/scenarios, /api/simulate.
 */
export const worldRouter = Router()

/** Curated ripples (verified) plus the ones ORBIT's rules found on the last live pass (with trust). */
worldRouter.get('/impacts', async (req, res) => {
  const eventId = parseInput(EventIdSchema.optional(), req.query.eventId)
  const countryId = parseInput(CountryIdSchema.optional(), req.query.countryId)
  const verified = curatedTrust()
  const curated = store.getImpacts({ eventId, countryId }).map((l) => ({ ...l, trust: verified }))
  const world = await readLiveWorld()
  const markets = store.getMarkets()
  const events = world?.events ?? []
  const touches = (l: ImpactLink) => {
    if (eventId) return l.eventId === eventId
    if (!countryId) return true
    const cause = store.getEvent(l.eventId) ?? events.find((e) => e.id === l.eventId)
    const target =
      l.target.kind === 'country'
        ? l.target.id
        : markets.find((m) => m.id === l.target.id)?.countryId
    return target === countryId || Boolean(cause?.countryIds.includes(countryId))
  }
  ok(res, [...curated, ...(world?.ripples ?? []).filter(touches)])
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
