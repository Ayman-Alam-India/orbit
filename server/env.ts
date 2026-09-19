import { DataModeSchema } from '@shared'
import { z } from 'zod'

// Load .env if it exists (Node built-in, no dotenv). Without it, the defaults below apply.
try {
  process.loadEnvFile()
} catch {
  // No .env file: fine, everything has a safe default.
}

export const AiProviderNameSchema = z.enum(['mock', 'google'])

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  DATA_MODE: DataModeSchema.default('mock'),
  AI_PROVIDER: AiProviderNameSchema.default('mock'),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  /** Gemini model used when AI_PROVIDER=google (check Google AI Studio for free-tier models). */
  GOOGLE_MODEL: z.string().default('gemini-2.5-flash'),
})

// Treat empty values (e.g. `GOOGLE_GENERATIVE_AI_API_KEY=`) as "not set".
const provided = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''))

export const env = EnvSchema.parse(provided)
export type Env = z.infer<typeof EnvSchema>
