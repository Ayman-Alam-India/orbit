import { API_ROUTES, type EventId, type OrbitEvent, type OrbitEventKind } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'

export const eventKeys = {
  list: (kind?: OrbitEventKind) => ['event', 'list', kind ?? 'all'] as const,
  detail: (id: EventId) => ['event', id] as const,
}

/** All events (newest first), optionally only one kind. Used by the globe markers and the health panel. */
export const useEvents = (kind?: OrbitEventKind) =>
  useQuery({
    queryKey: eventKeys.list(kind),
    queryFn: () => apiGet<OrbitEvent[]>(API_ROUTES.events(kind)),
  })

export const useEvent = (id: EventId) =>
  useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: () => apiGet<OrbitEvent>(API_ROUTES.event(id)),
    // An empty id means "no event selected" (e.g. Ask ORBIT on the global view): don't fetch.
    enabled: Boolean(id),
  })

/** Events ORBIT detected by itself in today's live headlines (empty in mock mode). */
export const useAutoEvents = () =>
  useQuery({
    queryKey: ['event', 'auto'],
    queryFn: () => apiGet<OrbitEvent[]>(API_ROUTES.autoEvents),
    // A background scan may be running on the server: pick its results up without a reload.
    refetchInterval: 60_000,
  })
