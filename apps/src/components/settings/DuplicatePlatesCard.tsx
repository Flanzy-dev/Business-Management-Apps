import { useVehicleStore } from '../../store/vehicleStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useToastStore, useConfirmStore } from '../../store/uiStores'
import { duplicatePlateGroups } from '../../lib/vehicles/vehicleIdentity'
import { chooseSurvivor } from '../../lib/vehicles/vehicleReferences'
import { mergeVehicles, mergeAllDuplicatePlates } from '../../lib/ops/vehicleMergeOps'
import { ownerName } from '../../lib/format/entities'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'

/**
 * Vehicles sharing a plate (src/lib/vehicles/vehicleIdentity.ts), each group merged
 * into the vehicle its latest visit was on (src/lib/vehicles/vehicleReferences.ts's
 * chooseSurvivor). Everything the decision needs is shown per group — who
 * owns each copy and how many orders it carries — because a merge moves
 * orders between owners and there is no un-merge.
 */
export function DuplicatePlatesCard() {
  const { t } = useTranslation()
  const vehicles = useVehicleStore((s) => s.vehicles)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const customers = useCustomerStore((s) => s.customers)
  const companies = useCompanyStore((s) => s.companies)
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)

  const groups = duplicatePlateGroups(vehicles).map((group) => ({
    group,
    survivor: chooseSurvivor(group, workOrders),
  }))
  const orderCount = (vehicleId: string) => workOrders.filter((wo) => wo.vehicleId === vehicleId).length

  // Asks first, like mergeAll: a merge moves orders between owners and has no
  // undo, and this button sits in a scrolling list where a stray tap is easy.
  const mergeOne = (survivorId: string, loserIds: string[], plate: string) => {
    requestConfirm(
      {
        title: t('settings.duplicatePlatesConfirmOneTitle'),
        message: t('settings.duplicatePlatesConfirmOneMessage', { plate }),
      },
      () => {
        mergeVehicles(survivorId, loserIds)
        showToast({ tone: 'success', title: t('settings.duplicatePlatesMergedOne') })
      }
    )
  }

  const mergeAll = () => {
    requestConfirm(
      {
        title: t('settings.duplicatePlatesConfirmTitle'),
        message: t('settings.duplicatePlatesConfirmMessage', { count: groups.length }),
      },
      () => {
        const outcome = mergeAllDuplicatePlates()
        showToast({
          tone: 'success',
          title: t('settings.duplicatePlatesMergedAll', { groups: outcome.groups, removed: outcome.vehiclesRemoved }),
        })
      }
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.duplicatePlatesTitle')}</CardTitle>
        <p className="text-caption">{t('settings.duplicatePlatesDescription')}</p>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-caption text-fg-3">{t('settings.duplicatePlatesNone')}</p>
        ) : (
          <div className="space-y-4">
            <Button variant="secondary" onClick={mergeAll}>
              {t('settings.duplicatePlatesMergeAll', { count: groups.length })}
            </Button>
            <ul className="max-h-80 overflow-y-auto space-y-3">
              {groups.map(({ group, survivor }) => (
                <li key={survivor.id} className="rounded-radius-md border border-border-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-text-primary">{survivor.licensePlate}</span>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        mergeOne(survivor.id, group.filter((v) => v.id !== survivor.id).map((v) => v.id), survivor.licensePlate)
                      }
                    >
                      {t('settings.duplicatePlatesMerge')}
                    </Button>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-2xs text-fg-3">
                    {group.map((v) => (
                      <li key={v.id} className={v.id === survivor.id ? 'text-accent' : undefined}>
                        {t('settings.duplicatePlatesLine', {
                          owner: ownerName(v, customers, companies),
                          orders: orderCount(v.id),
                        })}
                        {v.id === survivor.id && ` — ${t('settings.duplicatePlatesKeeps')}`}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
