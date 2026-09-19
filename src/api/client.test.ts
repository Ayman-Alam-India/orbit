import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiGet, ApiClientError } from './client'

const respond = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))

afterEach(() => vi.unstubAllGlobals())

describe('api client', () => {
  it('unwraps { data }', async () => {
    respond(200, { data: [{ id: 'IND' }] })
    await expect(apiGet('/api/countries')).resolves.toEqual([{ id: 'IND' }])
  })

  it('throws ApiClientError with the server error code', async () => {
    respond(404, { error: { code: 'NOT_FOUND', message: 'Country "XXX" not found' } })
    const error = await apiGet('/api/countries/XXX').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiClientError)
    expect(error).toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      message: 'Country "XXX" not found',
    })
  })

  it('reports a NETWORK error when the server is not running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(apiGet('/api/health')).rejects.toMatchObject({ code: 'NETWORK' })
  })
})
