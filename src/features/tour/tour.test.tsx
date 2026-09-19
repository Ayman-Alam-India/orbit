import type { Country, ImpactLink, MarketQuote, OrbitEvent } from '@shared'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import countries from '../../../server/data/fixtures/countries.json'
import events from '../../../server/data/fixtures/events.json'
import impacts from '../../../server/data/fixtures/impacts.json'
import markets from '../../../server/data/fixtures/markets.json'
import { AppRoutes } from '../../App'
import { useUiStore } from '../../state/uiStore'
import { withTestApiServer } from '../../test/apiServer'
import { renderWithProviders } from '../../test/utils'
import { buildTourStops } from './buildTourStops'

vi.mock('../../globe/OrbitGlobe', () => ({ default: () => <div data-testid="globe" /> }))
withTestApiServer()

const stops = () =>
  buildTourStops(
    events as OrbitEvent[],
    impacts as ImpactLink[],
    countries as Country[],
    markets as MarketQuote[],
  )

describe('buildTourStops', () => {
  it('goes intro → most severe events → ripple chain → outro', () => {
    const tour = stops()
    expect(tour.map((s) => s.kind)).toEqual([
      'intro',
      'event',
      'event',
      'event',
      'event',
      'event',
      'ripple',
      'outro',
    ])
    // Severity 4 first, then the 3s (newest first).
    expect(tour[1].title).toBe('Dengue cases rise after late monsoon')
    expect(tour[1].camera.altitude).toBeLessThan(tour[0].camera.altitude)
  })

  it('narrates only sourced data: event summaries and ripple links', () => {
    const tour = stops()
    const tariff = tour.find((s) => s.eventId === 'evt_usa_tariff_review' && s.kind === 'event')!
    expect(tariff.narration).toContain('Ripple effect: mock: exporters exposed for India.')
    const ripple = tour.find((s) => s.kind === 'ripple')!
    expect(ripple.caption).toBe('mock: trade uncertainty (Brent crude) → mock: exporters exposed (India)')
    expect(ripple.countryId).toBe('USA')
  })
})

describe('TourOverlay', () => {
  afterEach(() => useUiStore.getState().setTourActive(false))

  it('opens from the toolbar, steps through stops and exits', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' })
    await userEvent.click(screen.getByRole('button', { name: '▶ Tour' }))
    expect(await screen.findByRole('heading', { name: 'The world right now' })).toBeInTheDocument()
    expect(useUiStore.getState().tourFocus).toMatchObject({ altitude: 2.6 })

    await userEvent.click(screen.getByRole('button', { name: 'Next stop' }))
    expect(screen.getByRole('heading', { name: 'Dengue cases rise after late monsoon' })).toBeInTheDocument()
    expect(useUiStore.getState().tourFocus).toMatchObject({ countryId: 'IND' })

    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('heading', { name: 'The world right now' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Guided tour' })).not.toBeInTheDocument()
    expect(useUiStore.getState().tourFocus).toBeUndefined()
  })

  it('advances on its own when playing without voice, and pauses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderWithProviders(<AppRoutes />, { route: '/?tour=1' })
      expect(await screen.findByRole('heading', { name: 'The world right now' })).toBeInTheDocument()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      // No speech in jsdom, so each stop holds for 9 s.
      if (screen.queryByRole('button', { name: 'Play tour' })) {
        await user.click(screen.getByRole('button', { name: 'Play tour' }))
      }
      await act(() => vi.advanceTimersByTimeAsync(9000))
      expect(screen.getByRole('heading', { name: 'Dengue cases rise after late monsoon' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Pause tour' }))
      await act(() => vi.advanceTimersByTimeAsync(20000))
      expect(screen.getByRole('heading', { name: 'Dengue cases rise after late monsoon' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
