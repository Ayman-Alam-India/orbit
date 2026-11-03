import { CountryIdSchema, NewsRefreshRequestSchema } from '@shared'
import { Router } from 'express'
import { store } from '../data/store'
import { notFound, ok, parseInput } from '../http'
import { getNewsFeed, refreshNews } from '../sources'

export const newsRouter = Router()

newsRouter.get('/', async (req, res) => {
  const countryId = parseInput(CountryIdSchema.optional(), req.query.countryId)
  ok(res, await getNewsFeed(countryId))
})

/** The news panel's refresh button: fetch fresh live headlines now and wait for them. */
newsRouter.post('/refresh', async (req, res) => {
  const { countryId } = parseInput(NewsRefreshRequestSchema, req.body ?? {})
  if (countryId && !store.getCountry(countryId)) throw notFound(`Country "${countryId}"`)
  ok(res, await refreshNews(countryId))
})
