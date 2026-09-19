// @vitest-environment node
import { API_ROUTES, SimulationResultSchema, type MarketQuote, type Scenario } from '@shared'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { startTestServer } from '../testServer'
import { LITRES_PER_BARREL, simulate } from './simulate'

const quote = (id: string, value: number, sourceId = 'src_mock_wire') =>
  ({ id, value, sourceId, asOf: '2026-09-18T00:00:00Z', live: false }) as MarketQuote

const scenario = {
  id: 'scn_test',
  title: 'Test',
  description: 'Test',
  chokepoint: { name: 'Test Strait', location: { lat: 0, lng: 0 } },
  defaultBrentPct: 20,
  facts: [],
  flow: {
    millionBarrelsPerDay: 20,
    bypassMillionBarrelsPerDay: 2.6,
    shareOfWorldConsumptionPct: 20,
    sourceIds: ['src_mock_wire'],
  },
  affected: [],
} as Scenario

const run = (brentPct: number) =>
  simulate({
    scenario,
    brentPct,
    brent: quote('mkt_brent', 100),
    usdInr: quote('mkt_usd_inr', 90),
    petrol: quote('mkt_petrol_delhi', 100),
  })
const impact = (id: string, pct = 30) => run(pct).impacts.find((i) => i.id === id)!

describe('what-if simulation', () => {
  it('applies the chosen shock to Brent', () => {
    const result = run(30)
    expect(result.brent).toMatchObject({ from: 100, to: 130 })
    expect(impact('brent').value).toBe('$100.00 → $130.00')
  })

  it('computes oil stranded after pipeline bypass, with the formula', () => {
    const flow = impact('flow_at_risk')
    expect(flow.value).toBe('17.4 million b/d')
    expect(flow.detail).toContain('About 17%')
    expect(flow.formula).toContain('20 million b/d')
  })

  it('computes the upper-bound crude cost per litre in rupees', () => {
    const expected = (30 * 90) / LITRES_PER_BARREL // $30/bbl more × ₹90/$ ÷ 159 l
    expect(impact('crude_cost_per_litre').value).toBe(`+${expected.toFixed(1)} ₹/l`)
    expect(impact('crude_cost_per_litre').detail).toContain('₹100.00/l → up to ₹116.98/l')
  })

  it('handles price falls and clamps extreme shocks', () => {
    expect(impact('crude_cost_per_litre', -20).value.startsWith('−')).toBe(true)
    expect(impact('rupee', -20)).toBeUndefined()
    expect(run(500).brentPct).toBe(100)
    expect(run(-90).brentPct).toBe(-30)
  })

  it('marks qualitative rows as analysis and numbers as simulation', () => {
    const result = run(30)
    expect(result.impacts.find((i) => i.id === 'rupee')?.basis).toBe('analysis')
    expect(
      result.impacts.filter((i) => i.id !== 'rupee').every((i) => i.basis === 'simulation'),
    ).toBe(true)
  })
})

describe('simulation API', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>
  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    server = await startTestServer()
  })
  afterAll(() => server.close())

  it('lists scenarios and simulates one with live-or-snapshot market data', async () => {
    const scenarios = (await (await fetch(server.baseUrl + API_ROUTES.scenarios)).json()) as {
      data: Scenario[]
    }
    expect(scenarios.data.map((s) => s.id)).toEqual(['scn_test_closure'])
    const res = await fetch(server.baseUrl + API_ROUTES.simulate('scn_test_closure', 25))
    const result = SimulationResultSchema.parse(((await res.json()) as { data: unknown }).data)
    expect(result.brent).toMatchObject({ from: 80, to: 100 })
  })

  it('rejects unknown scenarios and bad shocks', async () => {
    expect((await fetch(server.baseUrl + API_ROUTES.simulate('scn_nope', 10))).status).toBe(404)
    expect(
      (await fetch(`${server.baseUrl}/api/simulate?scenario=scn_test_closure&brentPct=abc`)).status,
    ).toBe(400)
  })
})
