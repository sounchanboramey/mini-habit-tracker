import { Component } from 'react'

// ---------------------------------------------------------------------------
// ErrorBoundary — class component (React only supports boundaries as classes)
//
// Hand-written per assignment: know every guard you ship.
// Catches render/lifecycle errors in the child subtree.
// Shows a fallback UI with a "Try again" button that resets the subtree.
// ---------------------------------------------------------------------------
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      message: '',
    }
    this.reset = this.reset.bind(this)
  }

  // Called during render when a descendant throws — update state before repaint
  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message ?? 'Something went wrong.' }
  }

  // Called after the error is captured — good place for logging
  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary: ${this.props.label ?? 'section'}]`, error, info.componentStack)
  }

  // "Try again" — unmounts the crashed subtree then re-mounts it cleanly
  reset() {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (this.state.hasError) {
      // If a custom fallback was passed, use it; otherwise show the default card
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="boundary-fallback" role="alert">
          <span className="boundary-icon">⚠</span>
          <p className="boundary-label">
            <strong>{this.props.label ?? 'This section'}</strong> ran into a problem.
          </p>
          <p className="boundary-message">{this.state.message}</p>
          <button className="primary boundary-retry" onClick={this.reset}>
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
