import { useTranslation } from '../lib/i18n'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { useProductCategoryStore } from '../store/productCategoryStore'
import { clearAllShopData } from '../lib/ops/backupOps'
import { deleteServiceItemTypeChecked, deleteProductCategoryChecked } from '../lib/ops/entityOps'
import { deleteOutcomeToast } from '../lib/ops/deletion'
import { useToastStore, useConfirmStore } from '../store/uiStores'
import { requireAdminPassword } from '../lib/auth/requireAdminPassword'
import { APP_VERSION } from '../lib/app/environment'
import {
  isBuiltinProductCategory,
  isBuiltinServiceItemType,
  productCategoryLabel,
  serviceItemTypeLabel,
} from '../lib/format/entities'
import { Languages } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { TabbedPage } from '../components/layout/TabbedPage'
import { TaxonomyList } from '../components/settings/TaxonomyList'
import { CategoryScheduleMapping } from '../components/settings/CategoryScheduleMapping'
import { ActivityLogCard } from '../components/settings/ActivityLogCard'
import { ShopInfoCard } from '../components/settings/ShopInfoCard'
import { SecurityCard } from '../components/settings/SecurityCard'
import { SyncCard } from '../components/settings/SyncCard'
import { PriceListCard } from '../components/settings/PriceListCard'
import { ServiceListCard } from '../components/settings/ServiceListCard'
import { CustomerHistoryCard } from '../components/settings/CustomerHistoryCard'
import { DuplicatePlatesCard } from '../components/settings/DuplicatePlatesCard'
import { BackupCard } from '../components/settings/BackupCard'
import { KeyboardShortcutsCard } from '../components/settings/KeyboardShortcutsCard'
import { UpdateCard } from '../components/settings/UpdateCard'
import Technicians from './sections/Technicians'

/**
 * Settings, grouped into tabs (src/components/layout/TabbedPage.tsx) instead
 * of one long page of cards. Admin-only as a whole — /settings sits inside
 * <RequireAdmin> in App.tsx — so no tab needs its own gate. Technicians moved
 * in here from their own sidebar item: who works at the shop is set up once,
 * not visited every day.
 *
 * The Appearance card is gone: the app is dark-only by deliberate decision
 * (DESIGN_SYSTEM.md §8), so it offered nothing to choose.
 */
export default function Settings() {
  const { t } = useTranslation()
  return (
    <div className="max-w-4xl">
      {/* The visible title is in the topbar. */}
      <h1 className="sr-only">{t('settings.pageTitle')}</h1>
      <TabbedPage
        tabs={[
          { value: 'shop', label: t('settings.tabShop'), render: () => <ShopSettings /> },
          { value: 'accounts', label: t('settings.tabAccounts'), render: () => <AccountSettings /> },
          { value: 'technicians', label: t('settings.tabTechnicians'), render: () => <Technicians /> },
          { value: 'catalog', label: t('settings.tabCatalog'), render: () => <CatalogSettings /> },
          { value: 'sync', label: t('settings.tabSync'), render: () => <SyncCard /> },
          { value: 'data', label: t('settings.tabData'), render: () => <DataSettings /> },
        ]}
      />
    </div>
  )
}

/** The shop itself and this install: details, language, shortcuts, updates. */
function ShopSettings() {
  const { t, language, setLanguage } = useTranslation()
  return (
    <>
      <ShopInfoCard />

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

      <KeyboardShortcutsCard />

      <UpdateCard />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('settings.aboutTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-text-secondary text-sm space-y-1">
            <p><strong className="text-text-primary">{t('settings.aboutAppName')}</strong></p>
            <p>{t('settings.aboutVersion', { version: APP_VERSION })}</p>
            <p>{t('settings.aboutOffline')}</p>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

/** Who can sign in, and who did what. */
function AccountSettings() {
  return (
    <>
      {/* Security & Access (src/store/authStore.ts, src/store/securityStore.ts)
          — Admin/Worker mode's password and the LAN sync token live here. */}
      <SecurityCard />

      {/* Accountability log — not access control: Worker mode can still delete
          customers/companies/vehicles and record stock arrivals/adjustments;
          this is what lets an admin see who did each one and from which
          device afterward. See ActivityLogCard for how the two underlying
          append-only logs are merged. */}
      <ActivityLogCard />
    </>
  )
}

/** The lists the rest of the app picks from: service items, product
 *  categories, which category advances which schedule item, and the price
 *  and service lists' import/export. */
function CatalogSettings() {
  const { t } = useTranslation()
  const { serviceItemTypes, addServiceItemType, updateServiceItemType } = useServiceItemTypeStore()
  const { categories, addProductCategory, updateProductCategory } = useProductCategoryStore()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)

  const handleDeleteItemType = (id: string, name: string) => {
    requestConfirm(
      { title: t('settings.deleteItemTypeConfirmTitle'), message: t('settings.deleteItemTypeConfirmMessage', { name }) },
      () => {
        const result = deleteServiceItemTypeChecked(id)
        const toast = deleteOutcomeToast(result, { cannotDeleteTitle: t('settings.cannotDeleteItemTypeTitle'), deletedTitle: t('settings.itemTypeDeletedToast') })
        if (toast) showToast(toast)
      }
    )
  }

  const handleDeleteCategory = (id: string, name: string) => {
    requestConfirm(
      { title: t('settings.deleteCategoryConfirmTitle'), message: t('settings.deleteCategoryConfirmMessage', { name }) },
      () => {
        const result = deleteProductCategoryChecked(id)
        const toast = deleteOutcomeToast(result, { cannotDeleteTitle: t('settings.cannotDeleteCategoryTitle'), deletedTitle: t('settings.categoryDeletedToast') })
        if (toast) showToast(toast)
      }
    )
  }

  return (
    <>
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
          src/lib/schedule/scheduleTagging.ts. This mapping is what lets a work order
          line added from inventory advance a vehicle's schedule
          automatically, without a per-product service tag. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('settings.categoryScheduleMappingTitle')}</CardTitle>
          <p className="text-caption">{t('settings.categoryScheduleMappingDescription')}</p>
        </CardHeader>
        <CardContent>
          <CategoryScheduleMapping />
        </CardContent>
      </Card>

      <PriceListCard />

      <ServiceListCard />
    </>
  )
}

/** Backing data up, bringing old records in, cleaning them up, and wiping. */
function DataSettings() {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)

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
    <>
      <BackupCard />

      {/* Customer history import (old Excel logs) */}
      <CustomerHistoryCard />

      {/* Vehicles sharing a plate — merge into one */}
      <DuplicatePlatesCard />

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
    </>
  )
}
