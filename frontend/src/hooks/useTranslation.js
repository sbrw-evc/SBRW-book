import { useAppStore } from '../store/appStore'
import { translations } from '../i18n/translations'

export function useTranslation() {
  const locale = useAppStore((s) => s.locale)
  const t = (key) => translations[locale]?.[key] ?? translations['en']?.[key] ?? key
  return { t, locale }
}
