import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../ui/Button'
import { exportBackup } from '../../lib/ops/backupOps'
// translate(), not the hook: this is a class component, and it may be all
// that renders after the rest of the tree has crashed.
import { translate } from '../../lib/i18n'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches a render-phase throw anywhere below it (src/main.tsx wraps <App/>
 * with this) and shows a recovery screen instead of a blank window. Before
 * this existed, `grep -rn "ErrorBoundary|componentDidCatch" src/` returned
 * zero hits: any uncaught render error blanked the whole Electron window
 * with nothing to click and nothing explaining why — the same class of
 * failure commit d22cca0 ("Fix blank app window") already had to fix once
 * for a different cause. There is also no console/telemetry anywhere in
 * src/, so componentDidCatch's console.error below is the only trace of a
 * crash that exists at all.
 *
 * The "Download backup" action calls the same collectBackup()/downloadFile()
 * the manual Settings > Backup button uses — a crash screen a shop owner is
 * staring at is exactly the moment an easy way to get their data out
 * matters most, and this works even though the crash may have made the
 * normal Settings page itself unreachable.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleDownloadBackup = (): void => {
    exportBackup('crash')
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-screen items-center justify-center bg-bg-1 p-8">
        <div className="max-w-md text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-danger" />
          <h1 className="font-display text-lg font-medium text-fg-1 mb-2">{translate('storageError.crashTitle')}</h1>
          <p className="text-fg-2 mb-1">{translate('storageError.crashMessage')}</p>
          <p className="text-fg-3 text-sm mb-6 break-words">{error.message}</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={this.handleDownloadBackup}>
              {translate('storageError.downloadBackup')}
            </Button>
            <Button variant="primary" onClick={this.handleReload}>
              {translate('storageError.reload')}
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
