import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Warehouse,
  Car,
  History,
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
import GlobalSearch from './GlobalSearch'

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Appointments', path: '/appointments', icon: Calendar },
  { name: 'Service orders', path: '/work-orders', icon: ClipboardList },
  { name: 'Bays', path: '/bays', icon: Warehouse },
  { name: 'Vehicles', path: '/vehicles', icon: Car },
  { name: 'Service History', path: '/service-history', icon: History },
  { divider: true },
  { name: 'Customers', path: '/customers', icon: Users },
  { name: 'Companies', path: '/companies', icon: Building2 },
  { name: 'Technicians', path: '/technicians', icon: HardHat },
  { divider: true },
  { name: 'Inventory', path: '/inventory', icon: Package },
  { name: 'Suppliers', path: '/suppliers', icon: Truck },
  { name: 'Expenses', path: '/expenses', icon: Receipt },
  { name: 'Reports', path: '/reports', icon: BarChart3 },
  { divider: true },
  { name: 'Messages', path: '/messages', icon: MessageSquare },
]

// Route -> topbar title lookup (DESIGN.md §3 Topbar). Settings/Profile aren't
// in the sidebar nav array (reachable only via the profile dropdown footer)
// but still need a title when visited. `/workers` is a back-compat alias for
// `/technicians` (see App.tsx).
const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/appointments': 'Appointments',
  '/work-orders': 'Service orders',
  '/bays': 'Bay status board',
  '/vehicles': 'Vehicles',
  '/service-history': 'Service history',
  '/customers': 'Customers',
  '/companies': 'Companies',
  '/technicians': 'Technicians',
  '/workers': 'Technicians',
  '/inventory': 'Inventory',
  '/suppliers': 'Suppliers',
  '/expenses': 'Expenses',
  '/reports': 'Reports',
  '/messages': 'Messages',
  '/settings': 'Settings',
  '/profile': 'Profile',
}

export default function Layout() {
  useKeyboardShortcuts()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [signOutConfirm, setSignOutConfirm] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const profileDropdownRef = useRef<HTMLDivElement>(null)

  const pageTitle = routeTitles[location.pathname] ?? 'Surya Baru'

  const handleSignOut = () => {
    setSignOutConfirm(true)
  }

  const confirmSignOut = () => {
    // For a local-only app, this reloads the app to reset session state
    window.location.reload()
  }

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
        } bg-bg-0 border-r border-border-1 flex flex-col transition-all duration-200`}
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
                title={!sidebarExpanded ? item.name : undefined}
              >
                <Icon size={17} className="flex-shrink-0" />
                {sidebarExpanded && <span className="text-sm whitespace-nowrap">{item.name}</span>}
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
            title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarExpanded ? (
              <>
                <ChevronLeft size={17} className="flex-shrink-0" />
                <span className="text-sm">Collapse</span>
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
            title={!sidebarExpanded ? 'Profile' : undefined}
          >
            <div className="w-7 h-7 rounded-full bg-bg-3 border border-border-2 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-semibold text-fg-2">AD</span>
            </div>
            {sidebarExpanded && (
              <>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-sm font-medium text-fg-1 truncate">Admin User</p>
                  <p className="text-xs text-fg-3 truncate">Operator</p>
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
                Settings
              </button>
              <button
                onClick={() => {
                  navigate('/profile')
                  setProfileDropdownOpen(false)
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-fg-1 hover:bg-bg-3 transition-colors"
              >
                <User size={16} />
                View Profile
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
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Version Footer */}
        {sidebarExpanded && (
          <div className="p-4 border-t border-border-1">
            <p className="text-xs text-fg-3">v1.0.0 • 100% Offline</p>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar (DESIGN.md §3) */}
        <header className="h-14 bg-surface-page border-b border-border-1 flex items-center px-6 gap-4">
          <h2 className="font-display text-xl font-semibold tracking-tight text-fg-1 whitespace-nowrap">
            {pageTitle}
          </h2>

          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-[260px] h-[34px] flex items-center gap-2.5 px-3 bg-bg-0 border border-border-2 rounded-radius-sm text-fg-3 hover:border-border-3 transition-colors"
            >
              <Search size={16} className="flex-shrink-0" />
              <span className="text-sm truncate">Search plate, VIN, order…</span>
            </button>
            <IconButton label="Notifications">
              <Bell size={18} />
            </IconButton>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => navigate('/work-orders?new=1')}>
              New order
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-bg-1">
          <Outlet />
        </main>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Toasts (DESIGN.md §8) */}
      <ToastHost />

      {/* Sign Out Confirmation */}
      {signOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 backdrop-blur-[8px]"
            style={{ backgroundColor: 'var(--overlay-scrim)' }}
            onClick={() => setSignOutConfirm(false)}
          />
          <div className="relative bg-surface-card rounded-radius-lg p-6 w-full max-w-sm border border-border-2 shadow-lg">
            <h2 className="font-display text-lg font-semibold text-fg-1 mb-2">Sign Out</h2>
            <p className="text-fg-2 text-sm mb-6">
              Are you sure you want to sign out? This will reload the application.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setSignOutConfirm(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={confirmSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
