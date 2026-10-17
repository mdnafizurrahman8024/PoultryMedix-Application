import { Component } from 'react'
import i18n from './i18n.js'

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
        <main role="alert" className="p-4 text-center bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
          <h1>{i18n.t('antibiotics.errorTitle')}</h1>
          <p>{i18n.t('antibiotics.errorDescription')}</p>
          <button type="button" onClick={this.handleRefresh}>{i18n.t('antibiotics.refresh')}</button>
        </main>
      )
    }

    return this.props.children
  }
}
