import { useUiStore } from '../state/uiStore'
import { Button } from '../ui'
import styles from './GlobeNav.module.css'

/** ← / ⟳ / → under the legend: turn the globe 30° per click, or recentre it. */
export function GlobeNav() {
  const navigateGlobe = useUiStore((s) => s.navigateGlobe)
  return (
    <div className={styles.nav} role="group" aria-label="Globe navigation">
      <Button
        variant="ghost"
        iconOnly
        aria-label="Turn globe left"
        title="Turn left"
        onClick={() => navigateGlobe('left')}
      >
        ←
      </Button>
      <Button
        variant="ghost"
        iconOnly
        aria-label="Recentre globe"
        title="Recentre"
        onClick={() => navigateGlobe('recentre')}
      >
        ⟳
      </Button>
      <Button
        variant="ghost"
        iconOnly
        aria-label="Turn globe right"
        title="Turn right"
        onClick={() => navigateGlobe('right')}
      >
        →
      </Button>
    </div>
  )
}
