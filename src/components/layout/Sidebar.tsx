import { useState, useEffect, useMemo, useRef } from 'react'
import { NavLink } from 'react-router-dom'
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
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Lock,
  Settings,
  Keyboard,
  ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside'
import { useModeSwitch } from '../../hooks/useModeSwitch'
import { useClickOrDoubleClick } from '../../lib/rowInteraction'
import { canAccessRoute, type Mode } from '../../lib/auth/permissions'
import { ROUTES } from '../../lib/routes'
import { useTranslation } from '../../lib/i18n'
import { SyncStatusIndicator } from '../SyncStatusIndicator'

// Icons are kept here rather than in src/lib/routes.ts on purpose — that
// file has zero imports so a Node-only test can read it without pulling in
// lucide-react (see its header comment).
const NAV_ICONS: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/appointments': Calendar,
  '/work-orders': ClipboardList,
  '/bays': Warehouse,
  '/vehicles': Car,
  '/service-history': History,
  '/reminders': AlarmClock,
  '/customers': Users,
  '/companies': Building2,
  '/technicians': HardHat,
  '/inventory': Package,
  '/suppliers': Truck,
  '/expenses': Receipt,
  '/reports': BarChart3,
  '/messages': MessageSquare,
}

type NavEntry = { divider: true } | { path: string; labelKey: string; icon: LucideIcon }

/** Sidebar entries filtered by canAccessRoute (src/lib/auth/permissions.ts) —
 *  the same predicate the route guard and keyboard shortcuts use, so the
 *  sidebar never offers a link RequireAdmin would bounce. A divider is drawn
 *  wherever routes.ts's `section` changes between two consecutive *visible*
 *  items, so a section entirely filtered out for Worker mode just never gets
 *  a divider rather than leaving one stranded. */
function visibleNavigation(mode: Mode): NavEntry[] {
  const visible = ROUTES.filter((r) => r.labelKey && canAccessRoute(mode, r.path))
  const entries: NavEntry[] = []
  visible.forEach((route, i) => {
    if (i > 0 && route.section !== visible[i - 1].section) entries.push({ divider: true })
    entries.push({ path: route.path, labelKey: route.labelKey!, icon: NAV_ICONS[route.path] })
  })
  return entries
}

// Below this the sidebar starts collapsed to its icon rail and the topbar sheds
// its labels, so the shell stays usable on a shop-floor tablet. Matches
// Tailwind's `lg`, which the classNames below use for the same cutoff.
const WIDE_VIEWPORT = '(min-width: 1024px)'

const isWideViewport = () => (typeof window === 'undefined' || !window.matchMedia ? true : window.matchMedia(WIDE_VIEWPORT).matches)

/**
 * The app's left rail: wordmark, filtered navigation, collapse toggle, the
 * operator-identity footer (single-click opens a menu, double-click switches
 * Worker ⇄ Admin — see useModeSwitch), and the sync status footer. Owns its
 * own expanded/collapsed state (and the viewport-crossing effect that
 * follows it) and its profile-dropdown state — Layout.tsx needs neither for
 * anything else.
 */
