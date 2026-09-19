import type { OrbitEventKind } from '@shared'
import type { ReactNode } from 'react'
import styles from './Tag.module.css'

type TagProps = {
  /** Colours the tag by event kind; without it the tag is neutral. */
  kind?: OrbitEventKind
  children: ReactNode
}

/** A small label pill: event kind, category, region… */
export function Tag({ kind, children }: TagProps) {
  return (
    <span className={styles.tag} data-kind={kind ?? 'neutral'}>
      {children}
    </span>
  )
}
