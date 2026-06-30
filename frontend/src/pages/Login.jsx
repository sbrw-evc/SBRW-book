import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, Eye, EyeOff, ShieldCheck, RefreshCw } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAppStore } from '../store/appStore'
import { useTranslation } from '../hooks/useTranslation'
import toast from 'react-hot-toast'

export function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { setTokens, setUser } = useAppStore()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  
  const [twoFA, setTwoFA] = useState(null) 
  const [twoFAMethod, setTwoFAMethod] = useState('')
  const [twoFACode, setTwoFACode] = useState('')
  const [twoFALoading, setTwoFALoading] = useState(false)
  const [resending, setResending] = useState(false)

  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.login({ username: form.username, password: form.password })
      if (data.requires_2fa) {
        setTwoFA({ session_id: data.session_id, methods: data.methods })
        setTwoFAMethod(data.methods[0])
        return
      }
      setTokens(data.access_token, data.refresh_token)
      const { data: me } = await authApi.me()
      setUser(me)
      navigate(from, { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail || t('loginError')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handle2FASubmit = async (e) => {
    e.preventDefault()
    if (!twoFACode.trim()) return
    setTwoFALoading(true)
    try {
      const { data } = await authApi.verify2FA({
        session_id: twoFA.session_id,
        code: twoFACode.trim(),
        method: twoFAMethod,
      })
      setTokens(data.access_token, data.refresh_token)
      const { data: me } = await authApi.me()
      setUser(me)
      navigate(from, { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail || t('twoFAInvalidCode')
      toast.error(msg)
      setTwoFACode('')
    } finally {
      setTwoFALoading(false)
    }
  }

  const handleResendTelegram = async () => {
    setResending(true)
    try {
      await authApi.resend2FA(twoFA.session_id)
      toast.success(t('twoFAResent'))
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'))
    } finally {
      setResending(false)
    }
  }

  if (twoFA) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-600/30">
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('twoFATitle')}</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {twoFAMethod === 'telegram' ? t('twoFASubtitleTelegram') : t('twoFASubtitleTOTP')}
            </p>
          </div>

          <div className="card p-6">
            {twoFA.methods.length > 1 && (
              <div className="flex gap-2 mb-4">
                {twoFA.methods.map((m) => (
                  <button
                    key={m}
                    onClick={() => { setTwoFAMethod(m); setTwoFACode('') }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      twoFAMethod === m ? 'bg-primary-600 text-white' : 'border'
                    }`}
                    style={{ borderColor: twoFAMethod !== m ? 'var(--border)' : undefined, color: twoFAMethod !== m ? 'var(--text-secondary)' : undefined }}
                  >
                    {m === 'totp' ? `🔐 TOTP` : `✈️ Telegram`}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handle2FASubmit} className="space-y-4">
              <div>
                <label className="label">{t('twoFACode')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                  className="input text-center text-2xl tracking-widest"
                  placeholder="000000"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={twoFALoading || !twoFACode} className="btn-primary w-full py-3">
                {twoFALoading ? t('loading') : t('twoFAConfirm')}
              </button>
            </form>

            {twoFAMethod === 'telegram' && (
              <button
                onClick={handleResendTelegram}
                disabled={resending}
                className="flex items-center gap-1.5 text-sm mt-3 mx-auto disabled:opacity-50"
                style={{ color: 'var(--text-muted)' }}
              >
                <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
                {t('twoFAResend')}
              </button>
            )}

            <button
              onClick={() => { setTwoFA(null); setTwoFACode('') }}
              className="block text-sm text-center mt-3 w-full"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('twoFABack')}
            </button>
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('loginTitle')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>SBRW Books</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('username')}</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="input"
                placeholder="username"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="label">{t('password')}</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">
                {t('forgotPassword')}
              </Link>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? t('loading') : t('loginBtn')}
            </button>
          </form>
          <p className="text-center text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>
            {t('noAccount')}{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              {t('register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
