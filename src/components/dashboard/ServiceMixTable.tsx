import { useTranslation } from '../../lib/i18n'

interface ServiceMixItem {
  name: string
  count: number
  share: number // percentage 0-100
}

interface ServiceMixTableProps {
  services: ServiceMixItem[]
  className?: string
}

export function ServiceMixTable({ services, className = '' }: ServiceMixTableProps) {
  const { t } = useTranslation()
  return (
    <div className={className}>
      <div className="space-y-3">
        {services.map((service, index) => (
          <div key={service.name} className="flex items-center gap-4">
            <span className="w-6 text-caption text-center">{index + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-primary truncate">{service.name}</span>
                <span className="text-sm font-mono text-text-secondary tabular-nums ml-2">{service.share}%</span>
              </div>
              <div className="h-2 bg-surface-sunken rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${service.share}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      {services.length === 0 && (
        <p className="text-center text-text-secondary text-sm py-8">{t('dashboardWidgets.noServiceData')}</p>
      )}
    </div>
  )
}
