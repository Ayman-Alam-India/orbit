import express from 'express'
import { errorHandler, notFoundHandler, requestLogger } from './http'
import { aiRouter } from './routes/ai'
import { countriesRouter } from './routes/countries'
import { eventsRouter } from './routes/events'
import { metaRouter } from './routes/meta'
import { newsRouter } from './routes/news'

/** Builds the Express app. Exported separately from index.ts so tests can start it on a random port. */
export function createApp() {
  const app = express()
  app.use(express.json({ limit: '100kb' }))
  app.use(requestLogger)

  app.use('/api', metaRouter)
  app.use('/api', aiRouter)
  app.use('/api/countries', countriesRouter)
  app.use('/api/events', eventsRouter)
  app.use('/api/news', newsRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
