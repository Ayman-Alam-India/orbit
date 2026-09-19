import { http, HttpResponse } from 'msw'
import { incidents, services } from '../data'
import type { IncidentStatus } from '../types'

export const handlers = [
  http.get('/api/incidents', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const query = (url.searchParams.get('query') ?? '').trim().toLowerCase()
    const status = (url.searchParams.get('status') ?? '') as IncidentStatus | ''
    const filtered = incidents.filter((incident) => {
      const matchesQuery = `${incident.title} ${incident.service}`.toLowerCase().includes(query)
      const matchesStatus = !status || incident.status === status
      return matchesQuery && matchesStatus
    })
    const pageSize = 4
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const safePage = Math.min(Math.max(1, page), totalPages)
    return HttpResponse.json({
      incidents: filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
      page: safePage,
      totalPages,
    })
  }),
  http.get('/api/services', () => HttpResponse.json(services)),
]
