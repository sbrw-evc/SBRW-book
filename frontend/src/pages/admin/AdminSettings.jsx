import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/auth'
import { useAppStore } from '../../store/appStore'
import { useTranslation } from '../../hooks/useTranslation'
import { PageSpinner } from '../../components/ui/Spinner'
import { Navigate } from 'react-router-dom'
import { Mail, Send, Save, Bell, BookOpen, Library, BookMarked, BookText, Feather, PenLine } from 'lucide-react'
import toast from 'react-hot-toast'

const APP_ICONS = [
  { name: 'BookOpen',   Icon: BookOpen },
  { name: 'Library',    Icon: Library },
  { name: 'BookMarked', Icon: BookMarked },
  { name: 'BookText',   Icon: BookText },
  { name: 'Feather',    Icon: Feather },
  { name: 'PenLine',    Icon: PenLine },
]

const EMAIL_NOTIFY_FIELDS = [
  { key: 'email_notify_verify', labelKey: 'emailNotifyVerify' },
  { key: 'email_notify_reset', labelKey: 'emailNotifyReset' },
  { key: 'email_notify_series', labelKey: 'emailNotifySeries' },
  { key: 'email_notify_newsletter', labelKey: 'emailNotifyNewsletter' },
]

const GENERAL_SETTINGS = [
  { key: 'app_name', label: 'Название приложения' },
  { key: 'site_url', label: 'Адрес сайта (для ссылок в письмах)' },
]

const SELECT_SETTINGS = [
  {
    key: 'default_locale',
    label: 'Язык по умолчанию',
    options: [{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }],
  },
  {
    key: 'default_theme',
    label: 'Тема по умолчанию',
    options: [
      { value: 'light', label: 'Светлая' },
      { value: 'dark', label: 'Тёмная' },
      { value: 'colorful', label: 'Цветная' },
    ],
  },
]

