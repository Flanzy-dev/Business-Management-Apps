import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { runCostingBackfill } from './lib/ops/costingBackfill'
import { runStockLedgerBackfill } from './lib/ops/stockLedgerBackfill'
import { startSync } from './lib/sync/engine'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import WorkOrders from './pages/WorkOrders'
import Customers from './pages/Customers'
import Companies from './pages/Companies'
import Vehicles from './pages/Vehicles'
import Reminders from './pages/Reminders'
import Technicians from './pages/Technicians'
import Inventory from './pages/Inventory'
import Suppliers from './pages/Suppliers'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Appointments from './pages/Appointments'
import Bays from './pages/Bays'
import ServiceHistory from './pages/ServiceHistory'
import Messages from './pages/Messages'
import Profile from './pages/Profile'

function App() {
  // Two one-time migrations for shops whose data predates them, each a no-op
  // on every launch after the first: give existing sales a frozen cost, then
  // give the stock ledger a starting point matching what the old stored
  // qtyOnHand/qtyRemaining counters said (see src/lib/ops/stockLedgerBackfill.ts
  // for why order doesn't actually matter between them, but this reads top to
  // bottom in the order the app historically gained these features).
  useEffect(() => {
    runCostingBackfill()
    runStockLedgerBackfill()
    // Multi-device sync (src/lib/sync/engine.ts): safe to start unconditionally
    // — with no LAN server reachable (plain `npm run dev`, or WiFi down) this
    // just settles into 'offline' status and the app works exactly as before.
    startSync()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="work-orders" element={<WorkOrders />} />
        <Route path="bays" element={<Bays />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="service-history" element={<ServiceHistory />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="customers" element={<Customers />} />
        <Route path="companies" element={<Companies />} />
        <Route path="technicians" element={<Technicians />} />
        <Route path="workers" element={<Technicians />} /> {/* Alias for backwards compat */}
        <Route path="inventory" element={<Inventory />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="reports" element={<Reports />} />
        <Route path="messages" element={<Messages />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  )
}

export default App
