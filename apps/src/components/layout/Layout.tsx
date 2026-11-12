import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { PasswordPromptHost } from '../auth/PasswordPromptHost'
import { AdminElevateDialog } from '../auth/AdminElevateDialog'
import { RecoveryCodeDialog } from '../auth/RecoveryCodeDialog'
import { ToastHost } from '../ui/Toast'
import { StorageErrorBanner } from './StorageErrorBanner'
import { UpdateReadyBanner } from './UpdateReadyBanner'
import { LanOpenBanner } from './LanOpenBanner'
import { ShortcutsHelp } from './ShortcutsHelp'
import { useShortcutsHelpStore, useConfirmStore } from '../../store/uiStores'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useAuthStore, useIsAdmin, useMode } from '../../store/authStore'
import { useSecurityStore } from '../../store/securityStore'
import { findRoute } from '../../lib/app/routes'
import { useTranslation } from '../../lib/i18n'
import GlobalSearch from '../search/GlobalSearch'

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
  const openSearch = useCallback(() => setSearchOpen(true), [])
  useKeyboardShortcuts({ onSearch: openSearch })
  const [switchAccountConfirm, setSwitchAccountConfirm] = useState(false)

  const titleKey = findRoute(location.pathname)?.titleKey
  const pageTitle = titleKey ? t(titleKey) : t('topbar.appName')

  // Keyboard / screen-reader orientation: the skip link and every page change
  // land focus on <main>, so Tab continues from the new page's content instead
  // of from wherever the previous page's (now unmounted) control was. Skipped
  // on the first render — a freshly opened window shouldn't steal focus.
  const mainRef = useRef<HTMLElement>(null)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

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
      {/* First focusable element: invisible until a keyboard user tabs to it.
          preventDefault because the router may be hash-based, where a bare
          #fragment link would be read as a route change. */}
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault()
          mainRef.current?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-3 focus:py-2 focus:rounded-radius-sm focus:bg-accent focus:text-fg-inverse focus:text-sm focus:font-medium focus-ring"
      >
        {t('common.skipToContent')}
      </a>
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
        <Topbar pageTitle={pageTitle} onSearch={openSearch} onNewOrder={() => navigate('/work-orders?new=1')} />

        {/* Page Content — padding centralized here (pages no longer wrap in p-6) */}
        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-auto bg-bg-1 px-4 py-5 lg:px-8 lg:py-7 focus:outline-none"
        >
          <Outlet />
        </main>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Toasts (DESIGN_SYSTEM.md §7) */}
      <ToastHost />

      {/* Persistent top banners — stacked in one fixed container so two
          independently `fixed`-positioned banners can't render on top of
          each other. Storage-error is the more urgent message and sits
          first (i.e. on top). */}
      <div className="fixed inset-x-0 top-0 z-[60] flex flex-col">
        <StorageErrorBanner />
        <LanOpenBanner />
        <UpdateReadyBanner />
      </div>

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
          which action minted it — see uiStores.ts's header for why
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