const SMTP_FIELDS = [
  { key: 'smtp_host', label: 'SMTP-сервер', placeholder: 'smtp.gmail.com' },
  { key: 'smtp_port', label: 'Порт', placeholder: '587' },
  { key: 'smtp_user', label: 'Логин', placeholder: 'user@example.com' },
  { key: 'smtp_password', label: 'Пароль', placeholder: '••••••••', type: 'password' },
  { key: 'smtp_from', label: 'Адрес отправителя', placeholder: 'noreply@example.com' },
]

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-primary-600' : 'bg-gray-400 dark:bg-gray-600'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-7' : 'left-1'}`} />
    </button>
  )
}

export function AdminSettings() {
  const { t } = useTranslation()
  const { isAdmin, user, setAppSettings } = useAppStore()
  const qc = useQueryClient()

  if (!isAdmin()) return <Navigate to="/admin" replace />

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.getSettings().then((r) => r.data),
  })

  const [smtp, setSmtp] = useState(null)
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (settings && !smtp) {
      setSmtp({
        smtp_enabled: settings.smtp_enabled === 'true',
        smtp_host: settings.smtp_host || '',
        smtp_port: settings.smtp_port || '587',
        smtp_user: settings.smtp_user || '',
        smtp_password: settings.smtp_password || '',
        smtp_from: settings.smtp_from || '',
        smtp_use_tls: (settings.smtp_use_tls ?? 'true') === 'true',
        smtp_use_ssl: settings.smtp_use_ssl === 'true',
      })
      setTestTo(user?.email || '')
    }
  }, [settings, smtp, user])

  const mutation = useMutation({
    mutationFn: ({ key, value }) => adminApi.updateSetting(key, value),
    onSuccess: (_, { key, value }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
      if (key === 'app_name' || key === 'app_icon') {
        const cur = qc.getQueryData(['admin', 'settings']) || {}
        setAppSettings({
          app_name: key === 'app_name' ? value : (cur.app_name || 'SBRW Books'),
          app_icon: key === 'app_icon' ? value : (cur.app_icon || 'BookOpen'),
        })
      }
      toast.success(t('success'))
    },
    onError: () => toast.error(t('error')),
  })

  const saveSmtp = async () => {
    const entries = {
      smtp_enabled: smtp.smtp_enabled ? 'true' : 'false',
      smtp_host: smtp.smtp_host,
      smtp_port: smtp.smtp_port,
      smtp_user: smtp.smtp_user,
      smtp_password: smtp.smtp_password,
      smtp_from: smtp.smtp_from || smtp.smtp_user,
      smtp_use_tls: smtp.smtp_use_tls ? 'true' : 'false',
      smtp_use_ssl: smtp.smtp_use_ssl ? 'true' : 'false',
    }
    try {
      for (const [key, value] of Object.entries(entries)) {
        await adminApi.updateSetting(key, value)
      }
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
      toast.success(t('smtpSaved'))
    } catch {
      toast.error(t('error'))
    }
  }

  const sendTest = async () => {
    setTesting(true)
    try {
      await saveSmtp()
      const { data } = await adminApi.smtpTest(testTo)
      toast.success(`${t('testEmailSent')}: ${data.to}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'), { duration: 6000 })
    } finally {
      setTesting(false)
    }
  }

  if (isLoading || !smtp) return <PageSpinner />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('settings')}</h1>

      {/* General */}
      <div className="card p-6 space-y-4 max-w-2xl">
        <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Разрешить регистрацию</span>
          <Toggle
            value={settings.allow_registration === 'true'}
            onChange={(v) => mutation.mutate({ key: 'allow_registration', value: v ? 'true' : 'false' })}
          />
        </div>
        {GENERAL_SETTINGS.map(({ key, label }) => (
          <div key={key} className="py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <label className="label">{label}</label>
            <div className="flex gap-2">
              <input defaultValue={settings[key] || ''} id={`setting-${key}`} className="input text-sm" />
              <button
                onClick={() => mutation.mutate({ key, value: document.getElementById(`setting-${key}`).value })}
                className="btn-primary px-4 text-sm"
              >
                {t('save')}
              </button>
            </div>
          </div>
        ))}

        {/* App icon picker */}
        <div className="py-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <label className="label">Иконка приложения</label>
          <div className="flex gap-2 flex-wrap mt-1">
            {APP_ICONS.map(({ name, Icon }) => (
              <button
                key={name}
                onClick={() => mutation.mutate({ key: 'app_icon', value: name })}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-colors ${
                  (settings.app_icon || 'BookOpen') === name
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-950'
                    : 'border-transparent hover:border-primary-400'
                }`}
                style={{ background: (settings.app_icon || 'BookOpen') === name ? undefined : 'var(--bg-secondary)' }}
                title={name}
              >
                <Icon size={20} style={{ color: (settings.app_icon || 'BookOpen') === name ? 'var(--accent)' : 'var(--text-secondary)' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Select settings: locale & theme */}
        {SELECT_SETTINGS.map(({ key, label, options }) => (
          <div key={key} className="py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
            <label className="label">{label}</label>
            <div className="flex gap-2">
              <select
                defaultValue={settings[key] || options[0].value}
                id={`setting-${key}`}
                className="input text-sm"
              >
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button
                onClick={() => mutation.mutate({ key, value: document.getElementById(`setting-${key}`).value })}
                className="btn-primary px-4 text-sm"
              >
                {t('save')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Email notification types */}
      <div className="card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={18} className="text-primary-600" />
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('emailNotifyTypes')}</h2>
        </div>
        <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>{t('emailNotifyTypesHint')}</p>
        <div className="space-y-3">
          {EMAIL_NOTIFY_FIELDS.map(({ key, labelKey }) => (
            <div key={key} className="flex items-center justify-between py-1">
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t(labelKey)}</span>
              <Toggle
                value={(settings[key] ?? 'true') === 'true'}
                onChange={(v) => mutation.mutate({ key, value: v ? 'true' : 'false' })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* SMTP */}
      <div className="card p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Mail size={18} className="text-primary-600" />
            {t('smtpSettings')}
          </h2>
          <Toggle
            value={smtp.smtp_enabled}
            onChange={(v) => setSmtp({ ...smtp, smtp_enabled: v })}
          />
        </div>
        <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
          {t('smtpHint')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SMTP_FIELDS.map(({ key, label, placeholder, type }) => (
            <div key={key} className={key === 'smtp_host' ? '' : ''}>
              <label className="label">{label}</label>
              <input
                type={type || 'text'}
                value={smtp[key]}
                onChange={(e) => setSmtp({ ...smtp, [key]: e.target.value })}
                className="input text-sm"
                placeholder={placeholder}
                autoComplete="off"
              />
            </div>
          ))}
          <div>
            <label className="label">Шифрование</label>
            <select
              value={smtp.smtp_use_ssl ? 'ssl' : smtp.smtp_use_tls ? 'tls' : 'none'}
              onChange={(e) => setSmtp({
                ...smtp,
                smtp_use_tls: e.target.value === 'tls',
                smtp_use_ssl: e.target.value === 'ssl',
              })}
              className="input text-sm"
            >
              <option value="tls">STARTTLS (587)</option>
              <option value="ssl">SSL (465)</option>
              <option value="none">Без шифрования</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-6">
          <button onClick={saveSmtp} className="btn-primary flex items-center gap-2 text-sm">
            <Save size={15} /> {t('save')}
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="input text-sm py-2"
              placeholder="test@example.com"
            />
            <button
              onClick={sendTest}
              disabled={testing || !smtp.smtp_host}
              className="btn-secondary flex items-center gap-2 text-sm whitespace-nowrap disabled:opacity-50"
            >
              {testing
                ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <Send size={14} />}
              {t('sendTestEmail')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
