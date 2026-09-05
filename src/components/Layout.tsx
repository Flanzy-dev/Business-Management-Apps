import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { Sidebar } from './layout/Sidebar'
import { Topbar } from './layout/Topbar'
import { PasswordPromptHost } from './auth/PasswordPromptHost'
import { AdminElevateDialog } from './auth/AdminElevateDialog'
import { RecoveryCodeDialog } from './auth/RecoveryCodeDialog'
import { ToastHost } from './ui/Toast'
import { StorageErrorBanner } from './StorageErrorBanner'
import { ShortcutsHelp } from './ShortcutsHelp'
import { useShortcutsHelpStore } from '../store/shortcutsHelpStore'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useConfirmStore } from '../store/confirmStore'
import { useAuthStore, useIsAdmin, useMode } from '../store/authStore'
import { useSecurityStore } from '../store/securityStore'
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
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  // App.tsx only ever mounts Layout once mode is non-null (see its
  // LoginScreen early return), so this fallback never actually applies —
  // it just keeps the type honest without an assertion.
  const mode = useMode()
  const isAdmin = useIsAdmin()
  const signOut = useAuthStore((s) => s.signOut)
  const adminUsername = useSecurityStore((s) => s.security.adminUsername)
  const [searchOpen, setSearchOpen] = useState(false)
  const [switchAccountConfirm, setSwitchAccountConfirm] = useState(false)

  const titleKey = findRoute(location.pathname)?.titleKey
  const pageTitle = titleKey ? t(titleKey) : t('topbar.appName')

  // No window.location.reload() here any more. signOut() clears this
  // device's session marker and sets mode to null, and App.tsx renders the
  // login screen on the very next render — which is strictly better than a
  // reload: the three startup backfills don't re-run and the sync connection
  // isn't torn down and rebuilt. (RestoreRecoveryFlow still reloads, and
  // should: it genuinely replaced every store's contents underneath React.)
  const confirmSwitchAccount = () => {
    signOut()
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
        onSwitchAccount={() => setSwitchAccountConfirm(true)}
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

      {/* Sidebar double-click Worker -> Admin, asking for real credentials —
          see src/hooks/useModeSwitch.ts and AdminElevateDialog's own header
          for why this is a separate dialog from PasswordPromptHost above. */}
      <AdminElevateDialog />

      {/* Shows a freshly minted admin recovery code exactly once, no matter
          which action minted it — see recoveryCodeStore.ts's header for why
          this has to live here (mounted whenever an admin session exists)
          rather than in whichever screen happened to trigger the mint. */}
      <RecoveryCodeDialog />

      {/* Switch-account confirmation. Kept (rather than switching straight
          away) because this item sits in a menu whose every other entry is
          harmless, so a mis-click would otherwise cost a technician their
          place mid-order — and the switch discards anything half-typed into
          an open form. tone="primary" because ConfirmDialog defaults to
          'danger', and a red button would badly overstate a routine action. */}
      <ConfirmDialog
        open={switchAccountConfirm}
        title={t('auth.session.switchAccountDialogTitle')}
        message={t('auth.session.switchAccountDialogMessage')}
        confirmLabel={t('auth.session.switchAccountConfirmLabel')}
        tone="primary"
        onConfirm={confirmSwitchAccount}
        onClose={() => setSwitchAccountConfirm(false)}
      />
    </div>
  )
}
