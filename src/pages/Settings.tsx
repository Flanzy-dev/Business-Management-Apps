import { useState, useEffect } from 'react'
import { useSettingsStore, DEFAULT_SERVICE_INTERVAL_KM } from '../store/settingsStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { useProductCategoryStore } from '../store/productCategoryStore'
import { collectBackup, applyBackup, clearAllData } from '../lib/persistence'
import { deleteServiceItemTypeChecked, deleteProductCategoryChecked } from '../lib/ops/entityOps'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { useTranslation } from '../lib/i18n'
import {
  isBuiltinProductCategory,
  isBuiltinServiceItemType,
  productCategoryLabel,
  serviceItemTypeLabel,
} from '../lib/entities'
import { Moon, Check, Languages } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { TaxonomyList } from '../components/settings/TaxonomyList'

export default function Settings() {
  const { t, language, setLanguage } = useTranslation()
  const { settings, updateSettings } = useSettingsStore()
  const { serviceItemTypes, addServiceItemType, updateServiceItemType } = useServiceItemTypeStore()
  const { categories, addProductCategory, updateProductCategory } = useProductCategoryStore()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)

  const handleDeleteItemType = (id: string, name: string) => {
    requestConfirm(
      { title: t('settings.deleteItemTypeConfirmTitle'), message: t('settings.deleteItemTypeConfirmMessage', { name }) },
      () => {
        const result = deleteServiceItemTypeChecked(id)
        if (!result.ok) {
          showToast({ tone: 'warning', title: t('settings.cannotDeleteItemTypeTitle'), description: result.reason })
        }
      }
    )
  }

  const handleDeleteCategory = (id: string, name: string) => {
    requestConfirm(
      { title: t('settings.deleteCategoryConfirmTitle'), message: t('settings.deleteCategoryConfirmMessage', { name }) },
      () => {
        const result = deleteProductCategoryChecked(id)
        if (!result.ok) {
          showToast({ tone: 'warning', title: t('settings.cannotDeleteCategoryTitle'), description: result.reason })
        }
      }
    )
  }

  const [shopName, setShopName] = useState(settings.shopName)
  const [shopAddress, setShopAddress] = useState(settings.shopAddress)
  const [shopPhone, setShopPhone] = useState(settings.shopPhone)
  const [shopEmail, setShopEmail] = useState(settings.shopEmail)
  const [taxRate, setTaxRate] = useState(settings.taxRate.toString())
  const [serviceInterval, setServiceInterval] = useState(
    (settings.defaultServiceIntervalKm ?? DEFAULT_SERVICE_INTERVAL_KM).toString()
  )
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setShopName(settings.shopName)
    setShopAddress(settings.shopAddress)
    setShopPhone(settings.shopPhone)
    setShopEmail(settings.shopEmail)
    setTaxRate(settings.taxRate.toString())
    setServiceInterval((settings.defaultServiceIntervalKm ?? DEFAULT_SERVICE_INTERVAL_KM).toString())
    setReceiptFooter(settings.receiptFooter)
  }, [settings])

  const handleSave = () => {
    updateSettings({
      shopName,
      shopAddress,
      shopPhone,
      shopEmail,
      taxRate: parseFloat(taxRate) || 0,
      defaultServiceIntervalKm: parseInt(serviceInterval) || DEFAULT_SERVICE_INTERVAL_KM,
      receiptFooter,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleBackup = () => {
    const blob = new Blob([JSON.stringify(collectBackup(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oil-shop-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleRestore = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        let data: Record<string, unknown>
        try {
          data = JSON.parse(event.target?.result as string)
        } catch {
          showToast({ tone: 'danger', title: t('settings.invalidBackupFile') })
          return
        }
        requestConfirm(
          {
            title: t('settings.restoreConfirmTitle'),
            message: t('settings.restoreConfirmMessage'),
            confirmLabel: t('settings.restoreConfirmLabel'),
          },
          () => {
            const restored = applyBackup(data)
            if (restored === 0) {
              showToast({ tone: 'danger', title: t('settings.noDataFoundInBackup') })
              return
            }
            showToast({ tone: 'success', title: t('settings.dataRestoredTitle'), description: t('settings.reloading') })
            setTimeout(() => window.location.reload(), 800)
          }
        )
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleClearData = () => {
    requestConfirm(
      {
        title: t('settings.clearDataConfirmTitle'),
        message: t('settings.clearDataConfirmMessage'),
        confirmLabel: t('settings.clearDataConfirmLabel'),
      },
      () => {
        clearAllData()
        showToast({ tone: 'success', title: t('settings.dataClearedTitle'), description: t('settings.reloading') })
        setTimeout(() => window.location.reload(), 800)
      }
    )
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title={t('settings.pageTitle')} />

      {/* Appearance — dark-only by deliberate decision (DESIGN.md §9), not an
          unfinished light mode. themeStore.ts is kept but no longer exposes a
          toggle here. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.appearanceTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-text-secondary">
            <Moon size={18} />
            <span className="text-sm">{t('settings.darkTheme')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.languageTitle')}</CardTitle>
          <p className="text-caption">{t('settings.languageDescription')}</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-text-secondary">
            <Languages size={18} />
            <Button variant={language === 'en' ? 'primary' : 'secondary'} size="sm" onClick={() => setLanguage('en')}>
              {t('settings.languageEnglish')}
            </Button>
            <Button variant={language === 'id' ? 'primary' : 'secondary'} size="sm" onClick={() => setLanguage('id')}>
              {t('settings.languageIndonesian')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shop Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.shopInfoTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('settings.shopNameLabel')} value={shopName} onChange={(e) => setShopName(e.target.value)} />
              <Input label={t('settings.phoneLabel')} type="tel" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} />
            </div>

            <Input
              label={t('settings.addressLabel')}
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              placeholder={t('settings.addressPlaceholder')}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('settings.emailLabel')} type="email" value={shopEmail} onChange={(e) => setShopEmail(e.target.value)} />
              <Input label={t('settings.taxRateLabel')} type="number" step="0.01" mono value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>

            <div>
              <Input
                label={t('settings.defaultServiceIntervalLabel')}
                type="number"
                min="0"
                mono
                value={serviceInterval}
                onChange={(e) => setServiceInterval(e.target.value)}
              />
              <p className="mt-1 text-2xs text-fg-3">{t('settings.defaultServiceIntervalHint')}</p>
            </div>

            <Textarea
              label={t('settings.receiptFooterLabel')}
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              rows={2}
              placeholder={t('settings.receiptFooterPlaceholder')}
            />

            <Button variant="primary" icon={saved ? Check : undefined} onClick={handleSave}>
              {saved ? t('settings.savedButton') : t('settings.saveButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Service Item Types — the configurable taxonomy schedule rules and
          tagged work-order lines reference by id (never by name), so renaming
          or adding entries here never breaks an existing link. The seven
          built-ins are still name-keyed for *translation* though, which is why
          TaxonomyList locks their names. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.serviceItemTypesTitle')}</CardTitle>
          <p className="text-caption">{t('settings.serviceItemTypesDescription')}</p>
        </CardHeader>
        <CardContent>
          <TaxonomyList
            entries={serviceItemTypes}
            label={serviceItemTypeLabel}
            isBuiltin={isBuiltinServiceItemType}
            onRename={(id, name) => updateServiceItemType(id, { name })}
            onDelete={handleDeleteItemType}
            onAdd={(name) => addServiceItemType({ name })}
            addPlaceholder={t('settings.newItemTypePlaceholder')}
          />
        </CardContent>
      </Card>

      {/* Product Categories — the shop's own inventory taxonomy. Products
          reference these by name (not id), so beyond blocking deletion of a
          category still assigned to a product (see productCategoryDeletionBlocker)
          the six built-ins are name-locked here as well: their name is both the
          product link and the translation key. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.productCategoriesTitle')}</CardTitle>
          <p className="text-caption">{t('settings.productCategoriesDescription')}</p>
        </CardHeader>
        <CardContent>
          <TaxonomyList
            entries={categories}
            label={productCategoryLabel}
            isBuiltin={isBuiltinProductCategory}
            onRename={(id, name) => updateProductCategory(id, { name })}
            onDelete={handleDeleteCategory}
            onAdd={(name) => addProductCategory({ name })}
            addPlaceholder={t('settings.newCategoryPlaceholder')}
          />
        </CardContent>
      </Card>

      {/* Data Backup */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.backupTitle')}</CardTitle>
          <p className="text-caption">{t('settings.backupDescription')}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary" onClick={handleBackup}>
              {t('settings.downloadBackupButton')}
            </Button>
            <Button variant="secondary" onClick={handleRestore}>
              {t('settings.restoreBackupButton')}
            </Button>
          </div>
          <p className="text-caption mt-4">
            {t('settings.backupHint')}
          </p>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.keyboardShortcutsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between p-2 bg-surface-sunken rounded-radius-sm">
              <span className="text-text-primary">{t('settings.shortcutNewWorkOrder')}</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + N</kbd>
            </div>
            <div className="flex justify-between p-2 bg-surface-sunken rounded-radius-sm">
              <span className="text-text-primary">{t('settings.shortcutGoToDashboard')}</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + D</kbd>
            </div>
            <div className="flex justify-between p-2 bg-surface-sunken rounded-radius-sm">
              <span className="text-text-primary">{t('settings.shortcutSearchQuickFind')}</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + K</kbd>
            </div>
            <div className="flex justify-between p-2 bg-surface-sunken rounded-radius-sm">
              <span className="text-text-primary">{t('settings.shortcutGoToCustomers')}</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + 1</kbd>
            </div>
            <div className="flex justify-between p-2 bg-surface-sunken rounded-radius-sm">
              <span className="text-text-primary">{t('settings.shortcutGoToVehicles')}</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + 2</kbd>
            </div>
            <div className="flex justify-between p-2 bg-surface-sunken rounded-radius-sm">
              <span className="text-text-primary">{t('settings.shortcutGoToWorkOrders')}</span>
              <kbd className="px-2 py-0.5 bg-surface-card border border-border-subtle rounded font-mono text-text-secondary">Ctrl + 3</kbd>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-l-4 border-danger">
        <CardHeader>
          <CardTitle className="text-danger">{t('settings.dangerZoneTitle')}</CardTitle>
          <p className="text-caption">{t('settings.dangerZoneDescription')}</p>
        </CardHeader>
        <CardContent>
          <Button variant="danger" onClick={handleClearData}>
            {t('settings.clearAllDataButton')}
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('settings.aboutTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-text-secondary text-sm space-y-1">
            <p><strong className="text-text-primary">{t('settings.aboutAppName')}</strong></p>
            <p>{t('settings.aboutVersion')}</p>
            <p>{t('settings.aboutOffline')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
