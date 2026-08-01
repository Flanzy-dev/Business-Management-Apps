import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Warehouse,
  Car,
  History,
  AlarmClock,
  Users,
  Building2,
  HardHat,
  Package,
  Truck,
  Receipt,
  BarChart3,
  MessageSquare,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Bell,
  Plus,
  ArrowLeftRight,
} from 'lucide-react'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { IconButton } from './ui/IconButton'
import { Button } from './ui/Button'
import { ToastHost } from './ui/Toast'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useConfirmStore } from '../store/confirmStore'
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

const navigation = [
  { labelKey: 'nav.dashboard', path: '/', icon: LayoutDashboard },
  { labelKey: 'nav.appointments', path: '/appointments', icon: Calendar },
  { labelKey: 'nav.serviceOrders', path: '/work-orders', icon: ClipboardList },
  { labelKey: 'nav.bays', path: '/bays', icon: Warehouse },
  { labelKey: 'nav.vehicles', path: '/vehicles', icon: Car },
  { labelKey: 'nav.serviceHistory', path: '/service-history', icon: History },
  { labelKey: 'nav.reminders', path: '/reminders', icon: AlarmClock },
  { divider: true },
  { labelKey: 'nav.customers', path: '/customers', icon: Users },
  { labelKey: 'nav.companies', path: '/companies', icon: Building2 },
  { labelKey: 'nav.technicians', path: '/technicians', icon: HardHat },
  { divider: true },
  { labelKey: 'nav.inventory', path: '/inventory', icon: Package },
  { labelKey: 'nav.suppliers', path: '/suppliers', icon: Truck },
  { labelKey: 'nav.expenses', path: '/expenses', icon: Receipt },
  { labelKey: 'nav.reports', path: '/reports', icon: BarChart3 },
  { divider: true },
  { labelKey: 'nav.messages', path: '/messages', icon: MessageSquare },
]

// Route -> topbar title translation key (DESIGN.md §3 Topbar). Settings/Profile
// aren't in the sidebar nav array (reachable only via the profile dropdown
// footer) but still need a title when visited. `/workers` is a back-compat
// alias for `/technicians` (see App.tsx).
const routeTitleKeys: Record<string, string> = {
  '/': 'topbar.dashboard',
  '/appointments': 'topbar.appointments',
  '/work-orders': 'topbar.serviceOrders',
  '/bays': 'topbar.bays',
  '/vehicles': 'topbar.vehicles',
  '/service-history': 'topbar.serviceHistory',
  '/reminders': 'topbar.reminders',
  '/customers': 'topbar.customers',
  '/companies': 'topbar.companies',
  '/technicians': 'topbar.technicians',
  '/workers': 'topbar.technicians',
  '/inventory': 'topbar.inventory',
  '/suppliers': 'topbar.suppliers',
  '/expenses': 'topbar.expenses',
  '/reports': 'topbar.reports',
  '/messages': 'topbar.messages',
  '/settings': 'topbar.settings',
  '/profile': 'topbar.profile',
}

// Below this the sidebar starts collapsed to its icon rail and the topbar sheds
// its labels, so the shell stays usable on a shop-floor tablet. Matches
// Tailwind's `lg`, which the classNames below use for the same cutoff.
const WIDE_VIEWPORT = '(min-width: 1024px)'

const isWideViewport = () =>
  typeof window === 'undefined' || !window.matchMedia
    ? true
    : window.matchMedia(WIDE_VIEWPORT).matches

