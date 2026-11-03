import type { NewsHeadline } from '@shared'
import type { MouseEvent } from 'react'

/**
 * A plain click on a headline opens ORBIT's article preview; Ctrl/Cmd/Shift-click and middle-click
 * keep the browser's normal "open the site in a new tab".
 */
export function previewOnPlainClick(headline: NewsHeadline, open: (h: NewsHeadline) => void) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    open(headline)
  }
}
