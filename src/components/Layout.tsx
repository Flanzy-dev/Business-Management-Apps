import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { Sidebar } from './layout/Sidebar'
import { Topbar } from './layout/Topbar'
import { PasswordPromptHost } from './auth/PasswordPromptHost'
import { ToastHost } from './ui/Toast'
import { StorageErrorBanner } from './StorageErrorBanner'
import { ShortcutsHelp } from './ShortcutsHelp'
import { useShortcutsHelpStore } from '../store/shortcutsHelpStore'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useConfirmStore } from '../store/confirmStore'
import { useAuthStore, useIsAdmin, useMode } from '../store/authStore'
import { useSecurityStore } from '../store/securityStore'
import { useIdleLock } from '../lib/auth/useIdleLock'
import { findRoute } from '../lib/routes'
import { useTranslation } from '../lib/i18n'
import GlobalSearch from './GlobalSearch'

/** Hosts the app-wide ConfirmDialog requested via useConfirmStore.request(). */
function ConfirmHost() {
  const pending = useConfirmStore(s => s.pending)
  const close = useConfirmStore(s => s.close)
  return (
    <ConfirmDialog
      open={!!pending}
      title={pending?.title ?? ''}
      message={pending?.message ?? ''}
      confirmLabel={pending?.confirmLabel}
      tone={pending?.tone}
      onConfirm={() => pending?.onConfirm()}
      onClose={close}
    />
  )
}

export default function Layout() {
  useKeyboardShortcuts()
  useIdleLock()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  // App.tsx only ever mounts Layout once mode is non-null (see its
  // LockScreen early return), so this fallback never actually applies —
  // it just keeps the type honest without an assertion.
  const mode = useMode()
  const isAdmin = useIsAdmin()
  const lock = useAuthStore((s) => s.lock)
  const adminUsername = useSecurityStore((s) => s.security.adminUsername)
  const [searchOpen, setSearchOpen] = useState(false)
  const [signOutConfirm, setSignOutConfirm] = useState(false)

  const titleKey = findRoute(location.pathname)?.titleKey
  const pageTitle = titleKey ? t(titleKey) : t('topbar.appName')

  const confirmSignOut = () => {
    // For a local-only app, this reloads the app to reset session state
    window.location.reload()
  }

  return (
    <div className="flex h-screen bg-bg-1">
      <Sidebar
        mode={mode}
        isAdmin={isAdmin}
        adminUsername={adminUsername}
        onOpenSettings={() => navigate('/settings')}
        onOpenProfile={() => navigate('/profile')}
        onOpenShortcuts={() => useShortcutsHelpStore.getState().setOpen(true)}
        onLock={lock}
        onSignOut={() => setSignOutConfirm(true)}
      />

      {/* Main Content Area — min-w-0 lets this column shrink below its content's
          intrinsic width instead of forcing the whole shell wide on a tablet. */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Topbar pageTitle={pageTitle} onSearch={() => setSearchOpen(true)} onNewOrder={() => navigate('/work-orders?new=1')} />

        {/* Page Content — padding centralized here (pages no longer wrap in p-6) */}
        <main className="flex-1 overflow-auto bg-bg-1 px-4 py-5 lg:px-8 lg:py-7">
          <Outlet />
        </main>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Toasts (DESIGN.md §8) */}
      <ToastHost />

      {/* Persistent warning when a write to disk fails (src/lib/storageAdapter.ts) */}
      <StorageErrorBanner />

      {/* Keyboard-shortcut cheatsheet ("?" or the profile menu) */}
      <ShortcutsHelp />

      {/* App-wide confirm dialog (replaces window.confirm) */}
      <ConfirmHost />

      {/* App-wide admin re-auth prompt for danger-zone actions */}
      <PasswordPromptHost />

      {/* Sign Out Confirmation */}
      <ConfirmDialog
        open={signOutConfirm}
        title={t('layout.signOutDialogTitle')}
        message={t('layout.signOutDialogMessage')}
        confirmLabel={t('layout.signOutConfirmLabel')}
        onConfirm={confirmSignOut}
        onClose={() => setSignOutConfirm(false)}
      />
    </div>
  )
}
