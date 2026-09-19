// @vitest-environment node
import { VerificationReportSchema, type AIInsight } from '@shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Both LLM verifiers configured; the insight itself comes from the offline provider.
vi.mock('../env', () => ({
  env: {
    PORT: 0,
    DATA_MODE: 'mock',
    AI_PROVIDER: 'mock',
    GOOGLE_GENERATIVE_AI_API_KEY: 'test-gemini',
    GOOGLE_MODEL: 'gemini-test',
    GROQ_API_KEY: 'test-groq',
    GROQ_MODEL: 'groq-test',
  },
}))

type FakeResult = { claim: number; verdict: string; sourceIds: string[]; reason: string }
const answers: Record<string, (claims: number) => FakeResult[] | Error> = {}
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: async (args: { model: { modelId: string }; prompt: string }) => {
    const claims = (args.prompt.match(/^\d+\. /gm) ?? []).length
    const result = answers[args.model.modelId](claims)
    if (result instanceof Error) throw result
    return { output: { results: result } }
  },
}))

const cache = new Map<string, unknown>()
vi.mock('../sources/cache', () => ({
  readCache: async (key: string) => cache.get(key),
  writeCache: async (key: string, value: unknown) => void cache.set(key, value),
}))

const { extractClaims } = await import('./verify/claims')
const { judgeClaim } = await import('./verify/rules')
const { verifyInsight } = await import('./verify')

const all = (verdict: string) => (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    claim: i + 1,
    verdict,
    sourceIds: ['src_mock_health_agency', 'src_invented'],
    reason: 'ok',
  }))

beforeEach(() => {
  cache.clear()
  answers['gemini-test'] = all('supported')
  answers['groq-test'] = all('supported')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('claim extraction', () => {
  it('splits the summary into sentences, adds key points and drops duplicates', () => {
    const insight = {
      summary: 'Cases rose to 6,757. Deaths reached 3,267 in Ituri.',
      keyPoints: ['Cases rose to 6,757.', 'Uganda reported 20 cases.'],
    } as AIInsight
    expect(extractClaims(insight)).toEqual([
      'Cases rose to 6,757.',
      'Deaths reached 3,267 in Ituri.',
      'Uganda reported 20 cases.',
    ])
  })
})

describe('rule-based verifier', () => {
  const evidence = [
    { label: 'Dengue', text: 'Dengue cases rise: 18,400 cases this month', sourceIds: ['src_a'] },
  ]
  it('supports claims whose figures and terms match the data', () => {
    expect(judgeClaim('Dengue cases reached 18,400 this month', evidence)).toMatchObject({
      verdict: 'supported',
      sourceIds: ['src_a'],
    })
  })
  it('flags figures that are not in the data', () => {
    expect(judgeClaim('Dengue cases reached 25,000', evidence).verdict).toBe('unsupported')
  })
})

describe('multi-model verification', () => {
  it('runs Gemini, Groq and the rules independently and reports agreement', async () => {
    const report = VerificationReportSchema.parse(await verifyInsight('country', 'IND'))
    expect(report.models).toEqual(['gemini', 'groq', 'rules'])
    expect(report.unavailable).toEqual([])
    expect(report.claims.length).toBeGreaterThan(0)
    for (const claim of report.claims) {
      expect(claim.verdicts.map((v) => v.model)).toEqual(['gemini', 'groq', 'rules'])
      // Invented source IDs from a model are dropped.
      expect(claim.verdicts[0].sourceIds).not.toContain('src_invented')
    }
  })

  it('marks claims where the models disagree and lowers the score', async () => {
    answers['groq-test'] = (n) =>
      all('supported')(n).map((r, i) => (i === 0 ? { ...r, verdict: 'contradicted' } : r))
    const report = await verifyInsight('country', 'BRA')
    expect(report.claims[0].agreement).toBe('disagree')
    expect(report.agreementScore).toBeLessThan(1)
  })

  it('lists a failing model as unavailable and keeps the others', async () => {
    answers['groq-test'] = () => new Error('429 rate limited')
    const report = await verifyInsight('country', 'USA')
    expect(report.models).toEqual(['gemini', 'rules'])
    expect(report.unavailable).toEqual([{ model: 'groq', reason: '429 rate limited' }])
  })

  it('serves the last complete report when a model fails later (offline demo)', async () => {
    const complete = await verifyInsight('event', 'hs_ind_dengue_surge')
    answers['gemini-test'] = () => new Error('fetch failed')
    const offline = await verifyInsight('event', 'hs_ind_dengue_surge')
    expect(offline.models).toEqual(complete.models)
    expect(offline.unavailable).toEqual([])
  })
})
