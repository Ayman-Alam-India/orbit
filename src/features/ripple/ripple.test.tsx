import type { Country, ImpactLink, MarketQuote, OrbitEvent } from '@shared'
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { rippleArcs } from '../../globe/rippleArcs'
import { withTestApiServer } from '../../test/apiServer'
import { renderWithProviders } from '../../test/utils'
import { MarketsPanel } from '../markets/MarketsPanel'
import { WeatherCard } from '../weather/WeatherCard'
import { RipplePanel } from './RippleList'

withTestApiServer()

describe('ripple effects panel', () => {
  it('shows the chain an event causes, with basis, channel and live market figure', async () => {
    renderWithProviders(<RipplePanel eventId="evt_usa_tariff_review" />)
    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(2)
    // The follow-on link is listed under (after) the link it follows from, one level deeper.
    expect(items[0]).toHaveAttribute('data-depth', '0')
    expect(items[1]).toHaveAttribute('data-depth', '1')
    expect(within(items[0]).getByText('Sourced')).toBeInTheDocument()
    expect(within(items[1]).getByText('ORBIT analysis')).toBeInTheDocument()
    expect(await within(items[1]).findByText('₹84.00')).toBeInTheDocument()
    expect(within(items[1]).getByRole('link', { name: 'India' })).toHaveAttribute(
      'href',
      '/country/IND',
    )
  })

  it('on a country, links each ripple back to its cause', async () => {
    renderWithProviders(<RipplePanel countryId="IND" />)
    const causes = await screen.findAllByRole('link', { name: /From: US opens review/ })
    expect(causes[0]).toHaveAttribute('href', '/country/USA/event/evt_usa_tariff_review')
  })
})

describe('markets panel', () => {
  it('shows value, daily change and snapshot label', async () => {
    renderWithProviders(<MarketsPanel ids={['mkt_brent']} />)
    expect(await screen.findByText('$80.00 /bbl')).toBeInTheDocument()
    expect(screen.getByText('-2.44%')).toHaveAttribute('data-direction', 'down')
    expect(screen.getByText(/Snapshot · 18 Sep 2026/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Brent crude: 1-month trend down' })).toBeInTheDocument()
  })
})

describe('weather card', () => {
  it('explains that live weather is off in mock mode instead of failing', async () => {
    renderWithProviders(<WeatherCard countryId="IND" />)
    expect(await screen.findByText(/Live weather is off/)).toBeInTheDocument()
  })
})

describe('globe ripple arcs', () => {
  const countries = [
    { id: 'USA', name: 'United States', centroid: { lat: 38, lng: -77 } },
    { id: 'IND', name: 'India', centroid: { lat: 28, lng: 77 } },
  ] as Country[]
  const events = [
    { id: 'evt_x', countryIds: ['USA'], location: { lat: 38.9, lng: -77 } },
  ] as OrbitEvent[]
  const markets = [{ id: 'mkt_usd_inr', countryId: 'IND' }] as MarketQuote[]
  const link = (id: string, target: ImpactLink['target']) =>
    ({
      id,
      eventId: 'evt_x',
      target,
      channel: 'finance',
      strength: 2,
      effect: 'Effect',
    }) as ImpactLink

  it('draws one arc per event → country pair, landing market targets on their country', () => {
    const arcs = rippleArcs(
      [
        link('imp_a', { kind: 'market', id: 'mkt_usd_inr' }),
        link('imp_b', { kind: 'country', id: 'IND' }),
      ],
      events,
      countries,
      markets,
    )
    expect(arcs).toHaveLength(1)
    expect(arcs[0]).toMatchObject({ endLat: 28, endLng: 77, label: 'India: Effect' })
  })

  it('skips targets in the event’s own country and filters by focus country', () => {
    const own = rippleArcs(
      [link('imp_c', { kind: 'country', id: 'USA' })],
      events,
      countries,
      markets,
    )
    expect(own).toEqual([])
    const focused = rippleArcs(
      [link('imp_b', { kind: 'country', id: 'IND' })],
      events,
      countries,
      markets,
      'BRA',
    )
    expect(focused).toEqual([])
  })
})