export default function Layout() {
  useKeyboardShortcuts()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [sidebarExpanded, setSidebarExpanded] = useState(isWideViewport)
  const [searchOpen, setSearchOpen] = useState(false)
  const [signOutConfirm, setSignOutConfirm] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const profileDropdownRef = useRef<HTMLDivElement>(null)

  const titleKey = routeTitleKeys[location.pathname]
  const pageTitle = titleKey ? t(titleKey) : t('topbar.appName')

  const handleSignOut = () => {
    setSignOutConfirm(true)
  }

  const confirmSignOut = () => {
    // For a local-only app, this reloads the app to reset session state
    window.location.reload()
  }

  // Follow the viewport across the breakpoint, but only on an actual crossing —
  // so a manual collapse/expand sticks until the window is genuinely resized.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia(WIDE_VIEWPORT)
    const handleChange = (e: MediaQueryListEvent) => setSidebarExpanded(e.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!profileDropdownOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        profileButtonRef.current && !profileButtonRef.current.contains(target) &&
        profileDropdownRef.current && !profileDropdownRef.current.contains(target)
      ) {
        setProfileDropdownOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [profileDropdownOpen])

  return (
    <div className="flex h-screen bg-bg-1">
      {/* Collapsible Sidebar */}
      <aside
        className={`${
          sidebarExpanded ? 'w-56' : 'w-16'
        } flex-shrink-0 bg-bg-0 border-r border-border-1 flex flex-col transition-all duration-200`}
      >
        {/* Header — plain-type wordmark, no logo mark (DESIGN.md §3/§7) */}
        <div className={`p-4 border-b border-border-1 flex items-center ${sidebarExpanded ? 'gap-3' : 'justify-center'}`}>
          {sidebarExpanded ? (
            <h1 className="font-display font-semibold text-[15px] tracking-wide text-fg-1 whitespace-nowrap overflow-hidden">
              SURYA<span className="text-accent">BARU</span>
            </h1>
          ) : (
            <span className="font-display font-semibold text-[15px] tracking-wide text-accent">SB</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
          {navigation.map((item, index) => {
            if ('divider' in item) {
              return <div key={index} className="h-px bg-border-1 my-2 mx-1" />
            }
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 h-[34px] px-2.5 rounded-radius-sm transition-colors duration-fast ease-out ${
                    sidebarExpanded ? '' : 'justify-center'
                  } ${
                    isActive
                      ? 'bg-accent-muted text-accent font-medium'
                      : 'text-fg-2 font-normal hover:bg-bg-3 hover:text-fg-1'
                  }`
                }
                title={!sidebarExpanded ? t(item.labelKey) : undefined}
              >
                <Icon size={17} className="flex-shrink-0" />
                {sidebarExpanded && <span className="text-sm whitespace-nowrap">{t(item.labelKey)}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Collapse/Expand Button */}
        <div className="p-2.5 border-t border-border-1">
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className={`w-full flex items-center gap-2.5 h-[34px] px-2.5 rounded-radius-sm text-fg-2 hover:text-fg-1 hover:bg-bg-3 transition-colors duration-fast ease-out ${
              sidebarExpanded ? '' : 'justify-center'
            }`}
            title={sidebarExpanded ? t('layout.collapseSidebarTitle') : t('layout.expandSidebarTitle')}
          >
            {sidebarExpanded ? (
              <>
                <ChevronLeft size={17} className="flex-shrink-0" />
                <span className="text-sm">{t('layout.collapseSidebar')}</span>
              </>
            ) : (
              <ChevronRight size={17} />
            )}
          </button>
        </div>

        {/* Operator identity footer (DESIGN.md §3) — generic placeholder, not
            wired to real auth, since there's no multi-user auth system yet. */}
        <div className="p-2.5 border-t border-border-1 relative">
          <button
            ref={profileButtonRef}
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-radius-sm text-fg-2 hover:text-fg-1 hover:bg-bg-3 transition-colors duration-fast ease-out ${
              sidebarExpanded ? '' : 'justify-center'
            }`}
            title={!sidebarExpanded ? t('layout.profileTitle') : undefined}
          >
            <div className="w-7 h-7 rounded-full bg-bg-3 border border-border-2 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-semibold text-fg-2">AD</span>
            </div>
            {sidebarExpanded && (
              <>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-sm font-medium text-fg-1 truncate">{t('layout.adminUserName')}</p>
                  <p className="text-xs text-fg-3 truncate">{t('layout.operatorRole')}</p>
                </div>
                <ArrowLeftRight size={14} className="text-fg-3 flex-shrink-0" />
              </>
            )}
          </button>

          {profileDropdownOpen && (
            <div
              ref={profileDropdownRef}
              className="absolute bottom-full left-2.5 right-2.5 mb-1 bg-surface-card border border-border-2 rounded-radius-sm shadow-lg py-1"
            >
              <button
                onClick={() => {
                  navigate('/settings')
                  setProfileDropdownOpen(false)
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-fg-1 hover:bg-bg-3 transition-colors"
              >
                <Settings size={16} />
                {t('layout.settingsMenuItem')}
              </button>
              <button
                onClick={() => {
                  navigate('/profile')
                  setProfileDropdownOpen(false)
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-fg-1 hover:bg-bg-3 transition-colors"
              >
                <User size={16} />
                {t('layout.viewProfileMenuItem')}
              </button>
              <div className="h-px bg-border-1 my-1" />
              <button
                onClick={() => {
                  handleSignOut()
                  setProfileDropdownOpen(false)
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-danger hover:bg-danger-muted transition-colors"
              >
                <LogOut size={16} />
                {t('layout.signOutMenuItem')}
              </button>
            </div>
          )}
        </div>

        {/* Version footer — collapsed sidebar has no room for it, and an empty
            bordered strip would just read as a stray divider. */}
        {sidebarExpanded && (
          <div className="border-t border-border-1 p-4">
            <p className="text-xs text-fg-3">{t('layout.versionFooter')}</p>
          </div>
        )}
      </aside>

      {/* Main Content Area — min-w-0 lets this column shrink below its content's
          intrinsic width instead of forcing the whole shell wide on a tablet. */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Topbar (DESIGN.md §3) */}
        <header className="h-14 bg-surface-page border-b border-border-1 flex items-center px-4 lg:px-6 gap-3 lg:gap-4">
          <h2 className="font-display text-lg lg:text-xl font-[540] tracking-tight text-fg-1 truncate">
            {pageTitle}
          </h2>

          <div className="ml-auto flex items-center gap-2 lg:gap-2.5">
            {/* Full search field at lg+; below that it collapses to its icon so
                the topbar still fits on one line. */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden lg:flex w-[260px] h-[34px] items-center gap-2.5 px-3 bg-bg-0 border border-border-2 rounded-radius-sm text-fg-3 hover:border-border-3 transition-colors"
            >
              <Search size={16} className="flex-shrink-0" />
              <span className="text-sm truncate">{t('layout.searchPlaceholder')}</span>
            </button>
            <div className="lg:hidden">
              <IconButton label={t('layout.searchPlaceholder')} onClick={() => setSearchOpen(true)}>
                <Search size={18} />
              </IconButton>
            </div>

            <IconButton label={t('layout.notificationsLabel')}>
              <Bell size={18} />
            </IconButton>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              aria-label={t('layout.newOrderButton')}
              onClick={() => navigate('/work-orders?new=1')}
            >
              <span className="hidden lg:inline">{t('layout.newOrderButton')}</span>
            </Button>
          </div>
        </header>

        {/* Page Content — padding centralized here (pages no longer wrap in p-6) */}
        <main className="flex-1 overflow-auto bg-bg-1 px-4 py-5 lg:px-8 lg:py-7">
          <Outlet />
        </main>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Toasts (DESIGN.md §8) */}
      <ToastHost />

      {/* App-wide confirm dialog (replaces window.confirm) */}
      <ConfirmHost />

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
