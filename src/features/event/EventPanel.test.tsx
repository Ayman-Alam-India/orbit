import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../App'
import { withTestApiServer } from '../../test/apiServer'
import { renderWithProviders } from '../../test/utils'

vi.mock('../../globe/OrbitGlobe', () => ({ default: () => <div data-testid="globe" /> }))
withTestApiServer()

describe('event view', () => {
  it('shows a health signal briefing with its metric and sources', async () => {
    renderWithProviders(<AppRoutes />, { route: '/country/IND/event/hs_ind_dengue_surge' })
    expect(
      await screen.findByRole('heading', { name: 'Dengue cases rise after late monsoon' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Health signal')).toBeInTheDocument()
    expect(await screen.findByText('17 Sep 2026 · India')).toBeInTheDocument()
    expect(screen.getByText('18,400')).toBeInTheDocument()
    expect(screen.getByText('cases this month')).toBeInTheDocument()
    expect(
      await screen.findByRole('link', { name: 'Mock Global Health Agency' }),
    ).toBeInTheDocument()
  })

  it('shows category and actors for a geopolitical event', async () => {
    renderWithProviders(<AppRoutes />, {
      route: '/country/IND/event/evt_ind_usa_tech_partnership',
    })
    expect(await screen.findByText('diplomacy')).toBeInTheDocument()
    expect(screen.getByText('Government of India, US Government')).toBeInTheDocument()
    expect(await screen.findByText('15 Sep 2026 · India, United States')).toBeInTheDocument()
  })

  it('lists only headlines linked to this event', async () => {
    renderWithProviders(<AppRoutes />, { route: '/country/IND/event/hs_ind_dengue_surge' })
    const panel = (await screen.findByText('Related headlines')).closest('section')!
    expect(
      await within(panel).findByText('Mock: Hospitals in Mumbai add dengue wards'),
    ).toBeInTheDocument()
    expect(within(panel).queryByText(/chip research pact/)).not.toBeInTheDocument()
  })

  it('shows an error state for an unknown event', async () => {
    renderWithProviders(<AppRoutes />, { route: '/country/IND/event/evt_missing' })
    expect(await screen.findByText('Could not load event')).toBeInTheDocument()
  })
})
