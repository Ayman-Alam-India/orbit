import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../App'
import { withTestApiServer } from '../../test/apiServer'
import { renderWithProviders } from '../../test/utils'

vi.mock('../../globe/OrbitGlobe', () => ({ default: () => <div data-testid="globe" /> }))
withTestApiServer()

describe('country view', () => {
  it('shows the hero with region, stats and summary', async () => {
    renderWithProviders(<AppRoutes />, { route: '/country/IND' })
    expect(await screen.findByRole('heading', { name: 'India' })).toBeInTheDocument()
    expect(screen.getByText('Country · South Asia')).toBeInTheDocument()
    expect(screen.getByText('New Delhi')).toBeInTheDocument()
    expect(screen.getByText('1.45B')).toBeInTheDocument()
  })

  it('lists events newest first, linking to the event view', async () => {
    renderWithProviders(<AppRoutes />, { route: '/country/IND' })
    const dengue = await screen.findByRole('link', { name: /Dengue cases rise after late monsoon/ })
    const tech = screen.getByRole('link', { name: /India and US expand technology partnership/ })
    expect(dengue).toHaveAttribute('href', '/country/IND/event/hs_ind_dengue_surge')
    // Dengue (17 Sep) comes before the partnership (15 Sep).
    expect(dengue.compareDocumentPosition(tech) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(dengue).getByText('17 Sep 2026')).toBeInTheDocument()
  })

  it('shows sections in the agreed order', async () => {
    renderWithProviders(<AppRoutes />, { route: '/country/IND' })
    await screen.findByRole('heading', { name: 'India' })
    const eyebrows = ['Events', 'ORBIT explains', 'Timeline', 'Headlines'].map((t) =>
      screen.getByText(t),
    )
    for (let i = 1; i < eyebrows.length; i++) {
      expect(
        eyebrows[i - 1].compareDocumentPosition(eyebrows[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
  })

  it('shows an error state for an unknown country', async () => {
    renderWithProviders(<AppRoutes />, { route: '/country/XXX' })
    expect(await screen.findByText('Could not load country')).toBeInTheDocument()
    expect(screen.queryByText('Events')).not.toBeInTheDocument()
  })
})
