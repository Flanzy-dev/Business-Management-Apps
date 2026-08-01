import { useState } from 'react'
import { WorkOrderList } from '../components/workOrders/WorkOrderList'
import { WorkOrderEditor } from '../components/workOrders/WorkOrderEditor'
import { NewWorkOrderDialog } from '../components/workOrders/NewWorkOrderDialog'

export default function WorkOrders() {
  const [editingId, setEditingId] = useState<string | null>(null)

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
