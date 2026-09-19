import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../App'
import { useUiStore } from '../../state/uiStore'
import { withTestApiServer } from '../../test/apiServer'
import { renderWithProviders } from '../../test/utils'

vi.mock('../../globe/OrbitGlobe', () => ({ default: () => <div data-testid="globe" /> }))
withTestApiServer()

describe('what-if simulator', () => {
  it('shows the scenario, the simulation badge and computed knock-on effects', async () => {
    renderWithProviders(<AppRoutes />, { route: '/simulate' })
    expect(
      await screen.findByRole('heading', { name: 'Mock chokepoint closes' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Simulation, not a forecast')).toBeInTheDocument()
    // Fixture Brent is $80 with a +20% default shock.
    expect(await screen.findByText('$80.00 → $96.00')).toBeInTheDocument()
    expect(screen.getByText('8.0 million b/d')).toBeInTheDocument()
    expect(screen.getAllByText('How this is calculated').length).toBeGreaterThan(0)
  })

  it('recomputes when the shock changes', async () => {
    renderWithProviders(<AppRoutes />, { route: '/simulate' })
    await screen.findByText('$80.00 → $96.00')
    await userEvent.click(screen.getByRole('button', { name: '+60%' }))
    expect(await screen.findByText('$80.00 → $128.00')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Oil-price shock/), { target: { value: '-10' } })
    expect(await screen.findByText('$80.00 → $72.00')).toBeInTheDocument()
  })

  it('tells the globe which chokepoint and countries to show, and clears it on leave', async () => {
    const { unmount } = renderWithProviders(<AppRoutes />, { route: '/simulate' })
    await screen.findByText('$80.00 → $96.00')
    expect(useUiStore.getState().simulation).toMatchObject({
      scenarioId: 'scn_test_closure',
      affected: [
        { countryId: 'IND', role: 'importer' },
        { countryId: 'USA', role: 'exporter' },
      ],
    })
    unmount()
    expect(useUiStore.getState().simulation).toBeUndefined()
  })
})
