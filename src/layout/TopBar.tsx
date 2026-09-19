import { Link } from 'react-router-dom'
import { paths } from '../routes'
import { useUiStore } from '../state/uiStore'
import { Button } from '../ui'
import { SearchBox } from './SearchBox'
import styles from './TopBar.module.css'

/** A single floating toolbar capsule, centred at the top: logo · search · Ask ORBIT. */
export function TopBar() {
  const { askOpen, setAskOpen } = useUiStore()
  return (
    <header className={styles.topbar}>
      <div className={styles.toolbar}>
        <Link to={paths.global()} className={styles.brand} aria-label="ORBIT home">
          <span className={styles.dot} aria-hidden />
          ORBIT
        </Link>
        <SearchBox />
        <Button variant="accent" onClick={() => setAskOpen(!askOpen)} aria-expanded={askOpen}>
          Ask ORBIT
        </Button>
      </div>
    </header>
  )
}
