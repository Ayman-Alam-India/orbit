import type { AiProvider } from '../types'

/**
 * Gemini via Google AI Studio (free tier), using the Vercel AI SDK (`ai` + `@ai-sdk/google`,
 * both already installed). The key comes from GOOGLE_GENERATIVE_AI_API_KEY in .env.
 *
 * Not implemented yet: task ORB-AFF-02 (see tasks.json). Until then it throws, and
 * server/ai/index.ts falls back to the mock provider automatically.
 */
export const googleProvider: AiProvider = {
  name: 'google',
  async generateInsight() {
    throw new Error('Google provider not implemented yet (ORB-AFF-02)')
  },
  async ask() {
    throw new Error('Google provider not implemented yet (ORB-AFF-02)')
  },
}
