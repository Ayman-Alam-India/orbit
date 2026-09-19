import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { env } from '../env'
import { AppError } from '../http'

/**
 * The narrator's voice: Gemini text-to-speech (free tier, same key as the AI). Every clip is saved to
 * server/.cache/speech/<hash>.wav, so each sentence is generated once and the tour replays offline.
 * Without a key or quota the route answers 503 and the browser falls back to its own voice.
 */
const SPEECH_DIR = resolve(process.cwd(), process.env.ORBIT_CACHE_DIR ?? 'server/.cache', 'speech')
const SAMPLE_RATE = 24000
/** After a quota error, don't ask again for a while (free-tier TTS limits are small). */
const COOLDOWN_MS = 60_000

/** Narration style (decision: Claude). Gemini TTS follows plain-language direction before the text. */
const STYLE = 'Read this as a calm, confident documentary narrator, at a measured pace:'

const inflight = new Map<string, Promise<Buffer>>()
let coolingUntil = 0

/** Wraps raw 16-bit mono PCM (what Gemini returns) in a WAV header so any browser can play it. */
export function pcmToWav(pcm: Buffer, sampleRate = SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // fmt chunk size
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28) // byte rate
  header.writeUInt16LE(2, 32) // block align
  header.writeUInt16LE(16, 34) // bits per sample
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

async function generate(text: string): Promise<Buffer> {
  const key = env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) throw new AppError('UPSTREAM', 503, 'Narration voice needs GOOGLE_GENERATIVE_AI_API_KEY')
  if (Date.now() < coolingUntil) throw new AppError('UPSTREAM', 503, 'Narration voice is rate-limited')
  let lastError = 'no model answered'
  for (const model of env.GOOGLE_TTS_MODEL.split(',').map((m) => m.trim())) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${STYLE}\n\n${text}` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: env.GOOGLE_TTS_VOICE } } },
          },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    ).catch((error: unknown) => ({ ok: false, status: 0, error }) as const)
    if (!res.ok) {
      lastError = `${model}: ${res.status || 'network error'}`
      continue
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[]
    }
    const data = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data
    if (data) return pcmToWav(Buffer.from(data, 'base64'))
    lastError = `${model}: no audio`
  }
  coolingUntil = Date.now() + COOLDOWN_MS
  throw new AppError('UPSTREAM', 503, `Narration voice unavailable (${lastError})`)
}

/** WAV audio for `text`: from the disk cache, or generated once and saved. */
export async function speech(text: string): Promise<Buffer> {
  const id = createHash('sha1').update(`${env.GOOGLE_TTS_VOICE}|${STYLE}|${text}`).digest('hex')
  const file = resolve(SPEECH_DIR, `${id}.wav`)
  const cached = await readFile(file).catch(() => undefined)
  if (cached) return cached
  // Several requests for the same sentence (e.g. prefetch + play) share one generation.
  let pending = inflight.get(id)
  if (!pending) {
    pending = generate(text).then(async (wav) => {
      await mkdir(SPEECH_DIR, { recursive: true })
      await writeFile(file, wav)
      return wav
    })
    pending.finally(() => inflight.delete(id)).catch(() => {})
    inflight.set(id, pending)
  }
  return pending
}
