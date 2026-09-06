import { useState } from 'react'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useToastStore } from '../../store/toastStore'
import { parseServiceCsv, planServiceImport, isEmptyServicePlan, type ServiceImportPlan } from '../../lib/serviceImport'
import { applyServiceImport } from '../../lib/ops/serviceCatalogOps'
import { serviceItemTypeLabel } from '../../lib/entities'
import { formatCurrency } from '../../lib/currency'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'

/**
 * Preview-then-confirm for a services CSV — the Services counterpart to
 * ImportProductsDialog.tsx, same reasoning: nothing is written until the
 * shop has seen the counts. Parsing/planning is src/lib/serviceImport.ts;
 * applying is applyServiceImport.
 */
export function ImportServicesDialog({ plan, onClose }: { plan: ServiceImportPlan; onClose: () => void }) {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)
  const [updatePrices, setUpdatePrices] = useState(true)

  const handleImport = () => {
    const outcome = applyServiceImport(plan, { updatePrices })
    showToast({
      tone: 'success',
      title: t('settings.importServicesDoneTitle'),
      description: t('settings.importServicesDoneDescription', {
        created: outcome.created,
        updated: outcome.pricesUpdated,
      }),
    })
    onClose()
  }

  const nothingToDo = isEmptyServicePlan(plan)

  return (
    <Dialog open onClose={onClose} title={t('settings.importPreviewTitle')} size="lg">
      <div className="space-y-4">
        <ul className="space-y-1 text-sm text-text-secondary">
          <li className="text-text-primary font-medium">
            {t('settings.importServicesPreviewNew', { count: plan.create.length })}
          </li>
          <li>{t('settings.importServicesPreviewUpdates', { count: plan.updatePrice.length })}</li>
          <li>{t('settings.importPreviewUnchanged', { count: plan.unchanged })}</li>
          {plan.duplicatesInFile.length > 0 && (
            <li>{t('settings.importPreviewDuplicates', { count: plan.duplicatesInFile.length })}</li>
          )}
        </ul>

        {plan.newItemTypes.length > 0 && (
          <p className="text-caption text-accent">
            {t('settings.importServicesPreviewNewTags', { names: plan.newItemTypes.join(', ') })}
          </p>
        )}

        {plan.multipleCandidateTags.length > 0 && (
          <div>
            <p className="text-caption text-warning">{t('settings.importServicesMultiCandidateTitle')}</p>
            <ul className="mt-1 space-y-0.5 text-2xs text-fg-3">
              {plan.multipleCandidateTags.map((c) => (
                <li key={c.tagName}>
                  {t('settings.importServicesMultiCandidateLine', {
                    tag: serviceItemTypeLabel(c.tagName),
                    names: c.serviceNames.join(', '),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan.updatePrice.length > 0 && (
          <div>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                className="accent-accent"
                checked={updatePrices}
                onChange={(e) => setUpdatePrices(e.target.checked)}
              />
              {t('settings.importServicesUpdatePricesLabel')}
            </label>
            {/* Every price this would move, spelled out — same transparency
                as the product importer's price-change list. */}
            <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5 text-2xs text-fg-3 font-mono tabular-nums">
              {plan.updatePrice.map(({ service, from, to }) => (
                <li key={service.id}>
                  {t('settings.importPriceChangeLine', {
                    product: service.name,
                    from: formatCurrency(from),
                    to: formatCurrency(to),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan.errors.length > 0 && (
          <div>
            <p className="text-caption text-warning">{t('settings.importErrorsTitle')}</p>
            <ul className="mt-1 max-h-32 overflow-y-auto space-y-0.5 text-2xs text-fg-3">
              {plan.errors.map((err) => (
                <li key={err.line}>{t('settings.importErrorLine', { line: err.line, message: err.message })}</li>
              ))}
            </ul>
          </div>
        )}

        {nothingToDo && <p className="text-caption text-fg-3">{t('settings.importServicesNothingToDo')}</p>}
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
 * Read a CSV the user picks and turn it into a plan, or null when the file is
 * unreadable. Kept beside the dialog so the Settings page only holds the
 * "which file" state. Mirrors pickProductCsv in ImportProductsDialog.tsx.
 */
export function pickServiceCsv(onPlanned: (plan: ServiceImportPlan | null) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv,text/csv'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onerror = () => onPlanned(null)
    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text !== 'string') return onPlanned(null)

      const { rows, errors } = parseServiceCsv(text)
      if (rows.length === 0) return onPlanned(null)

      const plan = planServiceImport(
        rows,
        useServiceCatalogStore.getState().services,
        useServiceItemTypeStore.getState().serviceItemTypes.map((it) => ({ id: it.id, name: it.name }))
      )
      onPlanned({ ...plan, errors: [...errors, ...plan.errors] })
    }
    reader.readAsText(file)
  }
  input.click()
}
