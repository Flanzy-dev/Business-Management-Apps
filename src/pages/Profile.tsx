import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Phone, Mail, MapPin, Settings, Edit2, Save } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Input } from '../components/ui/Input'
import { useTranslation } from '../lib/i18n'

interface UserProfile {
  name: string
  role: string
  email: string
  phone: string
}

interface ShopInfo {
  name: string
  address: string
  phone: string
  email: string
}

export default function Profile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)

  // In a real app, this would come from a store or database
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Shop Manager',
    role: t('profile.administratorRole'),
    email: 'manager@suryabaru.local',
    phone: '(555) 123-4567',
  })

  const [shopInfo] = useState<ShopInfo>({
    name: 'Surya Baru Service Console',
    address: '123 Main Street, Anytown, ST 12345',
    phone: '(555) 987-6543',
    email: 'service@suryabaru.local',
  })

  const [editForm, setEditForm] = useState({ ...userProfile })

  const handleSave = () => {
    setUserProfile(editForm)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditForm({ ...userProfile })
    setIsEditing(false)
  }

  return (
    <div>
      <PageHeader
        title={t('profile.title')}
        caption={t('profile.caption')}
        action={
          <Button variant="secondary" icon={Settings} onClick={() => navigate('/settings')}>
            {t('profile.settingsButton')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Profile Card */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>{t('profile.userProfileTitle')}</CardTitle>
            {!isEditing ? (
              <Button
                variant="ghost"
                size="sm"
                icon={Edit2}
                onClick={() => setIsEditing(true)}
              >
                {t('profile.editButton')}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                >
                  {t('profile.cancelButton')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Save}
                  onClick={handleSave}
                >
                  {t('profile.saveButton')}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                <User size={32} className="text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {userProfile.name}
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-radius-full bg-accent/20 text-accent text-sm">
                  {userProfile.role}
                </span>
              </div>
            </div>

            {/* Profile Details */}
            {isEditing ? (
              <div className="space-y-4">
                <Input
                  label={t('profile.nameLabel')}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
                <Input
                  label={t('profile.roleLabel')}
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                />
                <Input
                  label={t('profile.emailLabel')}
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
                <Input
                  label={t('profile.phoneLabel')}
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-surface-sunken rounded-radius-sm">
                  <Mail size={18} className="text-text-secondary" />
                  <div>
                    <p className="text-caption">{t('profile.emailLabel')}</p>
                    <p className="text-sm text-text-primary">{userProfile.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-surface-sunken rounded-radius-sm">
                  <Phone size={18} className="text-text-secondary" />
                  <div>
                    <p className="text-caption">{t('profile.phoneLabel')}</p>
                    <p className="text-sm text-text-primary">{userProfile.phone}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shop Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.shopInformationTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Shop Logo/Icon */}
            <div className="flex items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {shopInfo.name}
                </h3>
                <p className="text-caption">{t('profile.shopTagline')}</p>
              </div>
            </div>

            {/* Shop Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-surface-sunken rounded-radius-sm">
                <MapPin size={18} className="text-text-secondary shrink-0" />
                <div>
                  <p className="text-caption">{t('profile.addressLabel')}</p>
                  <p className="text-sm text-text-primary">{shopInfo.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-surface-sunken rounded-radius-sm">
                <Phone size={18} className="text-text-secondary" />
                <div>
                  <p className="text-caption">{t('profile.shopPhoneLabel')}</p>
                  <p className="text-sm text-text-primary">{shopInfo.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-surface-sunken rounded-radius-sm">
                <Mail size={18} className="text-text-secondary" />
                <div>
                  <p className="text-caption">{t('profile.shopEmailLabel')}</p>
                  <p className="text-sm text-text-primary">{shopInfo.email}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Card */}
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
                <p className="text-2xl font-bold text-text-primary tabular-nums">v1.0.0</p>
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
