import { API_ROUTES, type AskAnswer, type AskRequest } from '@shared'
import { useMutation } from '@tanstack/react-query'
import { apiPost } from '../../api/client'

/** Sends a question to POST /api/ask. */
export const useAsk = () =>
  useMutation({ mutationFn: (request: AskRequest) => apiPost<AskAnswer>(API_ROUTES.ask, request) })
