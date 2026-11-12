import { useState } from 'react'
import { useToastStore } from '../../store/uiStores'
import type { CustomerHistoryPlan } from '../../lib/customers/customerHistoryImport'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { ImportHistoryDialog, pickHistoryCsv } from './ImportHistoryDialog'

/**
 * Import of the shop's pre-app customer history — the CSV
 * scripts/convert-pelanggan-xlsx.mjs makes from the old one-file-per-customer
 * Excel logs. Sits beside PriceListCard/ServiceListCard because Settings is
 * where the shop looks for imports; Settings being admin-only is also the
 * gate this needs (it books past revenue in one step).
 */
export function CustomerHistoryCard() {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)
  // Parsed import awaiting confirmation — see ImportHistoryDialog.
  const [plan, setPlan] = useState<CustomerHistoryPlan | null>(null)

  const handleImport = () => {
    pickHistoryCsv((planned) => {
      if (!planned) {
        showToast({ tone: 'danger', title: t('customers.importInvalidFile') })
        return
      }
      setPlan(planned)
    })
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.customerHistoryTitle')}</CardTitle>
        <p className="text-caption">{t('settings.customerHistoryDescription')}</p>
      </CardHeader>
      <CardContent>
        <Button variant="secondary" onClick={handleImport}>
          {t('settings.importHistoryButton')}
        </Button>
        <p className="text-caption mt-4">{t('settings.importHistoryHint')}</p>
      </CardContent>

      {plan && <ImportHistoryDialog plan={plan} onClose={() => setPlan(null)} />}
    </Card>
  )
}
