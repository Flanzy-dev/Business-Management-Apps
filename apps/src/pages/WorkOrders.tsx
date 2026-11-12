import { useState } from 'react'
import { WorkOrderList } from '../components/workOrders/WorkOrderList'
import { WorkOrderEditor } from '../components/workOrders/WorkOrderEditor'
import { NewWorkOrderDialog } from '../components/workOrders/NewWorkOrderDialog'
import { useOpenRecordFromNav } from '../hooks/useOpenRecordFromNav'

export default function WorkOrders() {
  // Global search and the Dashboard's order cards and bay tiles link here
  // with the order to open (src/lib/app/navigation.ts).
  const [editingId, setEditingId] = useState<string | null>(null)
  useOpenRecordFromNav(setEditingId)

  return (
    <>
      {editingId ? (
        <WorkOrderEditor orderId={editingId} onBack={() => setEditingId(null)} />
      ) : (
        <WorkOrderList onEdit={setEditingId} />
      )}
      <NewWorkOrderDialog onCreated={setEditingId} />
    </>
  )
}
