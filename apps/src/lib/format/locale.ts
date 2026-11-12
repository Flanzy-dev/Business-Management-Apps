// The one place the formatters learn which language the shop is running in.
// Kept apart from dates.ts/dateKeys.ts so neither has to import a store: both
// just call activeDateLocale() for their default.
import { useLanguageStore } from '../../store/languageStore'

/** The two locales `useTranslation`'s `language` maps onto for date display. */
export type DateLocale = 'en-US' | 'id-ID'

/** The locale for the shop's current UI language. Read imperatively, like
 *  translate() does, so receipts and WhatsApp text built outside React follow
 *  the same language as their translated labels. */
export function activeDateLocale(): DateLocale {
  return useLanguageStore.getState().language === 'id' ? 'id-ID' : 'en-US'
}
