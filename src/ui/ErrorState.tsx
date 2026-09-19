import styles from './ErrorState.module.css'

type ErrorStateProps = {
  title?: string
  error?: unknown
  onRetry?: () => void
}

/** Standard error state. Every query shows this when it fails. */
export function ErrorState({ title = 'Something went wrong', error, onRetry }: ErrorStateProps) {
  const message = error instanceof Error ? error.message : undefined
  return (
    <div className={styles.error} role="alert">
      <strong>{title}</strong>
      {message && <p className={styles.message}>{message}</p>}
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
