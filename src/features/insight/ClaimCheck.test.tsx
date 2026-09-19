import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { withTestApiServer } from '../../test/apiServer'
import { renderWithProviders } from '../../test/utils'
import { InsightCard } from './InsightCard'

// The test server has no API keys, so only the rule-based checker answers (the offline demo case).
withTestApiServer()

describe('claim verification panel', () => {
  it('opens from the insight and shows each claim with its verdicts', async () => {
    renderWithProviders(<InsightCard subjectType="event" subjectId="hs_ind_dengue_surge" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Verify claims' }))

    expect(await screen.findByText('Model agreement')).toBeInTheDocument()
    expect(screen.getByText('Only one verifier ran')).toBeInTheDocument()

    // Unconfigured models are shown honestly, not hidden.
    expect(screen.getByText('Gemini · no key')).toBeInTheDocument()
    expect(screen.getByText('Groq · Llama · no key')).toBeInTheDocument()

    const claims = screen.getAllByRole('listitem').filter((li) => li.dataset.agreement)
    expect(claims.length).toBeGreaterThan(0)
    expect(within(claims[0]).getByText(/Rule check: Supported/)).toBeInTheDocument()
    expect(within(claims[0]).getByText('Single check')).toBeInTheDocument()
  })

  it('can be hidden again', async () => {
    renderWithProviders(<InsightCard subjectType="country" subjectId="IND" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Verify claims' }))
    await screen.findByText('Model agreement')
    await userEvent.click(screen.getByRole('button', { name: 'Hide check' }))
    expect(screen.queryByText('Model agreement')).not.toBeInTheDocument()
  })
})
