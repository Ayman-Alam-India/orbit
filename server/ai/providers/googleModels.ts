import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import { env } from '../../env'

/** GOOGLE_MODEL may list several models ("a,b"): free-tier models get overloaded or run out of quota. */
export const googleModelIds = () =>
  env.GOOGLE_MODEL.split(',')
    .map((id) => id.trim())
    .filter(Boolean)

/**
 * Why a Gemini call failed, in one line and without the key: the HTTP status and Google's own message
 * (e.g. "400 API key not valid", "404 models/x is not found", "429 quota exceeded").
 */
export function describeGeminiError(err: unknown): string {
  const e = err as { statusCode?: number; message?: string; responseBody?: string }
  let detail = e?.message ?? String(err)
  try {
    const body = e?.responseBody
      ? (JSON.parse(e.responseBody) as { error?: { message?: string } })
      : undefined
    if (body?.error?.message) detail = body.error.message
  } catch {
    // Not JSON: keep the plain message.
  }
  const text = `${e?.statusCode ? `${e.statusCode} ` : ''}${detail}`.replace(/\s+/g, ' ').trim()
  // Never print a key, even if an error message echoes one back.
  return text.replace(/AIza[0-9A-Za-z_-]{10,}/g, '[key hidden]').slice(0, 300)
}

/** Last outcome per AI service, shown on GET /api/status so a bad key or model is visible in the app. */
export const aiHealth: Record<'gemini' | 'groq', { ok?: boolean; detail?: string; at?: number }> = {
  gemini: {},
  groq: {},
}

/**
 * A speed limit for the free tier: at most this many Gemini calls start per minute across all of
 * ORBIT (insights, summaries, ranking, checks). Extra calls wait their turn instead of flooding.
 */
export const geminiRate = { perMinute: process.env.VITEST ? Infinity : 8 }
const recent: number[] = []

async function waitForSlot() {
  for (;;) {
    const now = Date.now()
    while (recent.length && now - recent[0] > 60_000) recent.shift()
    if (recent.length < geminiRate.perMinute) {
      recent.push(now)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 60_000 - (now - recent[0]) + 50))
  }
}

/**
 * Circuit breaker: when every model fails (quota used up, Google throttling, no network), Gemini is
 * not called again for this long. Callers fail fast and use their non-AI fallback, so a bad key or an
 * exhausted quota can never stall the live pipeline or keep a visitor waiting.
 */
export const geminiBreaker = { pauseMs: process.env.VITEST ? 0 : 5 * 60_000, openUntil: 0 }

/** Runs `task` with each configured Gemini model in turn until one succeeds; throws the last error. */
export async function withGoogleModels<T>(task: (model: LanguageModel) => Promise<T>): Promise<T> {
  if (Date.now() < geminiBreaker.openUntil)
    throw new Error(
      `Gemini paused until ${new Date(geminiBreaker.openUntil).toISOString()} after every model failed`,
    )
  const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })
  let lastError: unknown = new Error('GOOGLE_MODEL is empty')
  const failures: string[] = []
  for (const id of googleModelIds()) {
    try {
      await waitForSlot()
      const result = await task(google(id))
      const before = failures.length ? ` (after ${failures.join('; ')})` : ''
      aiHealth.gemini = { ok: true, detail: `${id} answered${before}`, at: Date.now() }
      return result
    } catch (err) {
      lastError = err
      failures.push(`${id} failed: ${describeGeminiError(err)}`)
      aiHealth.gemini = { ok: false, detail: failures.join('; '), at: Date.now() }
      console.warn(
        `[ai] Gemini model ${id} failed (${describeGeminiError(err)}), trying the next one if configured`,
      )
    }
  }
  // Every model failed: pause Gemini so nothing queues up behind it.
  if (googleModelIds().length) {
    geminiBreaker.openUntil = Date.now() + geminiBreaker.pauseMs
    aiHealth.gemini = {
      ok: false,
      detail: `${aiHealth.gemini.detail ?? ''} · paused for ${geminiBreaker.pauseMs / 60_000} min`,
      at: Date.now(),
    }
  }
  throw lastError
}
