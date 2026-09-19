import type { MarketQuote } from '@shared'

const SYMBOL: Record<string, string> = { USD: '$', INR: '₹', EUR: '€' }

/** "$99.29 /bbl", "₹95.88", "23,346.40", "₹102.12 /l". */
export function formatMarketValue(m: MarketQuote) {
  const number = m.value.toLocaleString('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const suffix = m.unit === 'per barrel' ? ' /bbl' : m.unit === 'per litre' ? ' /l' : ''
  if (m.kind === 'index') return number
  const currency = m.kind === 'fx' ? 'INR' : m.currency
  return `${SYMBOL[currency] ?? `${currency} `}${number}${suffix}`
}

/** Daily change in percent, or undefined when there is no previous close. */
export function changePct(m: MarketQuote) {
  if (m.previousClose === undefined || m.previousClose === 0) return undefined
  return ((m.value - m.previousClose) / m.previousClose) * 100
}

export const formatChange = (pct: number) => `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`
