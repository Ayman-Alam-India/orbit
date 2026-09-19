import { CountryIdSchema } from '@shared'
import { Router } from 'express'
import { ok, parseInput } from '../http'
import { getNewsFeed } from '../sources'

export const newsRouter = Router()

newsRouter.get('/', async (req, res) => {
  const countryId = parseInput(CountryIdSchema.optional(), req.query.countryId)
  ok(res, await getNewsFeed(countryId))
})
