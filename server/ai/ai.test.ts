// @vitest-environment node
import { AIInsightSchema, AskAnswerSchema } from '@shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Pretend a Gemini key is configured, and replace the real model call with a controllable fake.
vi.mock('../env', () => ({
  env: {
    PORT: 0,
    DATA_MODE: 'mock',
    AI_PROVIDER: 'google',
    GOOGLE_GENERATIVE_AI_API_KEY: 'test-key',
    GOOGLE_MODEL: 'gemini-test',
  },
}))
const generateText = vi.fn()
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: (...args: unknown[]) => generateText(...args),
}))

const { askOrbit, generateInsight } = await import('.')

beforeEach(() => {
  generateText.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('AI module with the Google provider', () => {
  it('returns a schema-valid insight and drops invented source IDs', async () => {
    generateText.mockResolvedValue({
      output: {
        summary: 'Dengue is rising in India.',
        keyPoints: ['Cases are above the seasonal average.'],
        sourceIds: ['src_mock_health_agency', 'src_invented'],
        confidence: 'high',
      },
    })
    const insight = await generateInsight('country', 'IND')
    expect(AIInsightSchema.parse(insight).provider).toBe('google')
    expect(insight.sourceIds).toEqual(['src_mock_health_agency'])
    // The prompt only contains ORBIT's own data for that country.
    const { prompt } = generateText.mock.calls[0][0] as { prompt: string }
    expect(prompt).toContain('"id":"IND"')
    expect(prompt).not.toContain('"id":"BRA"')
  })

  it('answers questions with the current context', async () => {
    generateText.mockResolvedValue({
      output: { answer: 'Heat is driving admissions.', sourceIds: [] },
    })
    const answer = await askOrbit({ question: 'Why?', context: { countryId: 'BRA' } })
    expect(AskAnswerSchema.parse(answer).answer).toBe('Heat is driving admissions.')
  })

  it('falls back to the mock provider when the model fails (e.g. no wifi)', async () => {
    generateText.mockRejectedValue(new Error('fetch failed'))
    const insight = await generateInsight('event', 'evt_usa_tariff_review')
    expect(insight.provider).toBe('mock')
    const answer = await askOrbit({ question: 'What happened?' })
    expect(answer.provider).toBe('mock')
  })
})
