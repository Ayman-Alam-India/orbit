import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './ErrorState'

type ErrorBoundaryProps = {
  /** Shown to the user if anything inside crashes, e.g. "Country panel failed". */
  title?: string
  children: ReactNode
}

/** Wrap each feature panel in one, so a crash in one panel never blanks the whole app. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ui] ${this.props.title ?? 'Panel'} crashed`, error, info)
  }

  render() {
    return this.state.error ? (
      <ErrorState
        title={this.props.title ?? 'This panel failed to load'}
        error={this.state.error}
        onRetry={() => this.setState({ error: undefined })}
      />
    ) : (
      this.props.children
    )
  }
}
