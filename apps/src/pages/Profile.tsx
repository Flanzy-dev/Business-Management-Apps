import { useNavigate } from 'react-router-dom'
import { User, Phone, Mail, MapPin, Settings } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { useTranslation } from '../lib/i18n'
import { useIsAdmin, useMode } from '../store/authStore'
import { useSecurityStore } from '../store/securityStore'
import { useSettingsStore } from '../store/settingsStore'
import { accountSummary, shopContact } from '../lib/app/profileInfo'
import { versionLabel } from '../lib/app/environment'

/** One labelled detail line; an unset value says so rather than showing nothing. */
function DetailRow({ icon: Icon, label, value, notSet }: { icon: typeof Mail; label: string; value: string | null; notSet: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-surface-sunken rounded-radius-sm">
      <Icon size={18} className="text-text-secondary shrink-0" />
      <div className="min-w-0">
        <p className="text-caption">{label}</p>
        <p className={`text-sm break-words ${value ? 'text-text-primary' : 'text-fg-3'}`}>{value ?? notSet}</p>
      </div>
    </div>
  )
}

/**
 * Who is signed in, and the shop's details. Both are read, not edited: the app
 * has two shop accounts and no per-person identity beyond them, so there is no
 * personal email or phone to keep, and the shop's details are edited in
 * Settings (one place, so receipts and this page can never disagree).
 */
export default function Profile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const mode = useMode()
  const adminUsername = useSecurityStore((s) => s.security.adminUsername)
  const workerUsername = useSecurityStore((s) => s.security.workerUsername)
  const settings = useSettingsStore((s) => s.settings)

  const account = accountSummary(mode, { adminUsername, workerUsername })
  const shop = shopContact(settings)
  const roleLabel = account.role === 'admin' ? t('profile.administratorRole') : t('profile.workerRole')
  const notSet = t('profile.notSet')

  return (
    <div>
      <PageHeader
        title={t('profile.title')}
        caption={t('profile.caption')}
        action={
          isAdmin ? (
            <Button variant="secondary" icon={Settings} onClick={() => navigate('/settings')}>
              {t('profile.settingsButton')}
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.userProfileTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-accent-muted flex items-center justify-center shrink-0">
                <User size={32} className="text-accent" />
              </div>
              <div className="min-w-0">
                <h3 className={`text-lg font-semibold break-words ${account.name ? 'text-text-primary' : 'text-fg-3'}`}>
                  {account.name ?? t('profile.noAccountName')}
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-radius-full bg-accent-muted text-accent text-sm">
                  {roleLabel}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>{t('profile.shopInformationTitle')}</CardTitle>
            {isAdmin && (
              <Button variant="ghost" size="sm" icon={Settings} onClick={() => navigate('/settings')}>
                {t('profile.editShopInSettings')}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <DetailRow icon={User} label={t('profile.shopNameLabel')} value={shop.name} notSet={notSet} />
              <DetailRow icon={MapPin} label={t('profile.addressLabel')} value={shop.address} notSet={notSet} />
              <DetailRow icon={Phone} label={t('profile.shopPhoneLabel')} value={shop.phone} notSet={notSet} />
              <DetailRow icon={Mail} label={t('profile.shopEmailLabel')} value={shop.email} notSet={notSet} />
            </div>
            {!isAdmin && <p className="mt-3 text-2xs text-fg-3">{t('profile.workerShopHint')}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('profile.accountOverviewTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-surface-sunken rounded-radius-sm text-center">
                <p className="text-2xl font-bold text-text-primary tabular-nums">100%</p>
                <p className="text-caption">{t('profile.offlineMode')}</p>
              </div>
              <div className="p-4 bg-surface-sunken rounded-radius-sm text-center">
                <p className="text-2xl font-bold text-text-primary tabular-nums">{versionLabel()}</p>
                <p className="text-caption">{t('profile.appVersion')}</p>
              </div>
              <div className="p-4 bg-surface-sunken rounded-radius-sm text-center">
                <p className="text-2xl font-bold text-accent">{t('profile.statusActive')}</p>
                <p className="text-caption">{t('profile.statusLabel')}</p>
              </div>
              <div className="p-4 bg-surface-sunken rounded-radius-sm text-center">
                <p className="text-2xl font-bold text-text-primary">SQLite</p>
                <p className="text-caption">{t('profile.databaseLabel')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
