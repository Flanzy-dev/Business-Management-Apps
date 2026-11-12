import { RadioGroup } from '../ui/Checkbox'

/**
 * The individual/company owner-type radio pair — was hand-duplicated,
 * byte-identical but for i18n keys, between AppointmentDialog.tsx and
 * NewWorkOrderDialog.tsx. The owner/vehicle reset that follows a change stays
 * in the caller: only it knows which other fields (ownerId, vehicleId) need
 * clearing.
 */
export function OwnerTypeRadios({
  value,
  onChange,
  label,
  individualLabel,
  companyLabel,
}: {
  value: 'customer' | 'company'
  onChange: (next: 'customer' | 'company') => void
  label: string
  individualLabel: string
  companyLabel: string
}) {
  return (
    <RadioGroup
      legend={label}
      value={value}
      onChange={onChange}
      options={[
        { value: 'customer', label: individualLabel },
        { value: 'company', label: companyLabel },
      ]}
    />
  )
}
