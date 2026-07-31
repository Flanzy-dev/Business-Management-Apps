import { MessageSquare } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { useTranslation } from '../lib/i18n'

export default function Messages() {
  const { t } = useTranslation()
  return (
    <div>
      <PageHeader title={t('messages.title')} caption={t('messages.caption')} />

      <div className="bg-surface-card rounded-radius-md p-12 text-center">
        <MessageSquare size={48} className="mx-auto mb-4 text-text-secondary opacity-50" />
        <h2 className="text-lg font-medium text-text-primary mb-2">{t('messages.comingSoonTitle')}</h2>
        <p className="text-text-secondary max-w-md mx-auto">
          {t('messages.comingSoonMessage')}
        </p>
      </div>
    </div>
  )
}
