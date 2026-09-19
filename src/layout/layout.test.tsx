import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { startTestServer } from '../../server/testServer'
import { AppRoutes } from '../App'
import { useUiStore } from '../state/uiStore'
import { renderWithProviders } from '../test/utils'

vi.mock('../globe/OrbitGlobe', () => ({ default: () => <div data-testid="globe" /> }))

let server: Awaited<ReturnType<typeof startTestServer>>
const realFetch = globalThis.fetch

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  server = await startTestServer()
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(
      typeof input === 'string' && input.startsWith('/') ? server.baseUrl + input : input,
      init,
    ),
  )
})
afterEach(() => useUiStore.setState({ askOpen: false }))
afterAll(async () => {
  vi.unstubAllGlobals()
  await server.close()
})

const shell = () => screen.getByTestId('globe-stage').parentElement!

describe('app shell', () => {
  it('uses the global layout on "/" and the detail layout on a country', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' })
    expect(shell()).toHaveAttribute('data-mode', 'global')
    expect(screen.queryByRole('button', { name: 'Back to global view' })).not.toBeInTheDocument()
  })

  it('mini globe button returns to the global view', async () => {
    renderWithProviders(<AppRoutes />, { route: '/country/IND' })
    expect(shell()).toHaveAttribute('data-mode', 'detail')
    await userEvent.click(screen.getByRole('button', { name: 'Back to global view' }))
    expect(shell()).toHaveAttribute('data-mode', 'global')
  })

  it('search finds a country and navigates to it', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' })
    const input = screen.getByRole('combobox', { name: 'Search countries and events' })
    await userEvent.type(input, 'ind')
    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByText('India')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(shell()).toHaveAttribute('data-mode', 'detail')
    expect(await screen.findByRole('heading', { name: 'India' })).toBeInTheDocument()
  })

  it('ticker shows seed headlines; an event headline links to its event', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' })
    const ticker = await screen.findByRole('navigation', { name: 'Latest headlines' })
    const link = within(ticker).getAllByText('Mock: Hospitals in Mumbai add dengue wards')[0]
    expect(link.closest('a')).toHaveAttribute('href', '/country/IND/event/hs_ind_dengue_surge')
  })

  it('Ask ORBIT button opens and Escape closes the drawer', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' })
    const drawer = document.querySelector('aside[aria-label="Ask ORBIT"]')!
    expect(drawer).toHaveAttribute('data-open', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Ask ORBIT' }))
    expect(drawer).toHaveAttribute('data-open', 'true')
    await userEvent.keyboard('{Escape}')
    expect(drawer).toHaveAttribute('data-open', 'false')
  })

  it('global view shows the world status strip', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' })
    expect(await screen.findByRole('heading', { name: 'World overview' })).toBeInTheDocument()
    const tile = (label: string) => screen.getByText(label).parentElement!
    await within(tile('Countries')).findByText('3')
    await within(tile('Events')).findByText('6')
    expect(within(tile('Severe')).getByText('1')).toBeInTheDocument()
  })
})
