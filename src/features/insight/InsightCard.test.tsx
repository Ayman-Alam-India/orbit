import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { withTestApiServer } from '../../test/apiServer'
import { renderWithProviders } from '../../test/utils'
import { InsightCard } from './InsightCard'

withTestApiServer()

describe('insight panel', () => {
  it('shows summary, key points, named sources, confidence and provider', async () => {
    renderWithProviders(<InsightCard subjectType="event" subjectId="hs_ind_dengue_surge" />)
    expect(await screen.findByText(/Mock insight for Dengue cases/)).toBeInTheDocument()
    expect(
      screen.getByText('Dengue cases rise after late monsoon (severity 4)'),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('link', { name: 'Mock Global Health Agency' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Confidence medium' })).toBeInTheDocument()
    expect(screen.getByText('Offline analysis')).toBeInTheDocument()
  })

  it('works for the global subject', async () => {
    renderWithProviders(<InsightCard subjectType="global" subjectId="world" />)
    expect(await screen.findByText(/Mock insight for the world/)).toBeInTheDocument()
  })

  it('shows an error state for an unknown subject', async () => {
    renderWithProviders(<InsightCard subjectType="country" subjectId="XXX" />)
    expect(await screen.findByText('Could not load insight')).toBeInTheDocument()
  })
})
