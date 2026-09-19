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
  })
