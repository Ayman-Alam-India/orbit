// @vitest-environment node
import { MarketQuoteSchema, type MarketQuote } from '@shared'
import { describe, expect, it } from 'vitest'
import { parseFuelPage } from './fuel'

const base: MarketQuote = {
  id: 'mkt_petrol_delhi',
  name: 'Petrol, Delhi',
  kind: 'fuel',
  countryId: 'IND',
  value: 100,
  currency: 'INR',
  unit: 'per litre',
  previousClose: 100,
  asOf: '2026-09-19T00:00:00Z',
  sourceId: 'src_businesstoday_fuel',
  live: false,
}
const page = (title: string, rows = '') =>
  `<html><head><title>${title}</title></head><body><table>${rows}</table></body></html>`

describe('Goodreturns fuel pages', () => {
  it("reads today's price from the title and the recent days from the table", () => {
    const quote = parseFuelPage(
      page(
        'Petrol Price in New Delhi, Petrol Rate Today (3rd Nov, 2026), Rs. 102.12/Ltr - Goodreturns',
        '<tr><td>November 2, 2026</td><td>&#x20b9;101.90</td><td>0.00</td></tr>' +
          '<tr><td>November 1, 2026</td><td>&#x20b9;101.90</td><td>0.00</td></tr>',
      ),
      base,
    )
    expect(MarketQuoteSchema.parse(quote)).toMatchObject({
      value: 102.12,
      asOf: '2026-11-03T00:00:00Z',
      previousClose: 101.9,
      live: true,
      sourceId: 'src_goodreturns_fuel_live',
    })
    expect(quote!.history!.map((p) => p.date.slice(0, 10))).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ])
  })

  it('also reads the diesel title format', () => {
    const quote = parseFuelPage(
      page(
        'Diesel Price in Mumbai, Diesel Rate Today (3rd Nov 2026) - Rs. 97.83/Ltr - Goodreturns',
      ),
      { ...base, id: 'mkt_diesel_mumbai' },
    )
    expect(quote?.value).toBe(97.83)
  })

  it('refuses pages without a plausible price', () => {
    expect(parseFuelPage(page('Goodreturns: page not found'), base)).toBeUndefined()
    expect(
      parseFuelPage(page('Petrol Rate Today (3rd Nov, 2026), Rs. 9999.00/Ltr'), base),
    ).toBeUndefined()
  })
})
