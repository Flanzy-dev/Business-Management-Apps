import { useState } from 'react'
import { useSupplierStore } from '../../store/supplierStore'
import { useProductStock } from '../../hooks/useProductStock'
import { useInventoryValuation } from '../../hooks/useInventoryValuation'
import { useToastStore } from '../../store/toastStore'
import { downloadFile } from '../../lib/downloadFile'
import { buildProductCsv, productExportFilename } from '../../lib/productExport'
import type { ImportPlan } from '../../lib/productImport'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { ImportProductsDialog, pickProductCsv } from './ImportProductsDialog'

/**
 * Price-list CSV import/export. Product export reads the same enriched list
 * and FIFO lots the Inventory page does, so the exported stock and cost
 * match what's on screen.
 */
export function PriceListCard() {
  const { t } = useTranslation()
  const products = useProductStock()
  const { suppliers } = useSupplierStore()
  const { unitCostOf } = useInventoryValuation()
  const showToast = useToastStore((s) => s.show)
  // Parsed price-list import awaiting confirmation — see ImportProductsDialog.
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null)

  const handleImportProducts = () => {
    pickProductCsv((plan) => {
      if (!plan) {
        showToast({ tone: 'danger', title: t('settings.importInvalidFile') })
        return
      }
      setImportPlan(plan)
    })
  }

  const handleExportProducts = () => {
    if (products.length === 0) {
      showToast({ tone: 'warning', title: t('settings.exportNothingToExport') })
      return
    }
    const csv = buildProductCsv(products, {
      supplierNameOf: (p) => suppliers.find((s) => s.id === p.supplierId)?.name ?? '',
      // Same FIFO blend the Inventory Cost column shows; falls back to the
      // product's stored cost when no lot is behind the stock.
      unitCostOf,
    })
    downloadFile(csv, productExportFilename(), 'text/csv;charset=utf-8')
    showToast({
      tone: 'success',
      title: t('settings.exportDoneTitle'),
      description: t('settings.exportDoneDescription', { count: products.length }),
    })
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.priceListTitle')}</CardTitle>
        <p className="text-caption">{t('settings.priceListDescription')}</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <Button variant="secondary" onClick={handleImportProducts}>
            {t('settings.importProductsButton')}
          </Button>
          <Button variant="secondary" onClick={handleExportProducts} disabled={products.length === 0}>
            {t('settings.exportProductsButton')}
          </Button>
        </div>
        <p className="text-caption mt-4">{t('settings.importProductsHint')}</p>
        <p className="text-caption mt-1">{t('settings.exportProductsHint')}</p>
      </CardContent>

      {importPlan && <ImportProductsDialog plan={importPlan} onClose={() => setImportPlan(null)} />}
    </Card>
  )
}
