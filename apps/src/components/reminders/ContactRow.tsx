import type { ReactNode } from 'react'
import { Copy, Phone, MessageCircle } from 'lucide-react'
import { useToastStore } from '../../store/uiStores'
import { whatsAppUrl } from '../../lib/schedule/reminders'
import { openExternalLink } from '../../lib/app/files'
import { rowEditOnDoubleClick } from '../../lib/app/rowInteraction'
import { useTranslation } from '../../lib/i18n'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

/**
 * The shared card shape both Reminders sections (service-due, payments-due)
 * render one row as: a heading/body on the left, Copy/Call/WhatsApp plus a
 * section-specific primary action on the right. Was a 7-positional-argument
 * function (`renderContactRow`) — three of those positions were raw
 * ReactNode, which reads fine at the call site but gives a type error no
 * useful message at the wrong position; named props fix that for free.
 */
export function ContactRow({
  contact,
  message,
  heading,
  body,
  primaryAction,
  onDoubleClick,
  onContacted,
}: {
  contact: { phone: string; email: string } | null
  message: string
  heading: ReactNode
  body: ReactNode
  primaryAction: ReactNode
  /** Called once the customer has been rung or messaged — a reminder that was
   *  just acted on should say so, not keep looking untouched. Omit for a row
   *  with no contacted state. */
  onContacted?: () => void
  /** Opens a detail popup for this row (e.g. a receivable's transaction) — omit for a row with none. */
  onDoubleClick?: () => void
}) {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message)
      showToast({ tone: 'success', title: t('reminders.messageCopied') })
    } catch {
      showToast({ tone: 'danger', title: t('reminders.messageCopyFailed') })
    }
  }

  return (
    <Card
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${onDoubleClick ? 'cursor-pointer hover:bg-bg-4 transition-colors' : ''}`}
      {...(onDoubleClick ? rowEditOnDoubleClick(onDoubleClick) : {})}
    >
      <div>
        {heading}
        {body}
        {!contact?.phone && <p className="text-2xs text-text-secondary mt-1">{t('reminders.noContact')}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={Copy} onClick={copyToClipboard}>
          {t('reminders.copyMessage')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={Phone}
          disabled={!contact?.phone}
          onClick={() => {
            if (!contact?.phone) return
            openExternalLink(`tel:${contact.phone}`)
            onContacted?.()
          }}
        >
          {t('reminders.call')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={MessageCircle}
          disabled={!contact?.phone}
          onClick={() => {
            if (!contact?.phone) return
            openExternalLink(whatsAppUrl(contact.phone, message))
            onContacted?.()
          }}
        >
          {t('reminders.whatsapp')}
        </Button>
        {primaryAction}
      </div>
    </Card>
  )
}
