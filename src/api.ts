import { incidents as seedIncidents, services } from './data'
import type { Incident, IncidentPage } from './types'
let incidents = structuredClone(seedIncidents)
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
export async function getIncidents(page = 1, query = ''): Promise<IncidentPage> { await wait(80); const filtered = incidents.filter((incident) => incident.title.includes(query) || incident.service.includes(query)); const pageSize = 4; const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)); return { incidents: filtered.slice((page - 1) * pageSize, page * pageSize), page, totalPages } }
export async function getIncident(id: string): Promise<Incident> { await wait(id === '1' ? 220 : 60); const incident = incidents.find((item) => item.id === id); if (!incident) throw new Error('Incident not found'); return { ...incident } }
export async function acknowledgeIncident(id: string): Promise<Incident> { await wait(250); if (id === '2') throw new Error('Acknowledgement service unavailable'); const incident = incidents.find((item) => item.id === id); if (!incident || incident.status === 'closed') throw new Error('Only active incidents can be acknowledged'); incident.status = 'acknowledged'; incident.updatedAt = new Date().toISOString(); return { ...incident } }
export async function getServices() { await wait(60); return services }
export function resetApi() { incidents = structuredClone(seedIncidents) }