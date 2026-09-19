import type { ReactNode } from 'react'
import styles from './Panel.module.css'

type PanelProps = {
  title?: ReactNode
  /** Small uppercase label above the title, e.g. "COUNTRY" or "EVENT". */
  eyebrow?: string
  actions?: ReactNode
  /** "accent" = amber border and label, for AI / Ask ORBIT content. */
  tone?: 'default' | 'accent'
  children: ReactNode
}

/** The glass card every overlay section sits in. */
export function Panel({ title, eyebrow, actions, tone = 'default', children }: PanelProps) {
  return (
    <section className={tone === 'accent' ? `${styles.panel} ${styles.accent}` : styles.panel}>
      {(title || eyebrow || actions) && (
        <header className={styles.header}>
          <div>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            {title && <h2 className={styles.title}>{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}
