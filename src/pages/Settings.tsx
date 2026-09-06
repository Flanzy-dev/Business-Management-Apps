import { useTranslation } from '../lib/i18n'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { useProductCategoryStore } from '../store/productCategoryStore'
import { clearAllShopData } from '../lib/ops/backupOps'
import { deleteServiceItemTypeChecked, deleteProductCategoryChecked } from '../lib/ops/entityOps'
import { deleteOutcomeToast } from '../lib/deleteOutcome'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { requireAdminPassword } from '../lib/auth/requireAdminPassword'
import {
  isBuiltinProductCategory,
  isBuiltinServiceItemType,
  productCategoryLabel,
  serviceItemTypeLabel,
} from '../lib/entities'
import { Moon, Languages } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { TaxonomyList } from '../components/settings/TaxonomyList'
import { CategoryScheduleMapping } from '../components/settings/CategoryScheduleMapping'
import { ActivityLogCard } from '../components/settings/ActivityLogCard'
import { ShopInfoCard } from '../components/settings/ShopInfoCard'
import { SecurityCard } from '../components/settings/SecurityCard'
import { SyncCard } from '../components/settings/SyncCard'
import { PriceListCard } from '../components/settings/PriceListCard'
import { ServiceListCard } from '../components/settings/ServiceListCard'
import { BackupCard } from '../components/settings/BackupCard'
import { KeyboardShortcutsCard } from '../components/settings/KeyboardShortcutsCard'

export default function Settings() {
  const { t, language, setLanguage } = useTranslation()
  const { serviceItemTypes, addServiceItemType, updateServiceItemType } = useServiceItemTypeStore()
  const { categories, addProductCategory, updateProductCategory } = useProductCategoryStore()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)

  const handleDeleteItemType = (id: string, name: string) => {
    requestConfirm(
      { title: t('settings.deleteItemTypeConfirmTitle'), message: t('settings.deleteItemTypeConfirmMessage', { name }) },
      () => {
        const result = deleteServiceItemTypeChecked(id)
        const toast = deleteOutcomeToast(result, { cannotDeleteTitle: t('settings.cannotDeleteItemTypeTitle') })
        if (toast) showToast(toast)
      }
    )
  }

  const handleDeleteCategory = (id: string, name: string) => {
    requestConfirm(
      { title: t('settings.deleteCategoryConfirmTitle'), message: t('settings.deleteCategoryConfirmMessage', { name }) },
      () => {
        const result = deleteProductCategoryChecked(id)
        const toast = deleteOutcomeToast(result, { cannotDeleteTitle: t('settings.cannotDeleteCategoryTitle') })
        if (toast) showToast(toast)
      }
    )
  }

  const handleClearData = () => {
    requestConfirm(
      {
        title: t('settings.clearDataConfirmTitle'),
        message: t('settings.clearDataConfirmMessage'),
        confirmLabel: t('settings.clearDataConfirmLabel'),
      },
      async () => {
        // clearAllData() wipes security-store, so the admin password is
        // gone after this — correct (it's a full factory reset), but the
        // device isn't wedged: the sticky Worker-mode marker is
        // device-local (never in PERSISTED_STORES, so clearAllData leaves
        // it alone), and Layout's Lock button is reachable in Worker mode
        // too, so the next admin just Locks and creates a fresh password.
        if (!(await requireAdminPassword(t('auth.reauth.reasonClearData')))) return
        clearAllShopData()
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
      <ShopInfoCard />

      {/* Security & Access (src/store/authStore.ts, src/store/securityStore.ts)
          — Admin/Worker mode's password and the LAN sync token live here.
          Modeled on the Multi-device sync card below it: a generated
          secret, Copy/Regenerate, and an opt-in switch with a confirm step
          before it's turned on. */}
      <SecurityCard />

      {/* Accountability log — not access control: Worker mode can still delete
          customers/companies/vehicles and record stock arrivals/adjustments
          (see those pages' handlers and the checkout catalog's double-click
          receive-stock action), this is what lets an admin see who did each
          one and from which device afterward. Admin-only by construction —
          /settings is already <RequireAdmin>-wrapped in App.tsx, same as
          every other Settings section. See ActivityLogCard for how the two
          underlying append-only logs are merged. */}
      <ActivityLogCard />

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
          the seven built-ins are name-locked here as well: their name is both the
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

      {/* Which vehicle-schedule item each category changes — see
          src/lib/scheduleTagging.ts. Separate card from the taxonomy list
          above: this mapping is what lets a work order line added from
          inventory (WorkOrderEditor.tsx's handleAddProduct) advance a
          vehicle's schedule automatically, without a per-product service tag. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.categoryScheduleMappingTitle')}</CardTitle>
          <p className="text-caption">{t('settings.categoryScheduleMappingDescription')}</p>
        </CardHeader>
        <CardContent>
          <CategoryScheduleMapping />
        </CardContent>
      </Card>

      {/* Price list import/export */}
      <PriceListCard />

      {/* Services import/export */}
      <ServiceListCard />

      {/* Data Backup */}
      <BackupCard />

      {/* Multi-device sync */}
      <SyncCard />

      {/* Keyboard Shortcuts */}
      <KeyboardShortcutsCard />

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
