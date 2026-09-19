import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ErrorState } from './ErrorState'
import { Loader } from './Loader'

type QueryStateProps<T> = {
  query: UseQueryResult<T>
  /** Used in the loading/error text, e.g. "country". */
  label: string
  children: (data: T) => ReactNode
}

/** Renders the standard loading and error states for a query, then `children(data)` on success. */
export function QueryState<T>({ query, label, children }: QueryStateProps<T>) {
  if (query.isPending) return <Loader label={`Loading ${label}`} />
  if (query.isError)
    return (
      <ErrorState
        title={`Could not load ${label}`}
        error={query.error}
        onRetry={() => query.refetch()}
      />
    )
  return <>{children(query.data)}</>
}
