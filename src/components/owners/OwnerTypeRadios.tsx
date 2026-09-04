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
    <div>
      <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{label}</label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input type="radio" checked={value === 'customer'} onChange={() => onChange('customer')} className="accent-accent" />
          {individualLabel}
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input type="radio" checked={value === 'company'} onChange={() => onChange('company')} className="accent-accent" />
          {companyLabel}
        </label>
      </div>
    </div>
  )
}
