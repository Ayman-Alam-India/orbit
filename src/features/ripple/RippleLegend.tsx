import type { CountryId, ImpactChannel } from '@shared'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { rippleArcs } from '../../globe/rippleArcs'
import { paths } from '../../routes'
import { useUiStore } from '../../state/uiStore'
import { useCountries } from '../country/useCountry'
import { useAutoEvents, useEvents } from '../event/useEvents'
import { useMarkets } from '../markets/useMarkets'
import styles from './RippleLegend.module.css'
import { useImpacts } from './useImpacts'

/** The arc colours on the globe, in the order they are listed. */
const CHANNELS: { id: ImpactChannel; label: string }[] = [
  { id: 'energy', label: 'Energy · oil & gas' },
  { id: 'shipping', label: 'Shipping lanes' },
  { id: 'trade', label: 'Trade & supply' },
  { id: 'finance', label: 'Finance & markets' },
  { id: 'health', label: 'Health · outbreaks' },
  { id: 'security', label: 'Security' },
]

const MAX_LISTED = 8

/**
 * Legend for the ripple arcs (left of the globe). Each colour shows how many arcs it has; clicking
 * one shows only those arcs on the globe and lists them, each opening the event that causes it.
 */
export function RippleLegend() {
  const impacts = useImpacts()
  const events = useEvents()
  const autoEvents = useAutoEvents()
  const countries = useCountries()
  const markets = useMarkets()
  const { rippleChannel, setRippleChannel } = useUiStore()

  const allEvents = useMemo(
    () => [...(events.data ?? []), ...(autoEvents.data ?? [])],
    [events.data, autoEvents.data],
  )
  // Exactly the arcs the globe draws, so the counts match what you see.
  const arcs = useMemo(
    () => rippleArcs(impacts.data ?? [], allEvents, countries.data ?? [], markets.data ?? []),
    [impacts.data, allEvents, countries.data, markets.data],
  )
  const causeOf = (arcId: string) => {
    const link = impacts.data?.find((l) => l.id === arcId)
    return allEvents.find((e) => e.id === link?.eventId)
  }
  const selected = arcs.filter((a) => a.channel === rippleChannel)

  return (
    <section className={styles.legend} aria-label="Ripple effects legend">
      <p className={styles.heading}>Ripple effects</p>
      <ul className={styles.channels}>
        {CHANNELS.map(({ id, label }) => {
          const count = arcs.filter((a) => a.channel === id).length
          const active = rippleChannel === id
          return (
            <li key={id}>
              <button
                type="button"
                className={styles.channel}
                data-channel={id}
                data-active={active}
                aria-pressed={active}
                disabled={!count}
                onClick={() => setRippleChannel(active ? undefined : id)}
                title={active ? 'Show all ripples' : `Show only ${label.toLowerCase()} ripples`}
              >
                <span className={styles.swatch} aria-hidden />
                <span className={styles.label}>{label}</span>
                <span className={styles.count}>{count}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {rippleChannel && (
        <ul className={styles.list} aria-label="Ripples in this channel">
          {selected.slice(0, MAX_LISTED).map((arc) => {
            const cause = causeOf(arc.id)
            return (
              <li key={arc.id}>
                {cause ? (
                  <Link to={paths.event(cause.countryIds[0] as CountryId, cause.id)}>
                    <span className={styles.target}>{arc.label}</span>
                    <span className={styles.cause}>from {cause.title}</span>
                  </Link>
                ) : (
                  <span className={styles.target}>{arc.label}</span>
                )}
              </li>
            )
          })}
          {selected.length > MAX_LISTED && (
            <li className={styles.more}>+{selected.length - MAX_LISTED} more on the globe</li>
          )}
          <li>
            <button type="button" className={styles.clear} onClick={() => setRippleChannel()}>
              Show all ripples
            </button>
          </li>
        </ul>
      )}
    </section>
  )
}
