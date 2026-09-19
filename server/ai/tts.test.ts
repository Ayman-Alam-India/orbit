// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

// A configured key and two TTS models; the real Gemini call is replaced by a fake fetch.
vi.mock('../env', () => ({
  env: {
    GOOGLE_GENERATIVE_AI_API_KEY: 'test-key',
    GOOGLE_TTS_MODEL: 'tts-a,tts-b',
    GOOGLE_TTS_VOICE: 'Charon',
  },
}))

const { pcmToWav, speech } = await import('./tts')
const pcm = Buffer.from([1, 0, 2, 0, 3, 0])
const audioResponse = () =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { data: pcm.toString('base64') } }] } }],
    }),
  )

afterEach(() => vi.unstubAllGlobals())

describe('narrator voice', () => {
  it('wraps Gemini PCM in a playable WAV header', () => {
    const wav = pcmToWav(pcm)
    expect(wav.subarray(0, 4).toString()).toBe('RIFF')
    expect(wav.subarray(8, 12).toString()).toBe('WAVE')
    expect(wav.readUInt32LE(24)).toBe(24000)
    expect(wav.readUInt32LE(40)).toBe(pcm.length)
    expect(wav.subarray(44)).toEqual(pcm)
  })

  it('falls back to the next model, then serves the saved clip without calling Gemini again', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('quota', { status: 429 }))
      .mockResolvedValueOnce(audioResponse())
    vi.stubGlobal('fetch', fetch)
    const text = `Unique sentence ${Date.now()}`
    const first = await speech(text)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(String(fetch.mock.calls[1][0])).toContain('/models/tts-b:generateContent')
    expect(await speech(text)).toEqual(first)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('answers 503 when no model has audio, so the browser voice takes over', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('quota', { status: 429 })))
    await expect(speech(`Another sentence ${Date.now()}`)).rejects.toMatchObject({
      status: 503,
      code: 'UPSTREAM',
    })
  })
})
