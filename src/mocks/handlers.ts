import { http, HttpResponse } from 'msw'
import { incidents, services } from '../data'

export const handlers = [
  http.get('/api/incidents', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const query = url.searchParams.get('query') ?? ''
    const filtered = incidents.filter((incident) => incident.title.includes(query))
    return HttpResponse.json({ incidents: filtered.slice((page - 1) * 4, page * 4), page, totalPages: Math.max(1, Math.ceil(filtered.length / 4)) })
  }),
  http.get('/api/services', () => HttpResponse.json(services)),
]
