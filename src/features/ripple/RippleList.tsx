import type { CountryId, ImpactDirection, ImpactLink } from '@shared'
import { Link } from 'react-router-dom'
import { paths } from '../../routes'
import { Panel, QueryState, Tag } from '../../ui'
import { useCountries } from '../country/useCountry'
import { useEvents } from '../event/useEvents'
import { SourceChips } from '../insight/SourceChips'
import { changePct, formatChange, formatMarketValue } from '../markets/format'
import { useMarkets } from '../markets/useMarkets'
import styles from './Ripple.module.css'
import { useImpacts } from './useImpacts'

const DIRECTION: Record<ImpactDirection, { icon: string; label: string }> = {
  up: { icon: '↑', label: 'Pushes up' },
  down: { icon: '↓', label: 'Pushes down' },
  risk: { icon: '!', label: 'Raises risk' },
}

/** Orders links as chains: each link is followed by the links that follow from it (depth for indenting). */
function asChains(links: ImpactLink[]) {
  const ordered: { link: ImpactLink; depth: number }[] = []
  const ids = new Set(links.map((l) => l.id))
  const visit = (link: ImpactLink, depth: number) => {
    ordered.push({ link, depth })
    links.filter((l) => l.followsImpactId === link.id).forEach((child) => visit(child, depth + 1))
  }
  links
    .filter((l) => !l.followsImpactId || !ids.has(l.followsImpactId))
    .sort((a, b) => b.strength - a.strength)
    .forEach((root) => visit(root, 0))
  return ordered
}

function RippleItem({
  link,
  depth,
  showCause,
}: {
  link: ImpactLink
  depth: number
  showCause: boolean
}) {
  const countries = useCountries()
  const markets = useMarkets()
  const events = useEvents()
  const cause = events.data?.find((e) => e.id === link.eventId)
  const targetName =
    link.target.kind === 'country'
      ? (countries.data?.find((c) => c.id === link.target.id)?.name ?? link.target.id)
      : (markets.data?.find((m) => m.id === link.target.id)?.name ?? link.target.id)
  const market = link.marketId ? markets.data?.find((m) => m.id === link.marketId) : undefined
  const pct = market ? changePct(market) : undefined

  return (
    <li
      className={styles.item}
      style={{ marginLeft: `calc(${depth} * var(--space-5))` }}
      data-depth={depth}
    >
      <div className={styles.head}>
        <span
          className={styles.direction}
          data-direction={link.direction}
          title={DIRECTION[link.direction].label}
        >
          {DIRECTION[link.direction].icon}
        </span>
        <div className={styles.titles}>
          <span className={styles.target}>
            {link.target.kind === 'country' ? (
              <Link to={paths.country(link.target.id as CountryId)}>{targetName}</Link>
            ) : (
              targetName
            )}
          </span>
          <span className={styles.effect}>{link.effect}</span>
        </div>
        {market && (
          <span className={styles.market}>
            <strong>{formatMarketValue(market)}</strong>
            {pct !== undefined && (
              <span data-direction={pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'}>
                {formatChange(pct)}
              </span>
            )}
          </span>
        )}
      </div>
      <p className={styles.mechanism}>{link.mechanism}</p>
      <div className={styles.foot}>
        <Tag>{link.channel}</Tag>
        <span className={styles.basis} data-basis={link.basis}>
          {link.basis === 'sourced' ? 'Sourced' : 'ORBIT analysis'}
        </span>
        <span className={styles.strength} aria-label={`Strength ${link.strength} of 3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} data-on={n <= link.strength} />
          ))}
        </span>
        {showCause && cause && (
          <Link to={paths.event(cause.countryIds[0], cause.id)} className={styles.cause}>
            From: {cause.title}
          </Link>
        )}
      </div>
      {link.sourceIds.length > 0 && <SourceChips ids={link.sourceIds} />}
    </li>
  )
}

/**
 * Ripple effects (ORBIT's USP): how an event spreads to other countries and markets.
 * On an event it shows the chain the event causes; on a country, every ripple that touches it.
 */
export function RipplePanel({
  eventId,
  countryId,
}: {
  eventId?: ImpactLink['eventId']
  countryId?: CountryId
}) {
  const query = useImpacts({ eventId, countryId })
  return (
    <Panel eyebrow="Ripple effects">
      <QueryState query={query} label="ripple effects">
        {(links) =>
          links.length ? (
            <ol className={styles.list}>
              {asChains(links).map(({ link, depth }) => (
                <RippleItem
                  key={link.id}
                  link={link}
                  depth={depth}
                  showCause={Boolean(countryId)}
                />
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>No ripple effects tracked yet.</p>
          )
        }
      </QueryState>
    </Panel>
  )
}
