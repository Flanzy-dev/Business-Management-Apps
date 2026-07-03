import { useState } from 'react'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useExpenseStore } from '../store/expenseStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkerStore } from '../store/workerStore'
import { useInventoryStore } from '../store/inventoryStore'
import { formatCurrency } from '../lib/currency'

type ReportType = 'sales' | 'pnl' | 'customers' | 'workers' | 'inventory'

export default function Reports() {
  const { workOrders } = useWorkOrderStore()
  const { expenses } = useExpenseStore()
  const { customers } = useCustomerStore()
  const { companies } = useCompanyStore()
  const { vehicles } = useVehicleStore()
  const { workers } = useWorkerStore()
  const { products, getLowStockProducts } = useInventoryStore()

  const [reportType, setReportType] = useState<ReportType>('sales')
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')

  const completedOrders = workOrders.filter(wo => wo.status === 'completed')

  // Date helpers
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const getStartDate = () => {
    switch (period) {
      case 'day': return startOfDay
      case 'week': return startOfWeek
      case 'month': return startOfMonth
      case 'year': return startOfYear
    }
  }

  const startDate = getStartDate()
  const periodOrders = completedOrders.filter(wo =>
    new Date(wo.completedAt || wo.createdAt) >= startDate
  )
  const periodExpenses = expenses.filter(e => new Date(e.date) >= startDate)

  // Sales metrics
  const totalRevenue = periodOrders.reduce((sum, wo) => sum + wo.total, 0)
  const totalServices = periodOrders.length
  const avgTicket = totalServices > 0 ? totalRevenue / totalServices : 0

  // P&L metrics
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0)
  const grossProfit = totalRevenue - totalExpenses

  // Group expenses by category
  const expensesByCategory = periodExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {} as Record<string, number>)

  // Customer metrics
  const getOwnerInfo = (vehicleId: string) => {
    const v = vehicles.find(x => x.id === vehicleId)
    if (!v) return { type: 'unknown', id: '', name: 'Unknown' }
    if (v.customerId) {
      const c = customers.find(x => x.id === v.customerId)
      return { type: 'customer', id: v.customerId, name: c?.name || 'Unknown' }
    }
    if (v.companyId) {
      const c = companies.find(x => x.id === v.companyId)
      return { type: 'company', id: v.companyId, name: c?.companyName || 'Unknown' }
    }
    return { type: 'unknown', id: '', name: 'No Owner' }
  }

  // Top customers by revenue
  const customerRevenue = completedOrders.reduce((acc, wo) => {
    const owner = getOwnerInfo(wo.vehicleId)
    const key = `${owner.type}:${owner.id}`
    if (!acc[key]) acc[key] = { ...owner, total: 0, orders: 0 }
    acc[key].total += wo.total
    acc[key].orders += 1
    return acc
  }, {} as Record<string, { type: string; id: string; name: string; total: number; orders: number }>)

  const topCustomers = Object.values(customerRevenue)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Worker metrics
  const workerStats = workers.map(w => {
    const workerOrders = periodOrders.filter(wo => wo.workerId === w.id)
    return {
      ...w,
      services: workerOrders.length,
      revenue: workerOrders.reduce((sum, wo) => sum + wo.total, 0),
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // Inventory metrics
  const lowStock = getLowStockProducts()
  const inventoryValue = products.reduce((sum, p) => sum + (p.costPrice * p.qtyOnHand), 0)

  const periodLabel = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
  }[period]

  return (
    <div className="p-6">
      <h1 className="text-page-title text-text-primary mb-6">Reports</h1>

      {/* Report Type Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([
          { key: 'sales', label: 'Sales' },
          { key: 'pnl', label: 'Profit & Loss' },
          { key: 'customers', label: 'Customers' },
          { key: 'workers', label: 'Workers' },
          { key: 'inventory', label: 'Inventory' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setReportType(tab.key)}
            className={`px-4 py-2 rounded-radius-sm transition-colors ${
              reportType === tab.key
                ? 'bg-accent text-surface-canvas'
                : 'bg-surface-sunken text-text-secondary hover:text-text-primary border border-border-subtle'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Period Filter (for sales, pnl, workers) */}
      {['sales', 'pnl', 'workers'].includes(reportType) && (
        <div className="flex gap-2 mb-6">
          {(['day', 'week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-radius-sm transition-colors ${
                period === p ? 'bg-accent/20 text-accent' : 'bg-surface-sunken text-text-secondary hover:text-text-primary'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Sales Report */}
      {reportType === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">{periodLabel} Revenue</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">Services Completed</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{totalServices}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">Avg Ticket</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{formatCurrency(avgTicket)}</p>
            </div>
          </div>

          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">Recent Orders</h2>
            {periodOrders.length === 0 ? (
              <p className="text-text-secondary text-center py-4">No orders in this period.</p>
            ) : (
              <div className="space-y-2">
                {periodOrders.slice(0, 10).map(wo => (
                  <div key={wo.id} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                    <div>
                      <span className="font-mono text-sm text-text-primary">#{wo.orderNumber}</span>
                      <span className="ml-3 text-text-primary">{getOwnerInfo(wo.vehicleId).name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-text-primary tabular-nums">{formatCurrency(wo.total)}</span>
                      <span className="ml-3 text-caption tabular-nums">
                        {new Date(wo.completedAt || wo.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* P&L Report */}
      {reportType === 'pnl' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">Revenue</p>
              <p className="text-3xl font-bold text-accent tabular-nums">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">Expenses</p>
              <p className="text-3xl font-bold text-danger tabular-nums">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">Net Profit</p>
              <p className={`text-3xl font-bold tabular-nums ${grossProfit >= 0 ? 'text-accent' : 'text-danger'}`}>
                {formatCurrency(grossProfit)}
              </p>
            </div>
          </div>

          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">Expenses by Category</h2>
            {Object.keys(expensesByCategory).length === 0 ? (
              <p className="text-text-secondary text-center py-4">No expenses in this period.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(expensesByCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => (
                    <div key={cat} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                      <span className="text-text-primary">{cat}</span>
                      <span className="font-medium text-text-primary tabular-nums">{formatCurrency(amount)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customers Report */}
      {reportType === 'customers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">Total Customers</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{customers.length}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">Company Accounts</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{companies.length}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">Total Vehicles</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{vehicles.length}</p>
            </div>
          </div>

          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">Top Customers by Revenue (All Time)</h2>
            {topCustomers.length === 0 ? (
              <p className="text-text-secondary text-center py-4">No customer data yet.</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map((c, i) => (
                  <div key={`${c.type}:${c.id}`} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                    <div>
                      <span className="text-text-secondary mr-2">#{i + 1}</span>
                      <span className="font-medium text-text-primary">{c.name}</span>
                      {c.type === 'company' && (
                        <span className="ml-2 text-xs bg-info/20 text-info px-2 py-0.5 rounded-radius-full">Fleet</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-text-primary tabular-nums">{formatCurrency(c.total)}</span>
                      <span className="ml-3 text-text-secondary text-sm tabular-nums">{c.orders} orders</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workers Report */}
      {reportType === 'workers' && (
        <div className="space-y-6">
          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">Worker Performance ({periodLabel})</h2>
            {workerStats.length === 0 ? (
              <p className="text-text-secondary text-center py-4">No workers added yet.</p>
            ) : (
              <div className="space-y-2">
                {workerStats.map((w, i) => (
                  <div key={w.id} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-text-secondary">#{i + 1}</span>
                      <div>
                        <span className="font-medium text-text-primary">{w.name}</span>
                        {!w.isActive && (
                          <span className="ml-2 text-xs bg-surface-canvas text-text-secondary px-2 py-0.5 rounded-radius-full">Inactive</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-text-primary tabular-nums">{formatCurrency(w.revenue)}</span>
                      <span className="ml-3 text-text-secondary text-sm tabular-nums">{w.services} services</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inventory Report */}
      {reportType === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">Total Products</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{products.length}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">Inventory Value (Cost)</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{formatCurrency(inventoryValue)}</p>
            </div>
            <div className={`bg-surface-card rounded-radius-md p-4 ${lowStock.length > 0 ? 'border-l-4 border-warning' : ''}`}>
              <p className="text-caption">Low Stock Items</p>
              <p className={`text-3xl font-bold tabular-nums ${lowStock.length > 0 ? 'text-warning' : 'text-text-primary'}`}>
                {lowStock.length}
              </p>
            </div>
          </div>

          {lowStock.length > 0 && (
            <div className="bg-warning/10 rounded-radius-md p-6 border border-warning/30">
              <h2 className="text-card-title text-warning mb-4">Low Stock Items</h2>
              <div className="space-y-2">
                {lowStock.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-surface-card rounded-radius-sm">
                    <div>
                      <span className="font-medium text-text-primary">{p.name}</span>
                      <span className="ml-2 text-text-secondary text-sm">{p.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-warning font-bold tabular-nums">{p.qtyOnHand}</span>
                      <span className="text-text-secondary text-sm ml-1">/ {p.reorderPoint} {p.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">All Products by Value</h2>
            {products.length === 0 ? (
              <p className="text-text-secondary text-center py-4">No products yet.</p>
            ) : (
              <div className="space-y-2">
                {[...products]
                  .sort((a, b) => (b.costPrice * b.qtyOnHand) - (a.costPrice * a.qtyOnHand))
                  .slice(0, 10)
                  .map(p => (
                    <div key={p.id} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                      <div>
                        <span className="font-medium text-text-primary">{p.name}</span>
                        <span className="ml-2 text-text-secondary text-sm">{p.qtyOnHand} {p.unit}</span>
                      </div>
                      <span className="font-medium text-text-primary tabular-nums">{formatCurrency(p.costPrice * p.qtyOnHand)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
