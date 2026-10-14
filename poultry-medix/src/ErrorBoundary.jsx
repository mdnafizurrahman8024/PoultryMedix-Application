import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled application error:', error, errorInfo)
  }

  handleRefresh = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" className="p-4 text-center">
          <h1>Something went wrong.</h1>
          <p>Please refresh the page and try again.</p>
          <button type="button" onClick={this.handleRefresh}>Refresh</button>
        </main>
      )
    }

    return this.props.children
  }
}
