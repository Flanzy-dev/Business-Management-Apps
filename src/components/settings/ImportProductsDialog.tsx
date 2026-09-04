import { useState } from 'react'
import { useInventoryStore } from '../../store/inventoryStore'
import { useProductCategoryStore } from '../../store/productCategoryStore'
import { useSupplierStore } from '../../store/supplierStore'
import { useToastStore } from '../../store/toastStore'
import { parseProductCsv, planProductImport, isEmptyPlan, type ImportPlan } from '../../lib/productImport'
import { applyProductImport } from '../../lib/ops/productCatalogOps'
import { productCategoryLabel } from '../../lib/entities'
import { formatCurrency } from '../../lib/currency'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'

/**
 * Preview-then-confirm for a price-list CSV. Nothing is written until the
 * shop has seen the counts — a supplier's sheet can carry hundreds of rows,
 * and "it added 500 products I didn't want" is not something an undo exists
 * for. Parsing/planning is src/lib/productImport.ts; applying is
 * applyProductImport.
 */
export function ImportProductsDialog({ plan, onClose }: { plan: ImportPlan; onClose: () => void }) {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)
  const [updatePrices, setUpdatePrices] = useState(true)

  const handleImport = () => {
    const outcome = applyProductImport(plan, { updatePrices })
    showToast({
      tone: 'success',
      title: t('settings.importDoneTitle'),
      description: t('settings.importDoneDescription', {
        created: outcome.created,
        updated: outcome.pricesUpdated,
      }),
    })
    onClose()
  }

  const nothingToDo = isEmptyPlan(plan)

  return (
    <Dialog open onClose={onClose} title={t('settings.importPreviewTitle')} size="lg">
      <div className="space-y-4">
        <ul className="space-y-1 text-sm text-text-secondary">
          <li className="text-text-primary font-medium">
            {t('settings.importPreviewNew', { count: plan.create.length })}
          </li>
          <li>{t('settings.importPreviewUpdates', { count: plan.updatePrice.length })}</li>
          <li>{t('settings.importPreviewUnchanged', { count: plan.unchanged })}</li>
          {plan.duplicatesInFile.length > 0 && (
            <li>{t('settings.importPreviewDuplicates', { count: plan.duplicatesInFile.length })}</li>
          )}
        </ul>

        {plan.newCategories.length > 0 && (
          <p className="text-caption text-accent">
            {t('settings.importPreviewNewCategories', {
              names: plan.newCategories.map(productCategoryLabel).join(', '),
            })}
          </p>
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
              {t('settings.importUpdatePricesLabel')}
            </label>
            {/* Every price this would move, spelled out — a price change is
                the one part of an import that touches what a customer pays. */}
            <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5 text-2xs text-fg-3 font-mono tabular-nums">
              {plan.updatePrice.map(({ product, from, to }) => (
                <li key={product.id}>
                  {t('settings.importPriceChangeLine', {
                    product: product.name,
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

        {nothingToDo && <p className="text-caption text-fg-3">{t('settings.importNothingToDo')}</p>}
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
 * "which file" state. File pick mirrors Settings' handleRestore.
 */
export function pickProductCsv(onPlanned: (plan: ImportPlan | null) => void): void {
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

      const { rows, errors } = parseProductCsv(text)
      if (rows.length === 0) return onPlanned(null)

      const plan = planProductImport(
        rows,
        useInventoryStore.getState().products,
        useProductCategoryStore.getState().categories.map((c) => c.name),
        useSupplierStore.getState().suppliers
      )
      onPlanned({ ...plan, errors: [...errors, ...plan.errors] })
    }
    reader.readAsText(file)
  }
  input.click()
}
