import { API_ROUTES, type Source } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'

export const sourceKeys = { all: ['source'] as const }

/** All sources, for turning `sourceIds` into names and links. */
export const useSources = () =>
  useQuery({
    queryKey: sourceKeys.all,
    queryFn: () => apiGet<Source[]>(API_ROUTES.sources),
    staleTime: 10 * 60_000,
  })
