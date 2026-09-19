import { afterAll, beforeAll, vi } from 'vitest'
import { startTestServer } from '../../server/testServer'

/**
 * Runs the real API server (seed data, mock AI) for the tests in this file, and routes the
 * frontend's relative `/api/...` fetches to it. Call once at the top level of a test file.
 */
export function withTestApiServer() {
  let server: Awaited<ReturnType<typeof startTestServer>>
  const realFetch = globalThis.fetch

  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    server = await startTestServer()
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      realFetch(
        typeof input === 'string' && input.startsWith('/') ? server.baseUrl + input : input,
        init,
      ),
    )
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await server.close()
  })
}
