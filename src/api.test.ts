import { afterEach, describe, expect, it } from 'vitest'
import { acknowledgeIncident, getIncidents, resetApi } from './api'

afterEach(resetApi)

describe('incident API contract', () => {
  it('returns a paginated incident response', async () => {
    const response = await getIncidents(1)
    expect(response.page).toBe(1)
    expect(response.incidents).toHaveLength(4)
    expect(response.totalPages).toBe(2)
  })

  it('rejects acknowledgement for a closed incident', async () => {
    await expect(acknowledgeIncident('3')).rejects.toThrow('Only active incidents')
  })
})
