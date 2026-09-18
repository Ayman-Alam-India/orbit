import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { IncidentList } from './IncidentList'
import { incidents } from '../data'

describe('IncidentList', () => {
  it('renders incidents', () => {
    render(<MemoryRouter><IncidentList incidents={[incidents[0]]} /></MemoryRouter>)
    expect(screen.getByText('Payment API latency')).toBeTruthy()
  })
})
