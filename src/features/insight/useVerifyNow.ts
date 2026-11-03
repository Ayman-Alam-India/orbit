import { API_ROUTES, type Trust, type TrustCheckRequest } from '@shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '../../api/client'

/**
 * "Verify now" next to an unverified item: the server searches for more outlets reporting the
 * story and asks Gemini and Groq to check it, then the badge shows the new rating everywhere.
 */
export function useVerifyNow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: TrustCheckRequest) => apiPost<Trust>(API_ROUTES.trustCheck, request),
    // The new rating is saved on the server: refresh every list that shows trust badges.
    onSuccess: () =>
      Promise.all(
        ['news', 'event', 'impact', 'country'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  })
}
