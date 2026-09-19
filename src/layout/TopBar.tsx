import { Link } from 'react-router-dom'
import { paths } from '../routes'
import { useUiStore } from '../state/uiStore'
import { Button } from '../ui'
import { SearchBox } from './SearchBox'
import styles from './TopBar.module.css'

/** A single floating toolbar capsule, centred at the top: logo · search · Tour · What if… · Ask ORBIT. */
export function TopBar() {
  const { askOpen, setAskOpen, tourActive, setTourActive } = useUiStore()
  return (
    <header className={styles.topbar}>
      <div className={styles.toolbar}>
        <Link to={paths.global()} className={styles.brand} aria-label="ORBIT home">
          <span className={styles.dot} aria-hidden />
          ORBIT
        </Link>
        <SearchBox />
        <button
          type="button"
          className={styles.whatIf}
          aria-pressed={tourActive}
          onClick={() => setTourActive(!tourActive)}
        >
          ▶ Tour
        </button>
        <Link to={paths.simulate()} className={styles.whatIf}>
          What if…
        </Link>
        <Button variant="accent" onClick={() => setAskOpen(!askOpen)} aria-expanded={askOpen}>
          Ask ORBIT
        </Button>
      </div>
    </header>
  )
}
