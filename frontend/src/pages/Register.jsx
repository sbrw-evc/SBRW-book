import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAppStore } from '../store/appStore'
import { useTranslation } from '../hooks/useTranslation'
import toast from 'react-hot-toast'

function Setup2FAWizard({ onDone }) {
  const { t } = useTranslation()
  const { telegramConfigured } = useAppStore()
  const [step, setStep] = useState('choose') 
  const [totpData, setTotpData] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpLoading, setTotpLoading] = useState(false)
  const [tgData, setTgData] = useState(null)
  const [tgLoading, setTgLoading] = useState(false)

  const startTOTP = async () => {
    setTotpLoading(true)
    try {
      const { data } = await authApi.totpSetup()
      setTotpData(data)
      setStep('totp')
    } catch {
      toast.error(t('totpSetupFailed'))
    } finally {
      setTotpLoading(false)
    }
  }

  const enableTOTP = async () => {
    setTotpLoading(true)
    try {
      await authApi.totpEnable(totpCode)
      toast.success(t('totpEnabledToast'))
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('twoFAInvalidCode'))
      setTotpCode('')
    } finally {
      setTotpLoading(false)
    }
  }

  const startTelegram = async () => {
    setTgLoading(true)
    try {
      const { data } = await authApi.telegramLinkInit()
      setTgData(data)
      setStep('telegram')
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'))
    } finally {
      setTgLoading(false)
    }
  }

  if (step === 'choose') return (
    <div className="space-y-4">
      <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
        {t('twoFASetupDesc')}
      </p>
      <button
        onClick={startTOTP}
        disabled={totpLoading}
        className="w-full p-4 rounded-xl border-2 text-left transition-colors hover:border-primary-500"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>🔐 TOTP</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('twoFAMethodTOTPDesc')}</div>
      </button>
      {telegramConfigured && (
        <button
          onClick={startTelegram}
          disabled={tgLoading}
          className="w-full p-4 rounded-xl border-2 text-left transition-colors hover:border-blue-500"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>✈️ Telegram</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('twoFAMethodTelegramDesc')}</div>
        </button>
      )}
      <button onClick={onDone} className="block text-xs text-center w-full mt-2" style={{ color: 'var(--text-muted)' }}>
        {t('twoFASkip')}
      </button>
    </div>
  )

  if (step === 'totp' && totpData) return (
    <div className="space-y-4">
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('totpScanQR')}</p>
      <div className="flex justify-center">
        <img src={totpData.qr_code} alt="QR" className="w-48 h-48 rounded-xl border" style={{ borderColor: 'var(--border)' }} />
      </div>
      <details className="text-xs" style={{ color: 'var(--text-muted)' }}>
        <summary className="cursor-pointer">{t('totpEnterManually')}</summary>
        <code className="block mt-1 p-2 rounded text-xs break-all" style={{ background: 'var(--bg-secondary)' }}>{totpData.secret}</code>
      </details>
      <div>
        <label className="label">{t('totpConfirmCode')}</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
          className="input text-center text-xl tracking-widest"
          placeholder="000000"
          autoFocus
        />
      </div>
      <button onClick={enableTOTP} disabled={totpLoading || totpCode.length < 6} className="btn-primary w-full">
        {totpLoading ? t('loading') : t('twoFAConfirm')}
      </button>
      <button onClick={() => setStep('choose')} className="block text-xs text-center w-full" style={{ color: 'var(--text-muted)' }}>← {t('back')}</button>
    </div>
  )

  if (step === 'telegram' && tgData) return (
    <div className="space-y-4 text-center">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('telegramSendCommand')}
      </p>
      <code className="block p-3 rounded-xl text-sm" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
        /start {tgData.code}
      </code>
      <a href={tgData.bot_url} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2 text-sm">
        {t('telegramOpenBot')}
      </a>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('telegramAfterCommand')}
      </p>
      <button onClick={onDone} className="btn-secondary w-full text-sm">{t('telegramDone')}</button>
      <button onClick={() => setStep('choose')} className="block text-xs text-center w-full" style={{ color: 'var(--text-muted)' }}>← {t('back')}</button>
    </div>
  )

  return null
}

export function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setTokens, setUser } = useAppStore()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState({})
  const [show2FASetup, setShow2FASetup] = useState(false)

  const validate = () => {
    const e = {}
    if (!form.username || form.username.length < 3) e.username = t('passwordMin')
    if (!form.email || !form.email.includes('@')) e.email = 'Invalid email'
    if (!form.password || form.password.length < 8) e.password = t('passwordMin')
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const { data: created } = await authApi.register({
        username: form.username,
        email: form.email,
        password: form.password,
      })
      if (created?.verification_sent) {
        toast.success(t('verificationSent'), { duration: 6000 })
      }
      const { data } = await authApi.login({ username: form.username, password: form.password })
      setTokens(data.access_token, data.refresh_token)
      const { data: me } = await authApi.me()
      setUser(me)
      if (created?.requires_2fa_setup) {
        setShow2FASetup(true)
      } else {
        navigate('/')
      }
    } catch (err) {
      const msg = err.response?.data?.detail || t('error')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (show2FASetup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-600/30">
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('twoFASetupTitle')}</h1>
          </div>
          <div className="card p-6">
            <Setup2FAWizard onDone={() => navigate('/')} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-600/30">
            <BookOpen size={28} className="text-white" />
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('registerTitle')}</h1>
        </div>
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'username', label: t('username'), type: 'text', placeholder: 'username', auto: 'username' },
              { key: 'email', label: 'Email', type: 'email', placeholder: 'email@example.com', auto: 'email' },
              { key: 'password', label: t('password'), type: showPass ? 'text' : 'password', placeholder: '••••••••', auto: 'new-password' },
              { key: 'confirm', label: t('confirmPassword'), type: showPass ? 'text' : 'password', placeholder: '••••••••', auto: 'new-password' },
            ].map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <div className="relative">
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="input"
                    placeholder={f.placeholder}
                    autoComplete={f.auto}
                  />
                  {(f.key === 'password') && (
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
                {errors[f.key] && <p className="text-red-500 text-xs mt-1">{errors[f.key]}</p>}
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? t('loading') : t('registerBtn')}
            </button>
          </form>
          <p className="text-center text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>
            {t('haveAccount')}{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">{t('login')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
