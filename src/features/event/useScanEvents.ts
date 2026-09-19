import { API_ROUTES, type OrbitEvent } from '@shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '../../api/client'

/** Runs a detection scan now ("Scan now"), then refreshes the detected list. */
export function useScanEvents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<OrbitEvent[]>(API_ROUTES.scanEvents, {}),
    onSuccess: (events) => queryClient.setQueryData(['event', 'auto'], events),
  })
}
