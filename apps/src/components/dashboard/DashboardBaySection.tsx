import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBayStore } from '../../store/bayStore'
import { useWorkerStore } from '../../store/workerStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useTranslation } from '../../lib/i18n'
import { vehicleLabel } from '../../lib/format/entities'
import { buildBayStatusBoard } from '../../lib/reports/dashboardMetrics'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { BayStatusBoard } from './BayStatusBoard'
import { openRecordState } from '../../lib/app/navigation'

/**
 * Dashboard's bay board: one tile per bay, with the car and technician on it.
 *
 * This used to be five cards — a capacity gauge, this board, a technician
 * queue, the service mix and a throughput chart. The gauge and the queue
 * repeated what the hero and these tiles already show (bays in use; who is
 * on which bay), and the mix and throughput are analysis, so they moved to
 * Reports > Overview. The separate Bays page, which only showed this same
 * board, is gone too; a tile now opens the order occupying that bay.
 */
export function DashboardBaySection() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const bays = useBayStore((s) => s.bays)
  const workers = useWorkerStore((s) => s.workers)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const vehicles = useVehicleStore((s) => s.vehicles)

  // Lookup maps built once per store change, so buildBayStatusBoard does
  // O(1) key lookups instead of repeated O(n) .find() scans.
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])
  const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers])
  const workOrderById = useMemo(() => new Map(workOrders.map((wo) => [wo.id, wo])), [workOrders])
  const bayStatusData = useMemo(
    () =>
      buildBayStatusBoard(bays, {
        workOrderById,
        vehicleLabelOf: (vehicleId: string) => {
          const v = vehicleById.get(vehicleId)
          return v ? vehicleLabel(v) : undefined
        },
        workerById,
      }),
    [bays, workOrderById, vehicleById, workerById]
  )

  const openBayOrder = (bayId: string) => {
    const orderId = bays.find((b) => b.id === bayId)?.currentWorkOrderId
    if (orderId) navigate('/work-orders', { state: openRecordState(orderId) })
  }

  if (bays.length === 0) return null

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('dashboard.bayStatus')}</CardTitle>
      </CardHeader>
      <CardContent>
        <BayStatusBoard bays={bayStatusData} compact onSelectBay={openBayOrder} />
      </CardContent>
    </Card>
  )
}
