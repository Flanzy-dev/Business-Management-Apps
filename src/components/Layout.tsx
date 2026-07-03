import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import GlobalSearch from './GlobalSearch'

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Appointments', path: '/appointments', icon: Calendar },
  { name: 'Work Orders', path: '/work-orders', icon: ClipboardList },
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

export default function Layout() {
  useKeyboardShortcuts()
  const navigate = useNavigate()
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [signOutConfirm, setSignOutConfirm] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const profileDropdownRef = useRef<HTMLDivElement>(null)

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
    <div className="flex h-screen bg-surface-canvas">
      {/* Collapsible Sidebar */}
      <aside
        className={`${
          sidebarExpanded ? 'w-56' : 'w-16'
        } bg-surface-canvas border-r border-border-subtle flex flex-col transition-all duration-200`}
      >
        {/* Header — plain-type wordmark, no logo mark (DESIGN.md §3/§7) */}
        <div className={`p-4 border-b border-border-subtle flex items-center ${sidebarExpanded ? 'gap-3' : 'justify-center'}`}>
          {sidebarExpanded ? (
            <h1 className="font-display font-semibold text-[15px] tracking-wide text-fg-1 whitespace-nowrap overflow-hidden">
              SURYA<span className="text-accent">BARU</span>
            </h1>
          ) : (
            <span className="font-display font-semibold text-[15px] tracking-wide text-accent">SB</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navigation.map((item, index) => {
            if ('divider' in item) {
              return <div key={index} className="h-px bg-border-subtle my-2" />
            }
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-tile transition-colors ${
                    sidebarExpanded ? '' : 'justify-center'
                  } ${
                    isActive
                      ? 'bg-accent-mint/20 text-accent-mint'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-card'
                  }`
                }
                title={!sidebarExpanded ? item.name : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarExpanded && <span className="text-sm whitespace-nowrap">{item.name}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Collapse/Expand Button */}
        <div className="p-2 border-t border-border-subtle">
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-tile text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors ${
              sidebarExpanded ? '' : 'justify-center'
            }`}
            title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarExpanded ? (
              <>
                <ChevronLeft size={20} className="flex-shrink-0" />
                <span className="text-sm">Collapse</span>
              </>
            ) : (
              <ChevronRight size={20} />
            )}
          </button>
        </div>

        {/* Profile Dropdown */}
        <div className="p-2 border-t border-border-subtle relative">
          <button
            ref={profileButtonRef}
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-tile text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors ${
              sidebarExpanded ? '' : 'justify-center'
            }`}
            title={!sidebarExpanded ? 'Profile' : undefined}
          >
            <div className="w-8 h-8 rounded-full bg-accent-mint/20 flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-accent-mint" />
            </div>
            {sidebarExpanded && (
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-medium text-text-primary truncate">Admin User</p>
                <p className="text-xs text-text-secondary truncate">admin@suryabaru.local</p>
              </div>
            )}
          </button>

          {profileDropdownOpen && (
            <div
              ref={profileDropdownRef}
              className="absolute bottom-full left-2 right-2 mb-1 bg-surface-card border border-border-subtle rounded-tile shadow-lg py-1"
            >
              <button
                onClick={() => {
                  navigate('/settings')
                  setProfileDropdownOpen(false)
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-text-primary hover:bg-surface-sunken transition-colors"
              >
                <Settings size={16} />
                Settings
              </button>
              <button
                onClick={() => {
                  navigate('/profile')
                  setProfileDropdownOpen(false)
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-text-primary hover:bg-surface-sunken transition-colors"
              >
                <User size={16} />
                View Profile
              </button>
              <div className="h-px bg-border-subtle my-1" />
              <button
                onClick={() => {
                  handleSignOut()
                  setProfileDropdownOpen(false)
                }}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-accent-critical hover:bg-accent-critical/10 transition-colors"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Version Footer */}
        {sidebarExpanded && (
          <div className="p-4 border-t border-border-subtle">
            <p className="text-caption">v1.0.0 • 100% Offline</p>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Search */}
        <header className="h-16 bg-surface-card border-b border-border-subtle flex items-center px-6 gap-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex-1 max-w-xl flex items-center gap-3 px-4 py-2 bg-surface-sunken border border-border-subtle rounded-tile text-text-secondary hover:border-accent-mint/50 transition-colors"
          >
            <Search size={18} />
            <span className="text-sm">Search plate, VIN, customer, or RO#...</span>
            <kbd className="ml-auto text-xs bg-surface-card px-2 py-0.5 rounded border border-border-subtle">
              Ctrl+K
            </kbd>
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-surface-canvas">
          <Outlet />
        </main>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Sign Out Confirmation Modal */}
      {signOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSignOutConfirm(false)}
          />
          <div className="relative bg-surface-card rounded-card p-6 w-full max-w-sm border border-border-subtle">
            <h2 className="text-lg font-semibold text-text-primary mb-2">Sign Out</h2>
            <p className="text-text-secondary text-sm mb-6">
              Are you sure you want to sign out? This will reload the application.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSignOutConfirm(false)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSignOut}
                className="px-4 py-2 text-sm bg-accent-critical text-white rounded-tile hover:opacity-90 transition-opacity"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
