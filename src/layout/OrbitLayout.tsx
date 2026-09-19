import { lazy, Suspense, useEffect } from 'react'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { AskPanel } from '../features/ask/AskPanel'
import { paths, ROUTE_PATTERNS } from '../routes'
import { useUiStore } from '../state/uiStore'
import { ErrorBoundary, Loader } from '../ui'
import styles from './OrbitLayout.module.css'
import { TopBar } from './TopBar'
import { useMiniGlobeTransform } from './useMiniGlobeTransform'

// The globe is heavy (three.js), so it loads separately from the rest of the app.
const OrbitGlobe = lazy(() => import('../globe/OrbitGlobe'))

/**
 * App shell (decision owner: Arham).
 * - Global view ("/"): full-screen globe, panels in a right column.
 * - Detail views (country, event): the globe squeezes into a mini globe in the bottom-left and the
 *   route's content fills a centred column. Clicking the mini globe returns to the global view.
 * The globe stays mounted in both modes, so it never reloads.
 */
export function OrbitLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const isGlobal = Boolean(useMatch(ROUTE_PATTERNS.global))
  const mode = isGlobal ? 'global' : 'detail'
  const { askOpen, setAskOpen } = useUiStore()
  const miniGlobeStyle = useMiniGlobeTransform()

  useEffect(() => {
    if (!askOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAskOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [askOpen, setAskOpen])

  return (
    <div className={styles.shell} data-mode={mode} style={miniGlobeStyle}>
      <div className={styles.globe} data-testid="globe-stage">
        <ErrorBoundary title="The globe failed to load">
          <Suspense fallback={<Loader label="Loading globe" />}>
            <OrbitGlobe />
          </Suspense>
        </ErrorBoundary>
      </div>

      {!isGlobal && (
        <button
          type="button"
          className={styles.miniGlobeButton}
          aria-label="Back to global view"
          onClick={() => navigate(paths.global())}
        />
      )}

      <TopBar />

      <main className={styles.overlay}>
        <div key={location.pathname} className={styles.view}>
          <ErrorBoundary title="This view failed to load">
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <aside
        className={styles.drawer}
        data-open={askOpen}
        aria-label="Ask ORBIT"
        aria-hidden={!askOpen}
        inert={!askOpen}
      >
        <ErrorBoundary title="Ask ORBIT failed">
          <AskPanel />
        </ErrorBoundary>
      </aside>
    </div>
  )
}
