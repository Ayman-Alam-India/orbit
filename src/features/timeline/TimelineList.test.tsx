import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { withTestApiServer } from '../../test/apiServer'
import { renderWithProviders } from '../../test/utils'
import { TimelineList } from './TimelineList'

withTestApiServer()

describe('timeline', () => {
  it('lists entries oldest first with dates at their precision', async () => {
    renderWithProviders(<TimelineList countryId="BRA" />)
    const list = await screen.findByRole('list')
    const dates = within(list)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('time')?.textContent)
    // day precision, then year precision
    expect(dates).toEqual(['21 Apr 1960', '1978'])
  })

  it('shows month precision without a day', async () => {
    renderWithProviders(<TimelineList countryId="IND" />)
    expect(await screen.findByText('Aug 2026')).toBeInTheDocument()
  })

  it('links entries tied to an event and highlights them', async () => {
    renderWithProviders(<TimelineList countryId="IND" />)
    const link = await screen.findByRole('link', { name: /Mock: Late monsoon begins/ })
    expect(link).toHaveAttribute('href', '/country/IND/event/hs_ind_dengue_surge')
    expect(link.closest('li')).toHaveAttribute('data-linked', 'true')
    expect(screen.getByText('Independence').closest('li')).toHaveAttribute('data-linked', 'false')
  })
})
