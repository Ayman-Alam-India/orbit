import { lazy, Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { AskPanel } from '../features/ask/AskPanel'
import { paths } from '../routes'
import { useUiStore } from '../state/uiStore'
import { ErrorBoundary, Loader } from '../ui'
import styles from './OrbitLayout.module.css'

// The globe is heavy (three.js), so it loads separately from the rest of the app.
const OrbitGlobe = lazy(() => import('../globe/OrbitGlobe'))

/**
 * App shell (owner: Arham). The globe stays mounted behind everything; the route's panel
 * (<Outlet/>) renders in the overlay column, so the globe never reloads between pages.
 */
export function OrbitLayout() {
  const { askOpen, setAskOpen } = useUiStore()
  return (
    <div className={styles.shell}>
      <div className={styles.globe}>
        <ErrorBoundary title="The globe failed to load">
          <Suspense fallback={<Loader label="Loading globe" />}>
            <OrbitGlobe />
          </Suspense>
        </ErrorBoundary>
      </div>

      <header className={styles.topbar}>
        <Link to={paths.global()} className={styles.brand}>
          ORBIT
        </Link>
        <button type="button" className={styles.askButton} onClick={() => setAskOpen(!askOpen)}>
          Ask ORBIT
        </button>
      </header>

      <main className={styles.overlay}>
        <ErrorBoundary title="This view failed to load">
          <Outlet />
        </ErrorBoundary>
      </main>

      {askOpen && (
        <aside className={styles.ask}>
          <ErrorBoundary title="Ask ORBIT failed">
            <AskPanel />
          </ErrorBoundary>
        </aside>
      )}
    </div>
  )
}
