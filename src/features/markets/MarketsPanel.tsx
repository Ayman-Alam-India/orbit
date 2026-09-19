import type { CountryId, MarketQuote } from '@shared'
import { Panel, QueryState } from '../../ui'
import { formatDate, shortSourceName } from '../event/format'
import { useSources } from '../event/useSources'
import { changePct, formatChange, formatMarketValue } from './format'
import styles from './Markets.module.css'
import { Sparkline } from './Sparkline'
import { useMarkets } from './useMarkets'

export function MarketRow({ quote }: { quote: MarketQuote }) {
  const sources = useSources()
  const pct = changePct(quote)
  const source = sources.data?.find((s) => s.id === quote.sourceId)
  return (
    <div className={styles.row}>
      <div className={styles.name}>
        <span>{quote.name}</span>
        <span className={styles.meta} title={source?.name}>
          {quote.live ? 'Live' : 'Snapshot'} · {formatDate(quote.asOf)}
          {source && ` · ${shortSourceName(source.name)}`}
        </span>
      </div>
      <Sparkline values={(quote.history ?? []).map((p) => p.value)} label={quote.name} />
      <div className={styles.figures}>
        <span className={styles.value}>{formatMarketValue(quote)}</span>
        {pct !== undefined && (
          <span
            className={styles.change}
            data-direction={pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'}
          >
            {formatChange(pct)}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Markets & economy (decision owner: Shrey): Brent, USD/INR, Indian indices, stocks and fuel.
 * `ids` picks and orders a subset (e.g. the global view shows only the headline figures).
 */
export function MarketsPanel({ countryId, ids }: { countryId?: CountryId; ids?: string[] }) {
  const query = useMarkets(countryId)
  return (
    <Panel eyebrow={countryId ? 'Markets & economy' : 'Markets'}>
      <QueryState query={query} label="markets">
        {(quotes) => {
          const shown = ids
            ? ids
                .map((id) => quotes.find((q) => q.id === id))
                .filter((q): q is MarketQuote => Boolean(q))
            : quotes
          return shown.length ? (
            <div className={styles.list}>
              {shown.map((q) => (
                <MarketRow key={q.id} quote={q} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No market figures for this country yet.</p>
          )
        }}
      </QueryState>
    </Panel>
  )
}
