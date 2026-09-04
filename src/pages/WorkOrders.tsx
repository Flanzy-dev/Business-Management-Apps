import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { WorkOrderList } from '../components/workOrders/WorkOrderList'
import { WorkOrderEditor } from '../components/workOrders/WorkOrderEditor'
import { NewWorkOrderDialog } from '../components/workOrders/NewWorkOrderDialog'

export default function WorkOrders() {
  // The Dashboard's Open Work Orders card links here with the order to open in
  // location state (the app's only navigate-with-state). Seed the editor from
  // it once, then wipe the state so a later Back/Forward to this history entry
  // doesn't resurrect the editor.
  const location = useLocation()
  const navigate = useNavigate()
  const [editingId, setEditingId] = useState<string | null>(
    () => (location.state as { editingId?: string } | null)?.editingId ?? null,
  )
  useEffect(() => {
    if ((location.state as { editingId?: string } | null)?.editingId) {
      navigate(location.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
