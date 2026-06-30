import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAppStore } from '../store/appStore'
import { useTranslation } from '../hooks/useTranslation'
import toast from 'react-hot-toast'

const MAIN_SITE = import.meta.env.VITE_MAIN_SITE_URL || '/'

export function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setTokens, setUser } = useAppStore()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.login({ username: form.username, password: form.password })
      setTokens(data.access_token, data.refresh_token)
      const { data: me } = await authApi.me()
      setUser(me)
      if (me.role !== 'admin') {
        toast.error('Доступ запрещён. Требуются права администратора.')
        useAppStore.getState().logout()
        return
      }
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.detail || t('loginError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-600/30">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Панель администратора</h1>
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
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? t('loading') : 'Войти в панель'}
            </button>
          </form>
          <div className="text-center mt-4">
            <a href={MAIN_SITE} className="text-sm" style={{ color: 'var(--text-muted)' }}>
              ← Вернуться на сайт
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
