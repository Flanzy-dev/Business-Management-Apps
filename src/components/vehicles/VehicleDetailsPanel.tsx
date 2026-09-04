import type { Vehicle } from '../../store/vehicleStore'
import { vehicleSpecGroups } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'

const VARIANT_CLASS: Record<'mono' | 'tabular' | 'plain', string> = {
  mono: 'font-mono',
  tabular: 'tabular-nums',
  plain: '',
}

/**
 * A vehicle row's expanded details — the 4 spec groups (basic info, engine,
 * transmission, gardan/differential) plus notes. The 13 individually-gated
 * `{field && <p>}` branches this used to be are now one data table
 * (entities.ts's vehicleSpecGroups) and one render pass.
 */
export function VehicleDetailsPanel({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation()
  const groups = vehicleSpecGroups(vehicle)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
      {groups.map((group) => (
        <div key={group.headingKey}>
          <h4 className="font-medium text-text-primary mb-2">{t(group.headingKey)}</h4>
          <div className="space-y-1 text-text-secondary">
            {group.fields.map((field) => (
              <p key={field.labelKey}>
                {t(field.labelKey)} <span className={VARIANT_CLASS[field.variant ?? 'plain']}>{field.value}</span>
              </p>
            ))}
          </div>
        </div>
      ))}

      {vehicle.notes && (
        <div className="md:col-span-2">
          <h4 className="font-medium text-text-primary mb-2">{t('vehicles.notesHeading')}</h4>
          <p className="text-text-secondary">{vehicle.notes}</p>
        </div>
      )}
    </div>
  )
}
