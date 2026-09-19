import type { Country } from '@shared'
import { Link } from 'react-router-dom'
import { paths } from '../../routes'
import { SeverityBadge, StatTile } from '../../ui'
import { formatPopulation } from '../event/format'
import styles from './CountryView.module.css'

/** Country header: eyebrow, big name, stat strip (capital, population, risk), summary. */
export function CountryHero({ country }: { country: Country }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroTop}>
        <p className={styles.eyebrow}>Country · {country.region}</p>
        <Link to={paths.global()} className={styles.back}>
          ← Globe
        </Link>
      </div>
      <h1 className={styles.name}>{country.name}</h1>
      <div className={styles.stats}>
        <StatTile label="Capital" value={country.capital} />
        <StatTile label="Population" value={formatPopulation(country.population)} />
        <StatTile label="Risk" value={<SeverityBadge severity={country.riskLevel} />} />
      </div>
      <p className={styles.summary}>{country.summary}</p>
    </section>
  )
}
