import { MarketQuoteSchema, type MarketQuote } from '@shared'

/**
 * Live Indian pump prices for the four metros from Goodreturns (free, keyless, updated every
 * morning). Each city page's title states today's price ("… Rate Today (3rd Nov, 2026), Rs.
 * 102.12/Ltr") and the page lists the last 10 days, which becomes the sparkline history.
 */
const BASE_URL = 'https://www.goodreturns.in/'
const TIMEOUT_MS = 10_000

/** Market ID → Goodreturns page. Every ID here exists in server/data/seed/markets.json. */
export const FUEL_PAGES: Record<string, string> = {
  mkt_petrol_delhi: 'petrol-price-in-new-delhi',
  mkt_diesel_delhi: 'diesel-price-in-new-delhi',
  mkt_petrol_mumbai: 'petrol-price-in-mumbai',
  mkt_diesel_mumbai: 'diesel-price-in-mumbai',
  mkt_petrol_kolkata: 'petrol-price-in-kolkata',
  mkt_diesel_kolkata: 'diesel-price-in-kolkata',
  mkt_petrol_chennai: 'petrol-price-in-chennai',
  mkt_diesel_chennai: 'diesel-price-in-chennai',
}

/** Live fuel quotes cite this source (it exists in server/data/seed/sources.json). */
export const FUEL_SOURCE_ID = 'src_goodreturns_fuel_live'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const day = (y: string, month: string, d: string) => {
  const m = MONTHS.indexOf(month.slice(0, 3).toLowerCase())
  return m < 0
    ? undefined
    : `${y}-${String(m + 1).padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`
}
/** A pump price outside this range is a parsing mistake, not a price. */
const plausible = (n: number) => n > 40 && n < 250

/** Today's price and the last days' prices from one city page. Undefined when the page doesn't fit. */
export function parseFuelPage(html: string, base: MarketQuote): MarketQuote | undefined {
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? ''
  const m =
    /Today \((\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]{3,9}),? (\d{4})\).*?Rs\.\s*([\d.]+)\s*\/\s*Ltr/i.exec(
      title,
    )
  if (!m) return undefined
  const value = Number(m[4])
  const asOf = day(m[3], m[2], m[1])
  if (!plausible(value) || !asOf) return undefined

  // "November 2, 2026 ₹102.12 0.00" rows of the last-10-days table, oldest first.
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&#x20b9;|&#8377;|₹/gi, ' ₹ ')
  const rows = [...text.matchAll(/([A-Z][a-z]+) (\d{1,2}), (\d{4})\s+₹\s*([\d.]+)/g)]
    .map((r) => ({ date: day(r[3], r[1], r[2]), value: Number(r[4]) }))
    .filter((p): p is { date: string; value: number } => Boolean(p.date) && plausible(p.value))
  const history = [
    ...new Map([...rows, { date: asOf, value }].map((p) => [p.date, p])).values(),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const parsed = MarketQuoteSchema.safeParse({
    ...base,
    value,
    previousClose: history.length > 1 ? history[history.length - 2].value : base.previousClose,
    history,
    asOf,
    sourceId: FUEL_SOURCE_ID,
    live: true,
  })
  return parsed.success ? parsed.data : undefined
}

/** Today's price for one curated fuel quote. Throws on any failure. */
export async function fetchFuelQuote(base: MarketQuote): Promise<MarketQuote> {
  const page = FUEL_PAGES[base.id]
  if (!page) return base
  const res = await fetch(`${BASE_URL}${page}.html`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (ORBIT hackathon demo)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Goodreturns responded ${res.status} for ${page}`)
  const quote = parseFuelPage(await res.text(), base)
  if (!quote) throw new Error(`Goodreturns page ${page} did not contain a price`)
  return quote
}
