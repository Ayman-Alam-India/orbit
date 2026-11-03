import { API_ROUTES, type Trust } from '@shared'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/utils'
import { TrustWithVerify } from './VerifyNow'

const api = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../../api/client', () => ({ apiPost: api.post, apiGet: vi.fn() }))

const trust = (status: Trust['status'], reason: string): Trust => ({
  status,
  outlets: [],
  aiCheck: 'unavailable',
  reason,
  checkedAt: '2026-11-03T12:00:00Z',
})

beforeEach(() => api.post.mockReset())

describe('Verify now', () => {
  it('re-checks an unverified item and shows the new rating', async () => {
    api.post.mockResolvedValue(
      trust('corroborated', 'Reported by 4 outlets; the AI checkers agree.'),
    )
    renderWithProviders(
      <TrustWithVerify
        trust={trust('unverified', 'Reported by 1 outlet (needs 3).')}
        request={{ kind: 'headline', id: 'news_gnews_1' }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Verify now' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(API_ROUTES.trustCheck, {
        kind: 'headline',
        id: 'news_gnews_1',
      }),
    )
    expect(
      await screen.findByText('Reported by 4 outlets; the AI checkers agree.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Corroborated:/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify now' })).not.toBeInTheDocument()
  })

  it('has no button for verified items', () => {
    renderWithProviders(
      <TrustWithVerify
        trust={trust('verified', 'Curated.')}
        request={{ kind: 'event', id: 'evt_x' }}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Verify now' })).not.toBeInTheDocument()
  })
})
