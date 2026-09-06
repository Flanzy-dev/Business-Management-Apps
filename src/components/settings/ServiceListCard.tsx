import { useState } from 'react'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useToastStore } from '../../store/toastStore'
import { downloadFile } from '../../lib/downloadFile'
import { buildServiceCsv, serviceExportFilename } from '../../lib/serviceExport'
import type { ServiceImportPlan } from '../../lib/serviceImport'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { ImportServicesDialog, pickServiceCsv } from './ImportServicesDialog'

/**
 * Services CSV import/export — the Services counterpart to PriceListCard.tsx.
 * A separate card rather than folded into that one: the two catalogs
 * (parts vs. labor) have unrelated shapes (schedule tags/intervals here,
 * cost/stock there), so sharing a card would mean two independent
 * import/export flows behind one title.
 */
export function ServiceListCard() {
  const { t } = useTranslation()
  const { services } = useServiceCatalogStore()
  const { serviceItemTypes } = useServiceItemTypeStore()
  const showToast = useToastStore((s) => s.show)
  // Parsed services CSV awaiting confirmation — see ImportServicesDialog.
  const [importPlan, setImportPlan] = useState<ServiceImportPlan | null>(null)

  const handleImportServices = () => {
    pickServiceCsv((plan) => {
      if (!plan) {
        showToast({ tone: 'danger', title: t('settings.importInvalidFile') })
        return
      }
      setImportPlan(plan)
    })
  }

  const handleExportServices = () => {
    if (services.length === 0) {
      showToast({ tone: 'warning', title: t('settings.exportServicesNothingToExport') })
      return
    }
    const tagNameOf = (id: string) => serviceItemTypes.find((it) => it.id === id)?.name ?? ''
    const csv = buildServiceCsv(services, tagNameOf)
    downloadFile(csv, serviceExportFilename(), 'text/csv;charset=utf-8')
    showToast({
      tone: 'success',
      title: t('settings.exportServicesDoneTitle'),
      description: t('settings.exportServicesDoneDescription', { count: services.length }),
    })
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.serviceListTitle')}</CardTitle>
        <p className="text-caption">{t('settings.serviceListDescription')}</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <Button variant="secondary" onClick={handleImportServices}>
            {t('settings.importServicesButton')}
          </Button>
          <Button variant="secondary" onClick={handleExportServices} disabled={services.length === 0}>
            {t('settings.exportServicesButton')}
          </Button>
        </div>
        <p className="text-caption mt-4">{t('settings.importServicesHint')}</p>
        <p className="text-caption mt-1">{t('settings.exportServicesHint')}</p>
      </CardContent>

      {importPlan && <ImportServicesDialog plan={importPlan} onClose={() => setImportPlan(null)} />}
    </Card>
  )
}
