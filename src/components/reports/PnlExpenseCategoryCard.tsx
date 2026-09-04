import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { ExpenseCategoryBar } from './ExpenseCategoryBar'
import type { CategoryTotal } from '../../lib/finance'
import { useTranslation } from '../../lib/i18n'

export function PnlExpenseCategoryCard({ periodLabel, categories }: { periodLabel: string; categories: CategoryTotal[] }) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pnlReport.expensesByCategoryTitle', { period: periodLabel })}</CardTitle>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-text-secondary text-center py-12">{t('pnlReport.noExpensesInPeriod')}</p>
        ) : (
          <ExpenseCategoryBar data={categories} />
        )}
      </CardContent>
    </Card>
  )
}
