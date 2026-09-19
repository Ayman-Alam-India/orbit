import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HealthSignalList } from '../health/HealthSignalList'
import { withTestApiServer } from '../../test/apiServer'
import { renderWithProviders } from '../../test/utils'
import { NewsList } from './NewsList'

withTestApiServer()

describe('news panel', () => {
  it('shows headlines newest first with source name and date', async () => {
    renderWithProviders(<NewsList countryId="IND" />)
    const items = await screen.findAllByRole('listitem')
    expect(
      within(items[0]).getByText('Mock: Hospitals in Mumbai add dengue wards'),
    ).toBeInTheDocument()
    expect(await within(items[0]).findByText('ORBIT Mock Wire')).toBeInTheDocument()
    expect(within(items[0]).getByText('18 Sep 2026')).toBeInTheDocument()
  })

  it('links event headlines to the event view', async () => {
    renderWithProviders(<NewsList countryId="IND" />)
    const links = await screen.findAllByRole('link', { name: 'View event →' })
    expect(links[0]).toHaveAttribute('href', '/country/IND/event/hs_ind_dengue_surge')
  })

  it('respects the limit', async () => {
    renderWithProviders(<NewsList limit={2} />)
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
  })
})

describe('health panel', () => {
  it('shows signals most severe first with their metric', async () => {
    renderWithProviders(<HealthSignalList />)
    const cards = await screen.findAllByRole('link')
    expect(cards[0]).toHaveTextContent('Dengue cases rise after late monsoon')
    expect(cards[0]).toHaveTextContent('18,400 cases this month')
    expect(cards[0]).toHaveAttribute('href', '/country/IND/event/hs_ind_dengue_surge')
  })
})
