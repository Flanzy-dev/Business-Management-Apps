import { useTranslation } from '../../lib/i18n'
import { RadioGroup } from '../ui/Checkbox'

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
    <RadioGroup
      legend={t('vehicles.sourceLabel')}
      value={source}
      onChange={onChange}
      options={[
        { value: 'workshop_default', label: t('vehicles.sourceWorkshopDefault') },
        { value: 'customer_request', label: t('vehicles.sourceCustomerRequest') },
      ]}
    />
  )
}
