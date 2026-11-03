// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../env', () => ({
  env: { GOOGLE_GENERATIVE_AI_API_KEY: 'test-key', GOOGLE_MODEL: 'model-a,model-b' },
}))
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: () => (id: string) => id }))

const { aiHealth, describeGeminiError, geminiBreaker, withGoogleModels } =
  await import('./googleModels')

afterEach(() => {
  geminiBreaker.openUntil = 0
  geminiBreaker.pauseMs = 0
})

describe('Gemini models', () => {
  it('falls through to the next model and says why the first failed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await withGoogleModels(async (model) => {
      if (model === ('model-a' as never))
        throw Object.assign(new Error('quota'), { statusCode: 429 })
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(aiHealth.gemini).toMatchObject({
      ok: true,
      detail: 'model-b answered (after model-a failed: 429 quota)',
    })
  })

  it('pauses Gemini after every model fails, so nothing waits on it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    geminiBreaker.pauseMs = 60_000
    const task = vi.fn(async () => {
      throw new Error('timeout')
    })
    await expect(withGoogleModels(task)).rejects.toThrow('timeout')
    expect(task).toHaveBeenCalledTimes(2)
    await expect(withGoogleModels(task)).rejects.toThrow(/paused/)
    expect(task).toHaveBeenCalledTimes(2) // not called again while paused
  })

  it('never prints a key in an error description', () => {
    expect(describeGeminiError(new Error('bad key AIzaSyA1234567890abcdefghij'))).toBe(
      'bad key [key hidden]',
    )
  })
})
