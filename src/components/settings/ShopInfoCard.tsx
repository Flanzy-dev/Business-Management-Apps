import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'
import { initialSettingsDraft, settingsDraftToData, type SettingsDraft } from '../../lib/settingsForm'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Input, Select, Textarea } from '../ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'

/**
 * Shop profile, default schedule intervals, and receipt formatting — the one
 * form on this page that just saves a flat settings object, no cross-store
 * side effects. Draft state and its two conversions live in
 * src/lib/settingsForm.ts, the one place the field list needs to be kept
 * right (see that file's header for what used to go wrong here).
 */
export function ShopInfoCard() {
  const { t } = useTranslation()
  const { settings, updateSettings } = useSettingsStore()
  const [draft, setDraft] = useState<SettingsDraft>(() => initialSettingsDraft(settings))
  const [saved, setSaved] = useState(false)

  // A remote sync can land new settings while this page is open — reset the
  // draft to match whenever that happens, same as the store itself does.
  useEffect(() => {
    setDraft(initialSettingsDraft(settings))
  }, [settings])

  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const handleSave = () => {
    updateSettings(settingsDraftToData(draft))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.shopInfoTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('settings.shopNameLabel')} value={draft.shopName} onChange={(e) => set('shopName', e.target.value)} />
            <Input label={t('settings.phoneLabel')} type="tel" value={draft.shopPhone} onChange={(e) => set('shopPhone', e.target.value)} />
          </div>

          <Input
            label={t('settings.addressLabel')}
            value={draft.shopAddress}
            onChange={(e) => set('shopAddress', e.target.value)}
            placeholder={t('settings.addressPlaceholder')}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('settings.emailLabel')} type="email" value={draft.shopEmail} onChange={(e) => set('shopEmail', e.target.value)} />
            <Input
              label={t('settings.taxRateLabel')}
              type="number"
              step="0.01"
              mono
              value={draft.taxRate}
              onChange={(e) => set('taxRate', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label={t('settings.defaultServiceIntervalLabel')}
                type="number"
                min="0"
                mono
                value={draft.serviceInterval}
                onChange={(e) => set('serviceInterval', e.target.value)}
              />
              <p className="mt-1 text-2xs text-fg-3">{t('settings.defaultServiceIntervalHint')}</p>
            </div>
            <div>
              <Input
                label={t('settings.defaultServiceIntervalMonthsLabel')}
                type="number"
                min="0"
                mono
                value={draft.serviceIntervalMonths}
                onChange={(e) => set('serviceIntervalMonths', e.target.value)}
              />
              <p className="mt-1 text-2xs text-fg-3">{t('settings.defaultServiceIntervalMonthsHint')}</p>
            </div>
          </div>

          <div>
            <Input
              label={t('settings.defaultPaymentTermDaysLabel')}
              type="number"
              min="0"
              mono
              value={draft.paymentTermDays}
              onChange={(e) => set('paymentTermDays', e.target.value)}
            />
            <p className="mt-1 text-2xs text-fg-3">{t('settings.defaultPaymentTermDaysHint')}</p>
          </div>

          <Textarea
            label={t('settings.receiptFooterLabel')}
            value={draft.receiptFooter}
            onChange={(e) => set('receiptFooter', e.target.value)}
            rows={2}
            placeholder={t('settings.receiptFooterPlaceholder')}
          />

          <Select
            label={t('settings.receiptPaperWidthLabel')}
            value={draft.receiptPaperWidth}
            onChange={(e) => set('receiptPaperWidth', e.target.value as SettingsDraft['receiptPaperWidth'])}
          >
            <option value="58mm">{t('settings.receiptPaperWidth58')}</option>
            <option value="80mm">{t('settings.receiptPaperWidth80')}</option>
            <option value="a4">{t('settings.receiptPaperWidthA4')}</option>
          </Select>

          <div>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer w-fit">
              <input
                type="checkbox"
                className="accent-accent"
                checked={draft.receiptAutoPrint}
                onChange={(e) => set('receiptAutoPrint', e.target.checked)}
              />
              {t('settings.receiptAutoPrintLabel')}
            </label>
            <p className="mt-1 text-2xs text-fg-3">{t('settings.receiptAutoPrintHint')}</p>
          </div>

          <Button variant="primary" icon={saved ? Check : undefined} onClick={handleSave}>
            {saved ? t('settings.savedButton') : t('settings.saveButton')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
