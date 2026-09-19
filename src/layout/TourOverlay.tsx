import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCountries } from '../features/country/useCountry'
import { useEvents } from '../features/event/useEvents'
import { useMarkets } from '../features/markets/useMarkets'
import { useImpacts } from '../features/ripple/useImpacts'
import { buildTourStops } from '../features/tour/buildTourStops'
import { canSpeak, speak } from '../features/tour/speech'
import { paths } from '../routes'
import { useUiStore } from '../state/uiStore'
import styles from './TourOverlay.module.css'

/** How long a stop stays up when there is no voice (muted, or no speech support). */
export const SILENT_STOP_MS = 9000
/** A short breath between the end of one stop's narration and the next flight. */
const GAP_MS = 700

/**
 * The guided tour (decision: Claude, on Ayman's instruction): the globe flies through the world's most
 * severe events and the strongest ripple chain, with a caption card and spoken narration.
 * Narration is built from sourced data only (see buildTourStops), so the tour never says anything unsourced.
 */
export function TourOverlay() {
  const { tourActive, setTourActive, setTourFocus, setAskOpen } = useUiStore()
  const navigate = useNavigate()
  const events = useEvents()
  const impacts = useImpacts()
  const countries = useCountries()
  const markets = useMarkets()
  const stops = useMemo(
    () =>
      events.data && countries.data
        ? buildTourStops(events.data, impacts.data ?? [], countries.data, markets.data ?? [])
        : [],
    [events.data, impacts.data, countries.data, markets.data],
  )
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(!canSpeak())
  const stop = stops[index]
  const last = index === stops.length - 1

  const exit = useCallback(() => {
    setTourActive(false)
    setPlaying(false)
  }, [setTourActive])

  // Each time the tour opens: start from the beginning on the big globe, with the drawer closed.
  // Browsers only allow speech after a click, so a tour opened by URL (?tour=1) waits for ▶.
  const wasActive = useRef(false)
  useEffect(() => {
    if (tourActive && !wasActive.current) {
      setIndex(0)
      setPlaying(navigator.userActivation?.hasBeenActive ?? true)
      setAskOpen(false)
      navigate(paths.global())
    }
    wasActive.current = tourActive
  }, [tourActive, navigate, setAskOpen])

  // Point the globe at the current stop.
  useEffect(() => {
    if (tourActive && stop) setTourFocus({ ...stop.camera, countryId: stop.countryId })
  }, [tourActive, stop, setTourFocus])

  // Narrate the stop, then move on (or finish the tour after the last one).
  useEffect(() => {
    if (!tourActive || !playing || !stop) return
    const next = () => (last ? exit() : setIndex((i) => i + 1))
    let timer: ReturnType<typeof setTimeout> | undefined
    if (muted) {
      timer = setTimeout(next, SILENT_STOP_MS)
      return () => clearTimeout(timer)
    }
    // Safety net: some browsers occasionally never fire "end" on long utterances.
    const words = stop.narration.split(/\s+/).length
    const fallback = setTimeout(next, Math.max(SILENT_STOP_MS, (words / 2.2) * 1000 + 4000))
    const cancel = speak(stop.narration, () => {
      clearTimeout(fallback)
      timer = setTimeout(next, GAP_MS)
    })
    return () => {
      cancel()
      clearTimeout(fallback)
      clearTimeout(timer)
    }
  }, [tourActive, playing, muted, stop, last, exit])

  // Keyboard: ← → to move, space to pause, M to mute, Esc to leave.
  useEffect(() => {
    if (!tourActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Escape') exit()
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, stops.length - 1))
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
      else if (e.key === ' ') setPlaying((p) => !p)
      else if (e.key.toLowerCase() === 'm' && canSpeak()) setMuted((m) => !m)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tourActive, stops.length, exit])

  if (!tourActive || !stop) return null

  return (
    <section className={styles.card} aria-label="Guided tour" aria-live="polite">
      <p className={styles.eyebrow}>
        <span className={styles.live} aria-hidden />
        {stop.eyebrow}
      </p>
      <h2 className={styles.title}>{stop.title}</h2>
      <p className={styles.caption}>{stop.caption}</p>

      <div className={styles.footer}>
        <div className={styles.dots} role="tablist" aria-label="Tour stops">
          {stops.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Stop ${i + 1}: ${s.title}`}
              className={styles.dot}
              data-active={i === index}
              data-done={i < index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>

        <div className={styles.controls}>
          {stop.eventId && stop.countryId && (
            <button
              type="button"
              className={styles.open}
              onClick={() => {
                exit()
                navigate(paths.event(stop.countryId!, stop.eventId!))
              }}
            >
              Open
            </button>
          )}
          <button
            type="button"
            className={styles.control}
            aria-label="Previous stop"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.play}
            aria-label={playing ? 'Pause tour' : 'Play tour'}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            className={styles.control}
            aria-label="Next stop"
            disabled={last}
            onClick={() => setIndex((i) => i + 1)}
          >
            ›
          </button>
          {canSpeak() && (
            <button
              type="button"
              className={styles.control}
              aria-label={muted ? 'Turn narration on' : 'Mute narration'}
              aria-pressed={muted}
              onClick={() => setMuted((m) => !m)}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          )}
          <button type="button" className={styles.control} aria-label="End tour" onClick={exit}>
            ✕
          </button>
        </div>
      </div>
    </section>
  )
}
