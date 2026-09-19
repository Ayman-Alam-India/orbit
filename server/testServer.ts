import type { AddressInfo } from 'node:net'
import { createApp } from './app'

/** Starts the real API on a random free port for tests. Call `close()` when done. */
export async function startTestServer() {
  const server = createApp().listen(0)
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
