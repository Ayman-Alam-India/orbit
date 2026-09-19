import type { ApiErrorBody, ApiErrorCode, ApiSuccess } from '@shared'
import type { ErrorRequestHandler, RequestHandler, Response } from 'express'
import { z } from 'zod'

/** Throw this from any route to send a `{ error }` response with the given status. */
export class AppError extends Error {
  readonly code: ApiErrorCode
  readonly status: number

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message)
    this.code = code
    this.status = status
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', 404, `${what} not found`)

/** Send a successful `{ data }` response. */
export function ok<T>(res: Response, data: T) {
  const body: ApiSuccess<T> = { data }
  res.json(body)
}

/** Validate request input (params, query, body). Bad input becomes a 400 VALIDATION error. */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value)
  if (!result.success) throw new AppError('VALIDATION', 400, z.prettifyError(result.error))
  return result.data
}

export const requestLogger: RequestHandler = (req, res, next) => {
  const started = Date.now()
  res.on('finish', () => {
    console.log(
      `[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`,
    )
  })
  next()
}

export const notFoundHandler: RequestHandler = (req) => {
  throw new AppError('NOT_FOUND', 404, `No API route for ${req.method} ${req.path}`)
}

/** Turns every thrown error into the shared `{ error: { code, message } }` envelope. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  void _next
  let error: AppError
  if (err instanceof AppError) {
    error = err
  } else if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    error = new AppError('VALIDATION', 400, 'Request body is not valid JSON')
  } else {
    console.error('[api] unexpected error', err)
    error = new AppError('INTERNAL', 500, 'Something went wrong on the server')
  }
  const body: ApiErrorBody = { error: { code: error.code, message: error.message } }
  res.status(error.status).json(body)
}
