import { useState, useEffect } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { useThemeStore } from '../store/themeStore'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'

export default function Settings() {
  const { settings, updateSettings } = useSettingsStore()
  const { theme, setTheme } = useThemeStore()

  const [shopName, setShopName] = useState(settings.shopName)
  const [shopAddress, setShopAddress] = useState(settings.shopAddress)
  const [shopPhone, setShopPhone] = useState(settings.shopPhone)
  const [shopEmail, setShopEmail] = useState(settings.shopEmail)
  const [taxRate, setTaxRate] = useState(settings.taxRate.toString())
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setShopName(settings.shopName)
    setShopAddress(settings.shopAddress)
    setShopPhone(settings.shopPhone)
    setShopEmail(settings.shopEmail)
    setTaxRate(settings.taxRate.toString())
    setReceiptFooter(settings.receiptFooter)
  }, [settings])

  const handleSave = () => {
    updateSettings({
      shopName,
      shopAddress,
      shopPhone,
      shopEmail,
      taxRate: parseFloat(taxRate) || 0,
      receiptFooter,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleBackup = () => {
    const allData = {
      customers: localStorage.getItem('customer-store'),
      companies: localStorage.getItem('company-store'),
      vehicles: localStorage.getItem('vehicle-store'),
      workers: localStorage.getItem('worker-store'),
      workOrders: localStorage.getItem('work-order-store'),
      inventory: localStorage.getItem('inventory-store'),
      suppliers: localStorage.getItem('supplier-store'),
      expenses: localStorage.getItem('expense-store'),
      settings: localStorage.getItem('settings-store'),
    }

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oil-shop-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleRestore = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string)

          if (confirm('This will replace all current data. Are you sure?')) {
            if (data.customers) localStorage.setItem('customer-store', data.customers)
            if (data.companies) localStorage.setItem('company-store', data.companies)
            if (data.vehicles) localStorage.setItem('vehicle-store', data.vehicles)
            if (data.workers) localStorage.setItem('worker-store', data.workers)
            if (data.workOrders) localStorage.setItem('work-order-store', data.workOrders)
            if (data.inventory) localStorage.setItem('inventory-store', data.inventory)
            if (data.suppliers) localStorage.setItem('supplier-store', data.suppliers)
            if (data.expenses) localStorage.setItem('expense-store', data.expenses)
            if (data.settings) localStorage.setItem('settings-store', data.settings)

            alert('Data restored successfully! The page will now reload.')
            window.location.reload()
          }
        } catch {
          alert('Invalid backup file')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleClearData = () => {
    if (confirm('This will DELETE ALL DATA. This cannot be undone. Are you sure?')) {
      if (confirm('FINAL WARNING: All customers, vehicles, work orders, and inventory will be permanently deleted. Continue?')) {
        localStorage.clear()
        alert('All data cleared. The page will now reload.')
        window.location.reload()
      }
    }
  }

  const inputClass = "w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-tile text-text-primary focus:outline-none focus:border-accent-mint"
  const labelClass = "block text-sm text-text-secondary mb-1"

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-page-title text-text-primary mb-6">Settings</h1>

      {/* Theme Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <p className="text-caption">Choose your preferred theme. Light mode is optimized for bay-mounted tablets.</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-2 px-4 py-3 rounded-tile border transition-colors ${
                theme === 'dark'
                  ? 'border-accent-mint bg-accent-mint/20 text-accent-mint'
                  : 'border-border-subtle text-text-secondary hover:text-text-primary hover:border-accent-mint/50'
              }`}
            >
              <Moon size={18} />
              <span>Dark</span>
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-2 px-4 py-3 rounded-tile border transition-colors ${
                theme === 'light'
                  ? 'border-accent-mint bg-accent-mint/20 text-accent-mint'
                  : 'border-border-subtle text-text-secondary hover:text-text-primary hover:border-accent-mint/50'
              }`}
            >
              <Sun size={18} />
              <span>Light</span>
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`flex items-center gap-2 px-4 py-3 rounded-tile border transition-colors ${
                theme === 'system'
                  ? 'border-accent-mint bg-accent-mint/20 text-accent-mint'
                  : 'border-border-subtle text-text-secondary hover:text-text-primary hover:border-accent-mint/50'
              }`}
            >
              <Monitor size={18} />
              <span>System</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Shop Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Shop Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Shop Name</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  type="tel"
                  value={shopPhone}
                  onChange={(e) => setShopPhone(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Address</label>
              <input
                type="text"
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                placeholder="123 Main St, City, State 12345"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={shopEmail}
                  onChange={(e) => setShopEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Default Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Receipt Footer Text</label>
              <textarea
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                rows={2}
                placeholder="Thank you for your business!"
                className={inputClass}
              />
            </div>

            <button
              onClick={handleSave}
              className="bg-accent-mint text-surface-canvas px-4 py-2 rounded-tile hover:opacity-90 transition-opacity font-medium"
            >
              {saved ? '✓ Saved!' : 'Save Settings'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Data Backup */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Data Backup & Restore</CardTitle>
          <p className="text-caption">Your data is stored locally in your browser. Regular backups are recommended.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleBackup}
              className="bg-accent-mint text-surface-canvas px-4 py-2 rounded-tile hover:opacity-90 transition-opacity font-medium"
            >
              Download Backup
            </button>
            <button
              onClick={handleRestore}
              className="bg-accent-amber text-surface-canvas px-4 py-2 rounded-tile hover:opacity-90 transition-opacity font-medium"
            >
              Restore from Backup
            </button>
          </div>
          <p className="text-caption mt-4">
            Backup files are JSON exports that can be restored on any device.
          </p>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Keyboard Shortcuts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between p-2 bg-surface-sunken rounded-tile">
              <span className="text-text-primary">New Work Order</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + N</kbd>
            </div>
            <div className="flex justify-between p-2 bg-surface-sunken rounded-tile">
              <span className="text-text-primary">Go to Dashboard</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + D</kbd>
            </div>
            <div className="flex justify-between p-2 bg-surface-sunken rounded-tile">
              <span className="text-text-primary">Search / Quick Find</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + K</kbd>
            </div>
            <div className="flex justify-between p-2 bg-surface-sunken rounded-tile">
              <span className="text-text-primary">Go to Customers</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + 1</kbd>
            </div>
            <div className="flex justify-between p-2 bg-surface-sunken rounded-tile">
              <span className="text-text-primary">Go to Vehicles</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + 2</kbd>
            </div>
            <div className="flex justify-between p-2 bg-surface-sunken rounded-tile">
              <span className="text-text-primary">Go to Work Orders</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + 3</kbd>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-l-4 border-accent-critical">
        <CardHeader>
          <CardTitle className="text-accent-critical">Danger Zone</CardTitle>
          <p className="text-caption">This will permanently delete all data. Make sure to create a backup first.</p>
        </CardHeader>
        <CardContent>
          <button
            onClick={handleClearData}
            className="bg-accent-critical text-white px-4 py-2 rounded-tile hover:opacity-90 transition-opacity font-medium"
          >
            Clear All Data
          </button>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-text-secondary text-sm space-y-1">
            <p><strong className="text-text-primary">OilDesk — Shop Management</strong></p>
            <p>Version 1.0.0</p>
            <p>100% Offline — Your data stays on your device</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
