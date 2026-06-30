import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen, Mail, KeyRound, Check, X } from 'lucide-react'
import { authApi } from '../api/auth'
import { useTranslation } from '../hooks/useTranslation'
import toast from 'react-hot-toast'

function AuthShell({ title, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-600/30">
            <BookOpen size={28} className="text-white" />
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>SBRW Books</p>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  )
}

export function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title={t('forgotPasswordTitle')}>
      {sent ? (
        <div className="text-center py-4">
          <Mail size={36} className="mx-auto mb-3 text-primary-600" />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('resetLinkSent')}</p>
          <Link to="/login" className="inline-block mt-4 text-primary-600 text-sm font-medium hover:underline">
            {t('loginBtn')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('forgotPasswordHint')}</p>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? t('loading') : t('sendResetLink')}
          </button>
          <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Link to="/login" className="text-primary-600 font-medium hover:underline">{t('loginBtn')}</Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) { toast.error(t('passwordMin')); return }
    if (password !== confirm) { toast.error(t('passwordsDontMatch')); return }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      toast.success(t('passwordChanged'))
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.detail || t('invalidToken'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthShell title={t('resetPasswordTitle')}>
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>{t('invalidToken')}</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('resetPasswordTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">{t('newPassword')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <label className="label">{t('confirmPassword')}</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <KeyRound size={16} />
          {loading ? t('loading') : t('resetPasswordBtn')}
        </button>
      </form>
    </AuthShell>
  )
}

export function VerifyEmail() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    authApi.verifyEmail(token)
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <AuthShell title={t('emailVerification')}>
      <div className="text-center py-6">
        {status === 'loading' && (
          <span className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        )}
        {status === 'ok' && (
          <>
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check size={28} className="text-green-600" />
            </div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('emailVerified')}</p>
            <Link to="/login" className="inline-block mt-3 text-primary-600 text-sm font-medium hover:underline">
              {t('loginBtn')}
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <X size={28} className="text-red-600" />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('invalidToken')}</p>
          </>
        )}
      </div>
    </AuthShell>
  )
}
