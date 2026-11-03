import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GlobeNav } from '../../globe/GlobeNav'
import { useUiStore } from '../../state/uiStore'
import { withTestApiServer } from '../../test/apiServer'
import { renderWithProviders } from '../../test/utils'
import { RippleLegend } from './RippleLegend'

withTestApiServer()
afterEach(() => useUiStore.setState({ rippleChannel: undefined, globeNav: undefined }))

describe('ripple legend', () => {
  it('lists every arc colour with how many arcs the globe draws', async () => {
    renderWithProviders(<RippleLegend />)
    // Fixtures: one US tariff → India trade ripple has a place on the map (Brent has none).
    const trade = await screen.findByRole('button', { name: /Trade & supply/ })
    expect(await within(trade).findByText('1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Energy/ })).toBeDisabled()
  })

  it('clicking a colour shows only those ripples, each opening its cause', async () => {
    renderWithProviders(<RippleLegend />)
    const trade = await screen.findByRole('button', { name: /Trade & supply/ })
    await within(trade).findByText('1')
    fireEvent.click(trade)
    expect(useUiStore.getState().rippleChannel).toBe('trade')
    expect(trade).toHaveAttribute('aria-pressed', 'true')
    const list = screen.getByRole('list', { name: 'Ripples in this channel' })
    expect(within(list).getAllByRole('link')[0]).toHaveAttribute(
      'href',
      '/country/USA/event/evt_usa_tariff_review',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show all ripples' }))
    expect(useUiStore.getState().rippleChannel).toBeUndefined()
  })
})

describe('globe buttons', () => {
  it('ask the globe to turn left, right or recentre', () => {
    renderWithProviders(<GlobeNav />)
    for (const [name, action] of [
      ['Turn globe left', 'left'],
      ['Recentre globe', 'recentre'],
      ['Turn globe right', 'right'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name }))
      expect(useUiStore.getState().globeNav?.action).toBe(action)
    }
  })
})