export function Sidebar({
  mode,
  isAdmin,
  adminUsername,
  onOpenSettings,
  onOpenProfile,
  onOpenShortcuts,
  onLock,
  onSignOut,
}: {
  mode: Mode
  isAdmin: boolean
  adminUsername: string | null
  onOpenSettings: () => void
  onOpenProfile: () => void
  onOpenShortcuts: () => void
  onLock: () => void
  onSignOut: () => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(isWideViewport)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const profileDropdownRef = useRef<HTMLDivElement>(null)
  const profileClickHandlers = useClickOrDoubleClick()
  const modeSwitch = useModeSwitch()

  const navigation = useMemo(() => visibleNavigation(mode), [mode])

  // Follow the viewport across the breakpoint, but only on an actual crossing —
  // so a manual collapse/expand sticks until the window is genuinely resized.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia(WIDE_VIEWPORT)
    const handleChange = (e: MediaQueryListEvent) => setExpanded(e.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  useDismissOnOutside(profileDropdownOpen, () => setProfileDropdownOpen(false), [profileButtonRef, profileDropdownRef])

  // A double-click also selects the "Worker"/"Admin" label - clear it so a
  // toast/dialog doesn't open over a highlighted word.
  const handleProfileDoubleClick = () => {
    window.getSelection()?.removeAllRanges()
    setProfileDropdownOpen(false)
    modeSwitch()
  }

  return (
    <aside
      className={`${expanded ? 'w-56' : 'w-16'} flex-shrink-0 bg-bg-0 border-r border-border-1 flex flex-col transition-[width] duration-med ease-out`}
    >
      {/* Header — plain-type wordmark, no logo mark (DESIGN.md §3/§7) */}
      <div className={`p-4 border-b border-border-1 flex items-center ${expanded ? 'gap-3' : 'justify-center'}`}>
        {expanded ? (
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
                  expanded ? '' : 'justify-center'
                } ${isActive ? 'bg-accent-muted text-accent font-medium' : 'text-fg-2 font-normal hover:bg-bg-3 hover:text-fg-1'}`
              }
              title={!expanded ? t(item.labelKey) : undefined}
            >
              <Icon size={17} className="flex-shrink-0" />
              {expanded && <span className="text-sm whitespace-nowrap">{t(item.labelKey)}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse/Expand Button */}
      <div className="p-2.5 border-t border-border-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-2.5 h-[34px] px-2.5 rounded-radius-sm text-fg-2 hover:text-fg-1 hover:bg-bg-3 transition-colors duration-fast ease-out ${
            expanded ? '' : 'justify-center'
          }`}
          title={expanded ? t('layout.collapseSidebarTitle') : t('layout.expandSidebarTitle')}
        >
          {expanded ? (
            <>
              <ChevronLeft size={17} className="flex-shrink-0" />
              <span className="text-sm">{t('layout.collapseSidebar')}</span>
            </>
          ) : (
            <ChevronRight size={17} />
          )}
        </button>
      </div>

      {/* Operator identity footer (DESIGN.md §3) — reflects the real
          Admin/Worker mode from src/store/authStore.ts. Single-click opens
          the menu; double-click switches Worker ⇄ Admin. */}
      <div className="p-2.5 border-t border-border-1 relative">
        <button
          ref={profileButtonRef}
          {...profileClickHandlers(() => setProfileDropdownOpen((open) => !open), handleProfileDoubleClick)}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-radius-sm text-fg-2 hover:text-fg-1 hover:bg-bg-3 transition-colors duration-fast ease-out ${
            expanded ? '' : 'justify-center'
          }`}
          title={t('layout.profileSwitchHint')}
        >
          <div className="w-7 h-7 rounded-full bg-bg-3 border border-border-2 flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-semibold text-fg-2">{isAdmin ? 'AD' : 'WK'}</span>
          </div>
          {expanded && (
            <>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-medium text-fg-1 truncate">{isAdmin ? t('auth.mode.adminLabel') : t('auth.mode.workerLabel')}</p>
                <p className="text-xs text-fg-3 truncate">{isAdmin && adminUsername ? adminUsername : t('layout.operatorRole')}</p>
              </div>
              <ArrowLeftRight size={14} className="text-fg-3 flex-shrink-0" />
            </>
          )}
        </button>

        {profileDropdownOpen && (
          <div ref={profileDropdownRef} className="absolute bottom-full left-2.5 right-2.5 mb-1 bg-surface-card border border-border-2 rounded-radius-sm shadow-lg py-1">
            {isAdmin && (
              <button
                onClick={() => {
                  onOpenSettings()
                  setProfileDropdownOpen(false)
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-fg-1 hover:bg-bg-3 transition-colors"
              >
                <Settings size={16} />
                {t('layout.settingsMenuItem')}
              </button>
            )}
            <button
              onClick={() => {
                onOpenProfile()
                setProfileDropdownOpen(false)
              }}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-fg-1 hover:bg-bg-3 transition-colors"
            >
              <User size={16} />
              {t('layout.viewProfileMenuItem')}
            </button>
            <button
              onClick={() => {
                onOpenShortcuts()
                setProfileDropdownOpen(false)
              }}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-fg-1 hover:bg-bg-3 transition-colors"
            >
              <Keyboard size={16} />
              {t('layout.shortcutsMenuItem')}
            </button>
            <div className="h-px bg-border-1 my-1" />
            <button
              onClick={() => {
                onLock()
                setProfileDropdownOpen(false)
              }}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-fg-1 hover:bg-bg-3 transition-colors"
            >
              <Lock size={16} />
              {t('auth.session.lockMenuItem')}
            </button>
            <button
              onClick={() => {
                onSignOut()
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

      {/* Version + sync status footer */}
      <div className={`border-t border-border-1 ${expanded ? 'p-4 space-y-2' : 'p-2.5 flex justify-center'}`}>
        {expanded ? (
          <>
            <p className="text-xs text-fg-3">{t('layout.versionFooter')}</p>
            <SyncStatusIndicator />
          </>
        ) : (
          <SyncStatusIndicator compact />
        )}
      </div>
    </aside>
  )
}
