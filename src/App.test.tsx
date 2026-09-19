import { screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { startTestServer } from '../server/testServer'
import { AppRoutes } from './App'
import { renderWithProviders } from './test/utils'

// WebGL does not exist in jsdom, so the globe is replaced with a stub in tests.
vi.mock('./globe/OrbitGlobe', () => ({ default: () => <div data-testid="globe" /> }))

// Integration: the real frontend talks to the real API server (seed data, mock AI).
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
afterAll(async () => {
  vi.unstubAllGlobals()
  await server.close()
})

describe('ORBIT app', () => {
  it('renders the global view with the globe and a global insight', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' })
    expect(await screen.findByTestId('globe')).toBeInTheDocument()
    expect(await screen.findByText(/Mock insight for the world/)).toBeInTheDocument()
  })

  it('renders a country page from real API data', async () => {
    renderWithProviders(<AppRoutes />, { route: '/country/IND' })
    expect(await screen.findByRole('heading', { name: 'India' })).toBeInTheDocument()
    expect(await screen.findByText('Dengue cases rise after late monsoon')).toBeInTheDocument()
    expect(await screen.findByText(/Independence/)).toBeInTheDocument()
  })

  it('shows an error state for an unknown country instead of crashing', async () => {
    renderWithProviders(<AppRoutes />, { route: '/country/XXX' })
    expect(await screen.findByText('Could not load country')).toBeInTheDocument()
  })
})
