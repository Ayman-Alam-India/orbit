import type { Trust } from '@shared'
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/utils'
import { HowWeKnow } from './HowWeKnow'

const trust: Trust = {
  status: 'corroborated',
  outlets: ['reuters.com', 'c.com', 'd.com'],
  established: ['reuters.com'],
  copies: 1,
  aiCheck: 'agree',
  reason:
    'Reported by 3 independent outlets, 1 established (reuters.com); 1 syndicated copy not counted; the AI checkers agree.',
  checkedAt: '2026-11-03T12:00:00Z',
  evidence: [
    {
      title: 'Quake hits Japan',
      url: 'https://reuters.com/a',
      publisher: 'reuters.com',
      publishedAt: '2026-11-03T08:00:00Z',
      established: true,
    },
    {
      title: 'Quake hits Japan',
      url: 'https://b.com/a',
      publisher: 'b.com',
      publishedAt: '2026-11-03T09:00:00Z',
      established: false,
      copyOf: 'reuters.com',
    },
  ],
  checks: [
    { model: 'gemini', verdict: 'supported', reason: 'Three outlets report the quake.' },
    { model: 'groq', verdict: 'supported', reason: 'Consistent across reports.' },
  ],
}

describe('How we know', () => {
  it('lists the reports (established and copies marked) and what each AI checker said', () => {
    renderWithProviders(<HowWeKnow trust={trust} />)
    fireEvent.click(screen.getByText('How we know'))
    const reports = within(
      screen.getByRole('list', { name: 'Reports behind this rating' }),
    ).getAllByRole('listitem')
    expect(reports[0]).toHaveTextContent('reuters.comEstablished')
    expect(reports[1]).toHaveTextContent('Copy of reuters.com, not counted')
    expect(screen.getByText(/Three outlets report the quake/)).toHaveTextContent(
      'Gemini supports it',
    )
    expect(screen.getByText(/Consistent across reports/)).toHaveTextContent('Groq supports it')
  })

  it('stays out of the way for curated (verified) items', () => {
    renderWithProviders(<HowWeKnow trust={{ ...trust, status: 'verified' }} />)
    expect(screen.queryByText('How we know')).not.toBeInTheDocument()
  })
})
