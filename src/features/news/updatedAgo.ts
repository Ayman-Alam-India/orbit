import { useEffect, useState } from 'react'

/** "just now", "5 min ago", "2 h ago" */
export function updatedAgo(iso: string, now: number) {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ago`
}

/** Like a news site: "12 min ago" for the last 24 hours, undefined (show the date) after that. */
export function recentAgo(iso: string, now: number) {
  return now - Date.parse(iso) < 24 * 60 * 60_000 ? updatedAgo(iso, now) : undefined
}

/** The current time, updated every minute, so "x min ago" labels stay right while on screen. */
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}
