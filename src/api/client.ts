import { ApiErrorBodySchema, type ApiErrorCode } from '@shared'

/** Thrown for every failed API call. `code` is one of the shared ApiErrorCode values (or NETWORK). */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode | 'NETWORK'
  readonly status: number

  constructor(code: ApiErrorCode | 'NETWORK', status: number, message: string) {
    super(message)
    this.code = code
    this.status = status
  }
}

/**
 * The ONLY place in the frontend that calls fetch. Pass a path from API_ROUTES.
 * Unwraps `{ data }` on success and throws ApiClientError on `{ error }` or network failure.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiClientError(
      'NETWORK',
      0,
      'Cannot reach the ORBIT server. Is `npm run dev` running?',
    )
  }
  const body: unknown = await res.json().catch(() => undefined)
  if (!res.ok) {
    const parsed = ApiErrorBodySchema.safeParse(body)
    if (parsed.success) {
      throw new ApiClientError(parsed.data.error.code, res.status, parsed.data.error.message)
    }
    throw new ApiClientError('INTERNAL', res.status, `Request failed with status ${res.status}`)
  }
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new ApiClientError('INTERNAL', res.status, 'Response is missing "data"')
  }
  return body.data as T
}

export const apiGet = <T>(path: string) => request<T>(path)

export const apiPost = <T>(path: string, payload: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

/** Static files from /public (e.g. /data/countries.geojson). Not part of the API envelope. */
export async function getStaticJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new ApiClientError('NOT_FOUND', res.status, `Static file ${path} not found`)
  return (await res.json()) as T
}
