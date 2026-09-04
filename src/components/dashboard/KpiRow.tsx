import { DollarSign, Car, Package, UserPlus } from 'lucide-react'
import type { Period } from '../../lib/dates'
import type { PeriodKpis } from '../../lib/dashboardMetrics'
import { formatCurrency } from '../../lib/currency'
import { useTranslation } from '../../lib/i18n'
import { Card } from '../ui/Card'
import { Tabs } from '../ui/Tabs'
import { StatCard } from './StatCard'

const PERIODS = ['day', 'week', 'month', 'year'] as const

/** Dashboard's period-tab switcher plus the four (three in Worker mode) KPI
 *  tiles it drives. isAdmin gates the Revenue tile — Worker mode hides
 *  revenue/profit everywhere (see src/lib/auth/permissions.ts). */
export function KpiRow({
  isAdmin,
  period,
  onPeriodChange,
  kpis,
}: {
  isAdmin: boolean
  period: Period
  onPeriodChange: (period: Period) => void
  kpis: PeriodKpis
}) {
  const { t } = useTranslation()
  const periodTabs = PERIODS.map((p) => ({
    value: p,
    label: t(`reports.periodLabel${p[0].toUpperCase()}${p.slice(1)}`),
  }))
  const deltaLabel = t(
    {
      day: 'dashboardWidgets.vsYesterday',
      week: 'dashboardWidgets.vsLastWeek',
      month: 'dashboardWidgets.vsLastMonth',
      year: 'dashboardWidgets.vsLastYear',
    }[period]
  )

  return (
    <Card className="mb-6" padding="md">
      <div className="flex justify-end mb-4">
        <Tabs variant="pill" tabs={periodTabs} value={period} onChange={(v) => onPeriodChange(v as Period)} />
      </div>
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {isAdmin && (
          <StatCard
            title={t('dashboard.kpiRevenue')}
            value={formatCurrency(kpis.revenue)}
            icon={DollarSign}
            delta={kpis.revenueDelta}
            deltaLabel={deltaLabel}
          />
        )}
        <StatCard
          title={t('dashboard.kpiVehiclesServiced')}
          value={kpis.vehiclesServiced.toString()}
          icon={Car}
          delta={kpis.vehiclesDelta}
          deltaLabel={deltaLabel}
        />
        <StatCard
          title={t('dashboard.kpiPartsFiltersUsed')}
          value={kpis.partsUsed.toString()}
          icon={Package}
          delta={kpis.partsDelta}
          deltaLabel={deltaLabel}
        />
        <StatCard
          title={t('dashboard.kpiNewCustomers')}
          value={kpis.newCustomers.toString()}
          icon={UserPlus}
          delta={kpis.newCustomersDelta}
          deltaLabel={deltaLabel}
        />
      </div>
    </Card>
  )
}
