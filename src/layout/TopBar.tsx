import { Link } from 'react-router-dom'
import { paths } from '../routes'
import { useUiStore } from '../state/uiStore'
import { Button } from '../ui'
import { HeadlineTicker } from './HeadlineTicker'
import { SearchBox } from './SearchBox'
import styles from './TopBar.module.css'

/** Logo · headline ticker · search · Ask ORBIT. */
export function TopBar() {
  const { askOpen, setAskOpen } = useUiStore()
  return (
    <header className={styles.topbar}>
      <Link to={paths.global()} className={styles.brand} aria-label="ORBIT home">
        ORBIT
      </Link>
      <HeadlineTicker />
      <SearchBox />
      <Button variant="accent" onClick={() => setAskOpen(!askOpen)} aria-expanded={askOpen}>
        Ask ORBIT
      </Button>
    </header>
  )
}
