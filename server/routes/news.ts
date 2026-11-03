import { CountryIdSchema, ID_PREFIX, NewsRefreshRequestSchema, prefixedId } from '@shared'
import { Router } from 'express'
import { store } from '../data/store'
import { env } from '../env'
import { AppError, notFound, ok, parseInput } from '../http'
import { allLiveHeadlines } from '../ingest/pipeline'
import { getArticleMedia } from '../sources/articleMedia'
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

/**
 * The in-app article preview: the article's photos, videos and description. Only headlines ORBIT
 * already has can be looked up (by ID), so the server never fetches an address a visitor typed.
 */
newsRouter.get('/:id/media', async (req, res) => {
  const id = parseInput(prefixedId(ID_PREFIX.news), req.params.id)
  const headline =
    store.getNews().find((n) => n.id === id) ??
    (env.DATA_MODE === 'live' ? (await allLiveHeadlines()).find((n) => n.id === id) : undefined)
  if (!headline) throw notFound(`Headline "${id}"`)
  if (env.DATA_MODE !== 'live')
    throw new AppError('UPSTREAM', 503, 'Article previews need live data (DATA_MODE=live)')
  try {
    ok(res, await getArticleMedia(headline))
  } catch (err) {
    console.warn(
      `[sources] article preview for ${id} failed:`,
      err instanceof Error ? err.message : err,
    )
    throw new AppError('UPSTREAM', 502, "The article's page could not be read")
  }
})
