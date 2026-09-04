import { useTranslation } from '../../lib/i18n'

/** Whether this rule came from the shop's own default interval or a specific
 *  customer ask — shown on every rule (see ScheduleRuleRow's summary line). */
export function ScheduleSourceRadios({
  source,
  onChange,
}: {
  source: 'workshop_default' | 'customer_request'
  onChange: (source: 'workshop_default' | 'customer_request') => void
}) {
  const { t } = useTranslation()

  return (
    <div>
      <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('vehicles.sourceLabel')}</label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="radio"
            checked={source === 'workshop_default'}
            onChange={() => onChange('workshop_default')}
            className="accent-accent"
          />
          {t('vehicles.sourceWorkshopDefault')}
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="radio"
            checked={source === 'customer_request'}
            onChange={() => onChange('customer_request')}
            className="accent-accent"
          />
          {t('vehicles.sourceCustomerRequest')}
        </label>
      </div>
    </div>
  )
}
