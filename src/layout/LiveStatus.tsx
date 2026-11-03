import { API_ROUTES, type PipelineStatus } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../api/client'
import { updatedAgo, useNow } from '../features/news/updatedAgo'
import styles from './LiveStatus.module.css'

const useStatus = () =>
  useQuery({
    queryKey: ['layout', 'status'],
    queryFn: () => apiGet<PipelineStatus>(API_ROUTES.status),
    refetchInterval: 60_000,
  })

/**
 * A small light in the top bar: green "Live" when the pipeline ran in the last 20 minutes and its
 * sources answered, amber when something is stale or failing, grey in offline (mock) mode.
 * The tooltip lists every source, the AI checkers and the trust counts.
 */
export function LiveStatus() {
  const { data } = useStatus()
  const now = useNow()
  if (!data) return null
  const age = data.lastRunAt ? now - Date.parse(data.lastRunAt) : Infinity
  const healthy = data.dataMode === 'live' && age < 20 * 60_000 && data.sources.every((s) => s.ok)
  const state = data.dataMode === 'mock' ? 'offline' : healthy ? 'live' : 'degraded'
  const label =
    state === 'offline'
      ? 'Offline data'
      : data.lastRunAt
        ? `Live · ${updatedAgo(data.lastRunAt, now)}`
        : 'Live · starting'
  const details = [
    data.dataMode === 'mock'
      ? 'Mock mode: curated data only, nothing leaves the laptop.'
      : `Last update: ${data.lastRunAt ? updatedAgo(data.lastRunAt, now) : 'not yet'}`,
    ...data.sources.map((s) => `${s.ok ? '✓' : '✗'} ${s.name}: ${s.detail}`),
    `AI checkers: ${data.aiCheckers.length ? data.aiCheckers.join(', ') : 'off (no keys)'}`,
    `Trust: ${data.trust.verified} verified, ${data.trust.corroborated} corroborated, ${data.trust.unverified} unverified`,
  ].join('\n')
  return (
    <span className={styles.status} data-state={state} title={details} aria-label={details}>
      <span className={styles.light} aria-hidden />
      {label}
    </span>
  )
}
