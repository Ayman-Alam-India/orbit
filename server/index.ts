import { createApp } from './app'
import { getSeed, SeedValidationError } from './data/store'
import { env } from './env'
import { warmLiveNews } from './sources'
import { refreshMarkets } from './sources/markets'

// Validate all seed data before accepting requests: a broken JSON file fails loudly here, not mid-demo.
try {
  const seed = getSeed()
  console.log(
    `[api] seed ok: ${seed.countries.length} countries, ${seed.events.length} events, ${seed.news.length} headlines`,
  )
} catch (err) {
  if (err instanceof SeedValidationError) {
    console.error(`[api] seed data is invalid:\n${err.message}`)
    process.exit(1)
  }
  throw err
}

const server = createApp().listen(env.PORT, () => {
  console.log(
    `[api] listening on http://localhost:${env.PORT} (DATA_MODE=${env.DATA_MODE}, AI_PROVIDER=${env.AI_PROVIDER})`,
  )
  if (env.DATA_MODE === 'live') void refreshMarkets()
  void warmLiveNews()
})
// Keep idle connections open longer than the dev proxy does, so a reused socket is never closed mid-request
// (that showed up as ECONNRESET on /api/speech and silent narration).
server.keepAliveTimeout = 65_000
server.headersTimeout = 66_000
