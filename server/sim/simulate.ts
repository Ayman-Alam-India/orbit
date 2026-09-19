import {
  SimulationResultSchema,
  type MarketQuote,
  type Scenario,
  type SimulatedImpact,
  type SimulationResult,
} from '@shared'

/** The shock the user may choose, in percent change of the Brent price. */
export const BRENT_PCT_RANGE = { min: -30, max: 100 } as const

/** US oil barrel in litres. */
export const LITRES_PER_BARREL = 158.987

export type SimulationInputs = {
  scenario: Scenario
  brentPct: number
  brent: MarketQuote
  usdInr: MarketQuote
  /** Retail petrol, for the "today → up to" comparison (optional). */
  petrol?: MarketQuote
}

const clamp = (n: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, n))
const signed = (n: number, digits = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`
const money = (n: number, symbol: string, digits = 2) =>
  `${symbol}${n.toLocaleString('en', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`

/**
 * What-if arithmetic. The shock size is the user's choice; everything else is either a sourced
 * figure or a live market value, and every number comes with its formula. Not a forecast.
 */
export function simulate(inputs: SimulationInputs): SimulationResult {
  const { scenario, brent, usdInr, petrol } = inputs
  const brentPct = clamp(inputs.brentPct, BRENT_PCT_RANGE)
  const to = brent.value * (1 + brentPct / 100)
  const deltaUsd = to - brent.value
  const perLitreInr = (deltaUsd * usdInr.value) / LITRES_PER_BARREL
  const impacts: SimulatedImpact[] = []

  impacts.push({
    id: 'brent',
    label: 'Brent crude',
    value: `${money(brent.value, '$')} → ${money(to, '$')}`,
    detail: `A ${signed(brentPct, 0)}% oil-price shock, the size you chose for this simulation.`,
    formula: `Brent ${money(brent.value, '$')}/bbl × (1 ${brentPct >= 0 ? '+' : '−'} ${Math.abs(brentPct)}%)`,
    basis: 'simulation',
    sourceIds: [brent.sourceId],
  })

  if (scenario.flow) {
    const { millionBarrelsPerDay: flow, bypassMillionBarrelsPerDay: bypass } = scenario.flow
    const atRisk = flow - bypass
    const worldConsumption = flow / (scenario.flow.shareOfWorldConsumptionPct / 100)
    impacts.push({
      id: 'flow_at_risk',
      label: `Oil stranded by the ${scenario.chokepoint.name} closure`,
      value: `${atRisk.toFixed(1)} million b/d`,
      detail: `About ${((atRisk / worldConsumption) * 100).toFixed(0)}% of world oil consumption could not be rerouted by pipeline.`,
      formula: `${flow} million b/d through the strait − ${bypass} million b/d pipeline bypass`,
      basis: 'simulation',
      sourceIds: scenario.flow.sourceIds,
    })
  }

  impacts.push({
    id: 'india_crude_bill',
    label: "India's crude import bill",
    value: `${signed(brentPct, 0)}%`,
    detail: 'Price effect only, at unchanged volumes. India imports 88.7% of its crude oil.',
    formula: 'change in bill = change in crude price (volumes held constant)',
    basis: 'simulation',
    sourceIds: ['src_theprint_india_crude', brent.sourceId],
  })

  impacts.push({
    id: 'crude_cost_per_litre',
    label: 'Crude cost per litre in India',
    value: `${signed(perLitreInr)} ₹/l`,
    detail: petrol
      ? `Upper bound if fully passed through, before taxes, refining margins and subsidies. Delhi petrol today: ${money(petrol.value, '₹')}/l → up to ${money(petrol.value + perLitreInr, '₹')}/l.`
      : 'Upper bound if fully passed through, before taxes, refining margins and subsidies.',
    formula: `ΔBrent ${money(deltaUsd, '$')}/bbl × ₹${usdInr.value.toFixed(2)}/$ ÷ ${LITRES_PER_BARREL.toFixed(0)} l/bbl`,
    basis: 'simulation',
    sourceIds: [brent.sourceId, usdInr.sourceId, ...(petrol ? [petrol.sourceId] : [])],
  })

  if (brentPct > 0) {
    impacts.push({
      id: 'rupee',
      label: 'The rupee',
      value: 'Pressure ↑ USD/INR',
      detail:
        "A bigger oil import bill raises India's demand for dollars, which tends to weaken the rupee.",
      formula: 'Qualitative: ORBIT analysis, no number is simulated',
      basis: 'analysis',
      sourceIds: ['src_theprint_india_crude'],
    })
  }

  return SimulationResultSchema.parse({
    scenario,
    brentPct,
    brent: { from: brent.value, to, asOf: brent.asOf, live: brent.live },
    impacts,
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  })
}
