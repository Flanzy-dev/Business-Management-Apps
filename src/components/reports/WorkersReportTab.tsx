import type { WorkerPerformanceEntry } from '../../lib/finance'
import { formatCurrency } from '../../lib/currency'
import { chartTheme } from '../../lib/chartTheme'
import { useTranslation } from '../../lib/i18n'
import { RankedBarChart } from './RankedBarChart'

/** Reports.tsx's Workers tab: revenue/jobs bar charts plus the ranked list. */
export function WorkersReportTab({ workerStats, periodLabel }: { workerStats: WorkerPerformanceEntry[]; periodLabel: string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      {workerStats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.workerRevenueHeading')}</h2>
            <RankedBarChart data={workerStats.map((w) => ({ label: w.name, value: w.revenue }))} valueFormatter={formatCurrency} />
          </div>
          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.workerJobsHeading')}</h2>
            <RankedBarChart data={workerStats.map((w) => ({ label: w.name, value: w.jobCount }))} barColor={chartTheme.info} />
          </div>
        </div>
      )}

      <div className="bg-surface-card rounded-radius-md p-6">
        <h2 className="text-card-title text-text-primary mb-4">{t('reports.workerPerformanceHeading', { period: periodLabel })}</h2>
        {workerStats.length === 0 ? (
          <p className="text-text-secondary text-center py-4">{t('reports.noWorkersYet')}</p>
        ) : (
          <div className="space-y-2">
            {workerStats.map((w, i) => (
              <div key={w.id} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                <div className="flex items-center gap-3">
                  <span className="text-text-secondary">#{i + 1}</span>
                  <div>
                    <span className="font-medium text-text-primary">{w.name}</span>
                    {!w.isActive && (
                      <span className="ml-2 text-xs bg-surface-canvas text-text-secondary px-2 py-0.5 rounded-radius-full">{t('reports.inactiveBadge')}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-medium text-text-primary tabular-nums">{formatCurrency(w.revenue)}</span>
                  <span className="ml-3 text-text-secondary text-sm tabular-nums">{t('reports.servicesSuffix', { count: w.jobCount })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
