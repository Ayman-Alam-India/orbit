import type { ReactNode } from 'react'
import styles from './ItemList.module.css'

type ItemListProps<T> = {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  /** Shown when `items` is empty. Every list needs an empty state. */
  empty: string
}

/** A standard vertical list with dividers and an empty state. */
export function ItemList<T>({ items, getKey, renderItem, empty }: ItemListProps<T>) {
  if (!items.length) return <p className={styles.empty}>{empty}</p>
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={getKey(item)} className={styles.item}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  )
}
