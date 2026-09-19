import { createApp } from './app'
import { getSeed, SeedValidationError } from './data/store'
import { env } from './env'

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

createApp().listen(env.PORT, () => {
  console.log(
    `[api] listening on http://localhost:${env.PORT} (DATA_MODE=${env.DATA_MODE}, AI_PROVIDER=${env.AI_PROVIDER})`,
  )
})
