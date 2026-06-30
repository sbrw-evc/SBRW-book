import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BookOpen, Check, Globe, Palette, User, Mail, ChevronRight } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAppStore } from '../store/appStore'
import toast from 'react-hot-toast'

const STEPS = [
  { id: 'locale', icon: Globe },
  { id: 'theme', icon: Palette },
  { id: 'smtp', icon: Mail },
  { id: 'admin', icon: User },
]

const LOCALES = [
  { value: 'ru', label: 'Русский', flag: '🇷🇺' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
]

const THEMES = [
  {
    value: 'light',
    label: 'Светлая',
    labelEn: 'Light',
    preview: 'bg-white border-2 border-gray-200',
    icon: '☀️',
  },
  {
    value: 'dark',
    label: 'Тёмная',
    labelEn: 'Dark',
    preview: 'bg-gray-900 border-2 border-gray-700',
    icon: '🌙',
  },
  {
    value: 'colorful',
    label: 'Цветная',
    labelEn: 'Colorful',
    preview: 'bg-indigo-50 border-2 border-indigo-300',
    icon: '🎨',
  },
]

export function Setup() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setLocale, setTheme } = useAppStore()
  const [step, setStep] = useState(0)
  const [locale, setLocaleState] = useState('ru')
  
  
  const [theme, setThemeState] = useState('dark')
  const [smtp, setSmtp] = useState({
    enabled: false, host: '', port: '587', user: '', password: '', from_addr: '', security: 'tls',
  })
  const [admin, setAdmin] = useState({ username: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)

  const isRu = locale === 'ru'

  
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', 'dark')
    root.classList.add('dark')
  }, [])

  const validate = () => {
    const e = {}
    if (!admin.username || admin.username.length < 3) e.username = isRu ? 'Минимум 3 символа' : 'Min 3 chars'
    if (!admin.email || !admin.email.includes('@')) e.email = isRu ? 'Некорректный email' : 'Invalid email'
    if (!admin.password || admin.password.length < 8) e.password = isRu ? 'Минимум 8 символов' : 'Min 8 chars'
    if (admin.password !== admin.confirm) e.confirm = isRu ? 'Пароли не совпадают' : 'Passwords don\'t match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateSmtp = () => {
    if (!smtp.enabled) return true
    const e = {}
    if (!smtp.host) e.smtpHost = isRu ? 'Укажите сервер' : 'Host required'
    if (!smtp.port || isNaN(+smtp.port)) e.smtpPort = isRu ? 'Некорректный порт' : 'Invalid port'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => {
    if (step === 2 && !validateSmtp()) return
    setStep(step + 1)
  }

  const handleFinish = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        locale,
        theme,
        admin_username: admin.username,
        admin_email: admin.email,
        admin_password: admin.password,
      }
      if (smtp.enabled && smtp.host) {
        payload.smtp = {
          enabled: true,
          host: smtp.host,
          port: +smtp.port || 587,
          user: smtp.user,
          password: smtp.password,
          from_addr: smtp.from_addr || smtp.user,
          use_tls: smtp.security === 'tls',
          use_ssl: smtp.security === 'ssl',
        }
      }
      await authApi.completeSetup(payload)
      
      queryClient.setQueryData(['setup-status'], { completed: true })
      setLocale(locale)
      
      setTheme(theme)
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      const msg = err.response?.data?.detail || (isRu ? 'Ошибка настройки' : 'Setup error')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {isRu ? 'Настройка завершена!' : 'Setup complete!'}
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>{isRu ? 'Перенаправление...' : 'Redirecting...'}</p>
        </div>
      </div>
    )
  }

  const inputField = (value, onChange, placeholder, type = 'text', error = null, autoComplete) => (
    <div>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input"
        autoComplete={autoComplete}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f1117 0%, #1a1d29 100%)' }}
    >
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-600/30">
            <BookOpen size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {isRu ? 'Добро пожаловать' : 'Welcome'}
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            {isRu ? 'Настройте приложение перед началом работы' : 'Configure your app before getting started'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.id} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  i < step ? 'bg-primary-600 text-white' :
                  i === step ? 'bg-primary-600/20 text-primary-400 ring-2 ring-primary-600' :
                  'bg-gray-800 text-gray-500'
                }`}>
                  {i < step ? <Check size={14} /> : <Icon size={14} />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-10 h-0.5 mx-1 transition-colors ${i < step ? 'bg-primary-600' : 'bg-gray-700'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div className="card p-8">
          {/* Step 1: Locale */}
          {step === 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>
                {isRu ? 'Выберите язык' : 'Choose Language'}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {LOCALES.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setLocaleState(l.value)}
                    className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                      locale === l.value
                        ? 'border-primary-600 bg-primary-600/10'
                        : 'border-[var(--border)] hover:border-gray-500'
                    }`}
                  >
                    <span className="text-4xl">{l.flag}</span>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{l.label}</span>
                    {locale === l.value && <Check size={16} className="text-primary-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Theme — selection only, applied after setup finishes */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>
                {isRu ? 'Выберите оформление' : 'Choose Theme'}
              </h2>
              <p className="text-xs text-center mb-6" style={{ color: 'var(--text-muted)' }}>
                {isRu ? 'Тема применится после завершения настройки' : 'The theme will apply after setup is finished'}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {THEMES.map((th) => (
                  <button
                    key={th.value}
                    onClick={() => setThemeState(th.value)}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                      theme === th.value
                        ? 'border-primary-600 bg-primary-600/10'
                        : 'border-[var(--border)] hover:border-gray-500'
                    }`}
                  >
                    <div className={`w-12 h-8 rounded-lg ${th.preview}`} />
                    <span className="text-xl">{th.icon}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {isRu ? th.label : th.labelEn}
                    </span>
                    {theme === th.value && <Check size={14} className="text-primary-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: SMTP (optional) */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>
                {isRu ? 'Почтовые уведомления' : 'Email Notifications'}
              </h2>
              <p className="text-xs text-center mb-6" style={{ color: 'var(--text-muted)' }}>
                {isRu
                  ? 'SMTP для подтверждения регистрации, сброса пароля и уведомлений. Можно настроить позже в админ-панели.'
                  : 'SMTP for registration confirmation, password reset and notifications. You can configure it later in the admin panel.'}
              </p>

              <label className="flex items-center justify-between mb-4 cursor-pointer">
                <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                  {isRu ? 'Настроить SMTP сейчас' : 'Configure SMTP now'}
                </span>
                <button
                  type="button"
                  onClick={() => setSmtp({ ...smtp, enabled: !smtp.enabled })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${smtp.enabled ? 'bg-primary-600' : 'bg-gray-600'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${smtp.enabled ? 'left-7' : 'left-1'}`} />
                </button>
              </label>

              {smtp.enabled && (
                <div className="space-y-3">
                  <div className="grid grid-cols-[1fr_100px] gap-3">
                    {inputField(smtp.host, (e) => setSmtp({ ...smtp, host: e.target.value }), 'smtp.gmail.com', 'text', errors.smtpHost)}
                    {inputField(smtp.port, (e) => setSmtp({ ...smtp, port: e.target.value }), '587', 'text', errors.smtpPort)}
                  </div>
                  {inputField(smtp.user, (e) => setSmtp({ ...smtp, user: e.target.value }), isRu ? 'Логин (email)' : 'Login (email)')}
                  {inputField(smtp.password, (e) => setSmtp({ ...smtp, password: e.target.value }), isRu ? 'Пароль' : 'Password', 'password', null, 'new-password')}
                  {inputField(smtp.from_addr, (e) => setSmtp({ ...smtp, from_addr: e.target.value }), isRu ? 'Адрес отправителя (необязательно)' : 'From address (optional)')}
                  <select
                    value={smtp.security}
                    onChange={(e) => setSmtp({ ...smtp, security: e.target.value })}
                    className="input"
                  >
                    <option value="tls">STARTTLS (587)</option>
                    <option value="ssl">SSL (465)</option>
                    <option value="none">{isRu ? 'Без шифрования' : 'No encryption'}</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Admin */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>
                {isRu ? 'Создайте аккаунт администратора' : 'Create Admin Account'}
              </h2>
              <div className="space-y-4">
                {[
                  { key: 'username', label: isRu ? 'Имя пользователя' : 'Username', type: 'text', placeholder: 'admin' },
                  { key: 'email', label: 'Email', type: 'email', placeholder: 'admin@example.com' },
                  { key: 'password', label: isRu ? 'Пароль' : 'Password', type: 'password', placeholder: '••••••••' },
                  { key: 'confirm', label: isRu ? 'Подтвердите пароль' : 'Confirm Password', type: 'password', placeholder: '••••••••' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="label">{field.label}</label>
                    <input
                      type={field.type}
                      value={admin[field.key]}
                      onChange={(e) => setAdmin({ ...admin, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="input"
                      autoComplete={field.key === 'password' || field.key === 'confirm' ? 'new-password' : undefined}
                    />
                    {errors[field.key] && (
                      <p className="text-red-500 text-xs mt-1">{errors[field.key]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="btn-secondary disabled:opacity-0"
            >
              {isRu ? 'Назад' : 'Back'}
            </button>

            {step < STEPS.length - 1 ? (
              <button onClick={handleNext} className="btn-primary flex items-center gap-2">
                {step === 2 && !smtp.enabled
                  ? (isRu ? 'Пропустить' : 'Skip')
                  : (isRu ? 'Далее' : 'Next')} <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={handleFinish} disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? (isRu ? 'Сохранение...' : 'Saving...') : (isRu ? 'Завершить' : 'Finish')}
                {!loading && <Check size={16} />}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          {isRu ? `Шаг ${step + 1} из ${STEPS.length}` : `Step ${step + 1} of ${STEPS.length}`}
        </p>
      </div>
    </div>
  )
}
