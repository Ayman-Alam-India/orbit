import { DataModeSchema } from '@shared'
import { z } from 'zod'

// Load .env if it exists (Node built-in, no dotenv). Without it, the defaults below apply.
// Tests never read .env: they must not call real APIs with real keys (see vitest.config.ts).
if (!process.env.VITEST) {
  try {
    process.loadEnvFile()
  } catch {
    // No .env file: fine, everything has a safe default.
  }
}

export const AiProviderNameSchema = z.enum(['mock', 'google'])

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  DATA_MODE: DataModeSchema.default('mock'),
  AI_PROVIDER: AiProviderNameSchema.default('mock'),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  /** Gemini model used when AI_PROVIDER=google (check Google AI Studio for free-tier models). */
  GOOGLE_MODEL: z.string().default('gemini-3.5-flash,gemini-3.5-flash-lite'),
  /** Groq (free tier): the second, independent model used for claim verification. */
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  /** Gemini text-to-speech for the tour narrator (comma list, tried in order; same key as GOOGLE_*). */
  GOOGLE_TTS_MODEL: z.string().default('gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts'),
  /** A Gemini prebuilt voice: Charon is deep and calm; Kore, Puck and Aoede are alternatives. */
  GOOGLE_TTS_VOICE: z.string().default('Charon'),
})

// Treat empty values (e.g. `GOOGLE_GENERATIVE_AI_API_KEY=`) as "not set".
const provided = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''))

export const env = EnvSchema.parse(provided)
export type Env = z.infer<typeof EnvSchema>
