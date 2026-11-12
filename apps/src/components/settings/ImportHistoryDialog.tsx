import { useCustomerStore } from '../../store/customerStore'
import { CSV_ACCEPT, pickTextFile } from '../../lib/app/files'
import { useCompanyStore } from '../../store/companyStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useToastStore } from '../../store/uiStores'
import {
  parseCustomerHistoryCsv,
  planCustomerHistoryImport,
  planTotals,
  isEmptyHistoryPlan,
  type CustomerHistoryPlan,
} from '../../lib/customers/customerHistoryImport'
import { applyCustomerHistoryImport } from '../../lib/ops/customerHistoryImportOps'
import { formatCurrency } from '../../lib/format/numbers'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'

/**
 * Preview-then-confirm for the Excel-history CSV
 * (scripts/convert-pelanggan-xlsx.mjs). Same shape as ImportProductsDialog:
 * nothing is written until the shop has seen the counts — this one creates
 * a few thousand records and books years of past revenue, and there is no
 * undo for that short of restoring a backup.
 */
export function ImportHistoryDialog({ plan, onClose }: { plan: CustomerHistoryPlan; onClose: () => void }) {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)
  const totals = planTotals(plan)
  const nothingToDo = isEmptyHistoryPlan(plan)

  const handleImport = () => {
    const outcome = applyCustomerHistoryImport(plan)
    showToast({
      tone: 'success',
      title: t('customers.importDoneTitle'),
      description: t('customers.importDoneDescription', { ...outcome }),
    })
    onClose()
  }

  return (
    <Dialog open onClose={onClose} title={t('customers.importPreviewTitle')} size="lg">
      <div className="space-y-4">
        <ul className="space-y-1 text-sm text-text-secondary">
          <li className="text-text-primary font-medium">{t('customers.importPreviewCustomers', { count: totals.customers })}</li>
          <li className="text-text-primary font-medium">{t('customers.importPreviewCompanies', { count: totals.companies })}</li>
          <li>{t('customers.importPreviewVehicles', { count: totals.vehicles })}</li>
          <li>{t('customers.importPreviewOrders', { count: totals.orders, total: formatCurrency(totals.revenue) })}</li>
          {plan.skippedOwners.length > 0 && (
            <li>{t('customers.importPreviewSkipped', { count: plan.skippedOwners.length })}</li>
          )}
        </ul>

        {!nothingToDo && <p className="text-caption text-fg-3">{t('customers.importPreviewNoStock')}</p>}

        {(plan.rowsNeedingReview > 0 || plan.datesEstimated > 0) && (
          <div className="space-y-1 text-caption text-warning">
            {plan.rowsNeedingReview > 0 && <p>{t('customers.importPreviewReview', { count: plan.rowsNeedingReview })}</p>}
            {plan.datesEstimated > 0 && <p>{t('customers.importPreviewDatesEstimated', { count: plan.datesEstimated })}</p>}
          </div>
        )}

        {plan.sharedPlates.length > 0 && (
          <p className="text-caption text-accent">
            {t('customers.importPreviewSharedPlates', { count: plan.sharedPlates.length, plates: plan.sharedPlates.join(', ') })}
          </p>
        )}

        {plan.attachedToExisting.length > 0 && (
          <p className="text-caption text-accent">
            {t('customers.importPreviewPlatesInApp', { plates: plan.attachedToExisting.join(', ') })}
          </p>
        )}

        {/* Every owner this creates, by name — the one list worth scanning
            before committing a few thousand records. */}
        {!nothingToDo && (
          <ul className="max-h-48 overflow-y-auto space-y-0.5 text-2xs text-fg-3 font-mono tabular-nums">
            {plan.create.map((owner) => (
              <li key={owner.sourceFile || owner.name}>
                {t('customers.importPreviewOwnerLine', {
                  name: owner.phone ? `${owner.name} (${owner.phone})` : owner.name,
                  vehicles: owner.vehicles.length,
                  visits: owner.vehicles.reduce((n, v) => n + v.visits.length, 0),
                })}
              </li>
            ))}
          </ul>
        )}

        {plan.errors.length > 0 && (
          <div>
            <p className="text-caption text-warning">{t('settings.importErrorsTitle')}</p>
            <ul className="mt-1 max-h-32 overflow-y-auto space-y-0.5 text-2xs text-fg-3">
              {plan.errors.map((err, i) => (
                <li key={`${err.line}-${i}`}>{t('settings.importErrorLine', { line: err.line, message: err.message })}</li>
              ))}
            </ul>
          </div>
        )}

        {nothingToDo && <p className="text-caption text-fg-3">{t('customers.importNothingToDo')}</p>}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleImport} disabled={nothingToDo}>
          {t('settings.importButton')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

/**
 * Read the CSV the user picks and plan it against the shop's current
 * customers, companies and plates; null when the file is unreadable or isn't
 * the converter's output. Mirrors pickProductCsv in ImportProductsDialog.tsx.
 */
export function pickHistoryCsv(onPlanned: (plan: CustomerHistoryPlan | null) => void): void {
  pickTextFile(CSV_ACCEPT, (text) => {
    if (text === null) return onPlanned(null)

    const { rows, errors } = parseCustomerHistoryCsv(text)
    if (rows.length === 0) return onPlanned(null)

    const plan = planCustomerHistoryImport(rows, {
      ownerNames: [
        ...useCustomerStore.getState().customers.map((c) => c.name),
        ...useCompanyStore.getState().companies.map((c) => c.companyName),
      ],
      vehicles: useVehicleStore.getState().vehicles,
    })
    onPlanned({ ...plan, errors: [...errors, ...plan.errors] })
  })
}
