import { API_ROUTES, type NewsHeadline, type NewsRefreshResult } from '@shared'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/utils'
import { NewsList } from './NewsList'
import { updatedAgo } from './updatedAgo'

// Live mode needs GDELT, so these tests stub the API client instead of using the test server.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../../api/client', () => ({ apiGet: api.get, apiPost: api.post }))

const headline = (id: string, title: string): NewsHeadline => ({
  id,
  title,
  url: `https://example.net/${id}`,
  sourceId: 'src_gdelt',
  publishedAt: '2026-11-03T09:00:00Z',
  countryIds: ['IND'],
  publisher: 'example.net',
})

beforeEach(() => {
  api.get.mockReset()
  api.post.mockReset()
  api.get.mockImplementation(async (path: string) => {
    if (path === API_ROUTES.health) return { status: 'ok', dataMode: 'live', aiProvider: 'mock' }
    if (path === API_ROUTES.news('IND')) return [headline('news_old', 'Old headline')]
    return []
  })
})

describe('headlines refresh button', () => {
  it('keeps the old headlines while waiting, then swaps in the fresh ones', async () => {
    let answer!: (result: NewsRefreshResult) => void
    api.post.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    renderWithProviders(<NewsList countryId="IND" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Refresh headlines' }))
    expect(await screen.findByText('Refreshing…')).toBeInTheDocument()
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(API_ROUTES.newsRefresh, { countryId: 'IND' }),
    )
    expect(screen.getByText('Old headline')).toBeInTheDocument()

    answer({
      headlines: [headline('news_new', 'Fresh headline')],
      fetchedAt: new Date().toISOString(),
      refreshed: true,
    })
    expect(await screen.findByText('Fresh headline')).toBeInTheDocument()
    expect(screen.queryByText('Old headline')).not.toBeInTheDocument()
    expect(screen.getByText('Updated just now')).toBeInTheDocument()
  })

  it('says so when GDELT failed and keeps the saved headlines', async () => {
    api.post.mockResolvedValue({
      headlines: [headline('news_old', 'Old headline')],
      refreshed: false,
    })
    renderWithProviders(<NewsList countryId="IND" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh headlines' }))
    expect(await screen.findByText("Couldn't refresh, showing saved headlines")).toBeInTheDocument()
    expect(screen.getByText('Old headline')).toBeInTheDocument()
  })
})

describe('updatedAgo', () => {
  it('reads like a person would say it', () => {
    const now = Date.parse('2026-11-03T12:00:00Z')
    expect(updatedAgo('2026-11-03T11:59:30Z', now)).toBe('just now')
    expect(updatedAgo('2026-11-03T11:55:00Z', now)).toBe('5 min ago')
    expect(updatedAgo('2026-11-03T09:30:00Z', now)).toBe('2 h ago')
  })
})
