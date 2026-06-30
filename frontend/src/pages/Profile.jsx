import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersApi, authApi } from '../api/auth'
import { useAppStore } from '../store/appStore'
import { useTranslation } from '../hooks/useTranslation'
import { AvatarCropModal } from '../components/ui/AvatarCropModal'
import { User, Save, Camera, ArrowLeft, ShieldCheck, MessageCircle, QrCode, Unlink, ExternalLink, Monitor, LogOut, Eye, Palette, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className="w-10 h-5 rounded-full transition-colors flex-shrink-0 relative cursor-pointer"
      style={{ background: value ? 'var(--accent)' : 'var(--border)' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
        style={{ left: value ? '22px' : '2px' }}
      />
    </div>
  )
}

export function Profile() {
  const { t } = useTranslation()
  const { user, setUser, setTheme, setLocale, telegramConfigured } = useAppStore()
  const avatarInputRef = useRef(null)

  const [form, setForm] = useState({
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    patronymic: user?.patronymic || '',
    about: user?.about || '',
    locale: user?.locale || 'ru',
    theme: user?.theme || 'dark',
    password: '',
    confirm: '',
    show_full_name: user?.show_full_name ?? false,
    show_reading_activity: user?.show_reading_activity ?? false,
    show_online_status: user?.show_online_status ?? true,
  })
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)

  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data) => usersApi.updateMe(data),
    onSuccess: (res) => {
      setUser(res.data)
      setTheme(res.data.theme)
      setLocale(res.data.locale)
      setForm((prev) => ({
        ...prev,
        email:                 res.data.email        || '',
        first_name:            res.data.first_name   || '',
        last_name:             res.data.last_name    || '',
        patronymic:            res.data.patronymic   || '',
        about:                 res.data.about        || '',
        locale:                res.data.locale       || 'ru',
        theme:                 res.data.theme        || 'dark',
        show_full_name:        res.data.show_full_name        ?? false,
        show_reading_activity: res.data.show_reading_activity ?? false,
        show_online_status:    res.data.show_online_status    ?? true,
        password: '',
        confirm:  '',
      }))
      qc.invalidateQueries({ queryKey: ['user-profile', res.data.id] })
      toast.success(t('success'))
    },
    onError: () => toast.error(t('error')),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (form.password && form.password !== form.confirm) {
      toast.error(t('passwordsDontMatch'))
      return
    }
    const data = {
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
      patronymic: form.patronymic,
      about: form.about,
      locale: form.locale,
      theme: form.theme,
      show_full_name: form.show_full_name,
      show_reading_activity: form.show_reading_activity,
      show_online_status: form.show_online_status,
    }
    if (form.password) data.password = form.password
    mutation.mutate(data)
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
  }

  const handleCropSave = async (blob) => {
    setCropSrc((prev) => { URL.revokeObjectURL(prev); return null })
    setAvatarLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', blob, 'avatar.jpg')
      const { data } = await usersApi.uploadAvatar(fd)
      setUser({ ...user, avatar: data.avatar })
      qc.invalidateQueries({ queryKey: ['user-profile', user.id] })
      toast.success(t('success'))
    } catch {
      toast.error(t('error'))
    } finally {
      setAvatarLoading(false)
    }
  }

  const displayName = [user?.last_name, user?.first_name, user?.patronymic].filter(Boolean).join(' ') || user?.username

  
  const [totpSetup, setTotpSetup] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpDisableCode, setTotpDisableCode] = useState('')
  const [showTotpDisable, setShowTotpDisable] = useState(false)

  const totpSetupMutation = useMutation({
    mutationFn: () => authApi.totpSetup(),
    onSuccess: (res) => setTotpSetup(res.data),
    onError: () => toast.error(t('error')),
  })
  const totpEnableMutation = useMutation({
    mutationFn: (code) => authApi.totpEnable(code),
    onSuccess: (res) => { setUser(res.data); setTotpSetup(null); setTotpCode(''); toast.success(t('totpEnabledToast')) },
    onError: (err) => { toast.error(err.response?.data?.detail || t('twoFAInvalidCode')); setTotpCode('') },
  })
  const totpDisableMutation = useMutation({
    mutationFn: (code) => authApi.totpDisable(code),
    onSuccess: (res) => { setUser(res.data); setShowTotpDisable(false); setTotpDisableCode(''); toast.success(t('totpDisabledToast')) },
    onError: (err) => { toast.error(err.response?.data?.detail || t('twoFAInvalidCode')); setTotpDisableCode('') },
  })

  
  const { data: tgStatus, refetch: refetchTg } = useQuery({
    queryKey: ['telegram-status'],
    queryFn: () => authApi.telegramStatus().then((r) => r.data),
    enabled: telegramConfigured,
  })
  const [tgLinkData, setTgLinkData] = useState(null)
  const tgLinkMutation = useMutation({
    mutationFn: () => authApi.telegramLinkInit(),
    onSuccess: (res) => setTgLinkData(res.data),
    onError: (err) => toast.error(err.response?.data?.detail || t('error')),
  })
  const tgUnlinkMutation = useMutation({
    mutationFn: () => authApi.telegramUnlink(),
    onSuccess: () => { refetchTg(); setTgLinkData(null); setUser({ ...user, telegram_2fa_enabled: false }); toast.success(t('telegramUnlinkedToast')) },
    onError: () => toast.error(t('error')),
  })
  const tgToggle2FAMutation = useMutation({
    mutationFn: (enable) => authApi.telegramToggle2FA(enable),
    onSuccess: (res) => { setUser(res.data); refetchTg() },
    onError: () => toast.error(t('error')),
  })

  
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => authApi.listSessions().then((r) => r.data),
  })
  const revokeSessionMutation = useMutation({
    mutationFn: (id) => authApi.revokeSession(id),
    onSuccess: () => { refetchSessions(); toast.success(t('sessionsTerminatedToast')) },
    onError: () => toast.error(t('error')),
  })
  const revokeAllMutation = useMutation({
    mutationFn: () => authApi.revokeOtherSessions(),
    onSuccess: () => { refetchSessions(); toast.success(t('sessionsAllTerminatedToast')) },
    onError: () => toast.error(t('error')),
  })

  return (
    <div className="max-w-5xl mx-auto">

      <div className="mb-6">
        {user?.id && (
          <Link to={`/users/${user.id}`} className="flex items-center gap-1.5 text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={15} /> {t('myProfile')}
          </Link>
        )}
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('profile')}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">

          {/* ── Card 1: Profile info ─────────────────────────────────────── */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User size={15} style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('profile')}</h2>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary-700 dark:text-primary-300 text-2xl font-bold">
                      {user?.username?.[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarLoading}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary-600 hover:bg-primary-700 rounded-full flex items-center justify-center shadow-md transition-colors disabled:opacity-50"
                >
                  {avatarLoading
                    ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera size={11} className="text-white" />}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>@{user?.username}</p>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${
                  user?.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                  user?.role === 'moderator' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                }`}>
                  {t(`role${user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}`)}
                </span>
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('lastName')}</label>
                <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="input" placeholder={t('lastName')} />
              </div>
              <div>
                <label className="label">{t('firstName')}</label>
                <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="input" placeholder={t('firstName')} />
              </div>
            </div>
            <div>
              <label className="label">{t('patronymic')}</label>
              <input type="text" value={form.patronymic} onChange={(e) => setForm({ ...form, patronymic: e.target.value })} className="input" placeholder={t('patronymic')} />
            </div>
            <div>
              <label className="label">{t('about')}</label>
              <textarea value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} className="input resize-none" rows={3} placeholder={t('aboutPlaceholder')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
            </div>

            <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center gap-2 w-full justify-center">
              <Save size={15} />
              {mutation.isPending ? t('loading') : t('save')}
            </button>
          </div>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Card 2: Appearance */}
            <div className="card p-6 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Palette size={15} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('language')} & {t('theme')}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('language')}</label>
                  <select value={form.locale} onChange={(e) => { setForm({ ...form, locale: e.target.value }); setLocale(e.target.value) }} className="input">
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('theme')}</label>
                  <select value={form.theme} onChange={(e) => { setForm({ ...form, theme: e.target.value }); setTheme(e.target.value) }} className="input">
                    <option value="light">{t('themeLight')}</option>
                    <option value="dark">{t('themeDark')}</option>
                    <option value="colorful">{t('themeColorful')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 3: Privacy */}
            <div className="card p-6 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Eye size={15} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('privacySettings')}</h2>
              </div>
              {[
                { key: 'show_full_name',        label: t('showFullName') },
                { key: 'show_reading_activity', label: t('showReadingActivity') },
                { key: 'show_online_status',    label: t('showOnlineStatus') },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <Toggle value={form[key]} onChange={(v) => setForm((f) => ({ ...f, [key]: v }))} />
                </div>
              ))}
            </div>

            {/* Card 4: Security — password + TOTP + Telegram */}
            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Lock size={15} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('changePassword')}</h2>
              </div>

              {/* Password change */}
              <div className="space-y-3">
                <div>
                  <label className="label">{t('newPassword')}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">{t('confirmPassword')}</label>
                  <input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className="input" />
                </div>
              </div>

              {/* TOTP 2FA */}
              <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} style={{ color: 'var(--accent)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('totpTitle')}</p>
                </div>
                {user?.totp_enabled ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#16a34a' }}>{t('totpEnabled')}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Google Authenticator / Authy</span>
                    </div>
                    {!showTotpDisable ? (
                      <button type="button" onClick={() => setShowTotpDisable(true)} className="text-xs text-red-500 hover:underline">
                        {t('totpDisableBtn')}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input type="text" inputMode="numeric" maxLength={6} value={totpDisableCode} onChange={(e) => setTotpDisableCode(e.target.value.replace(/\D/g, ''))} className="input text-center tracking-widest text-lg w-32" placeholder="000000" autoFocus />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => totpDisableMutation.mutate(totpDisableCode)} disabled={totpDisableMutation.isPending || totpDisableCode.length < 6} className="btn-primary text-xs px-3 py-1.5">
                            {totpDisableMutation.isPending ? '...' : t('totpDisableBtn')}
                          </button>
                          <button type="button" onClick={() => { setShowTotpDisable(false); setTotpDisableCode('') }} className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('cancel')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : totpSetup ? (
                  <div className="space-y-3">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('totpScanQR')}</p>
                    <img src={totpSetup.qr_code} alt="QR" className="w-36 h-36 rounded-xl border" style={{ borderColor: 'var(--border)' }} />
                    <details className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <summary className="cursor-pointer">{t('totpEnterManually')}</summary>
                      <code className="block mt-1 p-2 rounded text-xs break-all" style={{ background: 'var(--bg-secondary)' }}>{totpSetup.secret}</code>
                    </details>
                    <input type="text" inputMode="numeric" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} className="input text-center tracking-widest text-lg w-32" placeholder="000000" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => totpEnableMutation.mutate(totpCode)} disabled={totpEnableMutation.isPending || totpCode.length < 6} className="btn-primary text-xs px-3 py-1.5">
                        {totpEnableMutation.isPending ? '...' : t('confirm')}
                      </button>
                      <button type="button" onClick={() => { setTotpSetup(null); setTotpCode('') }} className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => totpSetupMutation.mutate()} disabled={totpSetupMutation.isPending} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                    <QrCode size={13} />
                    {totpSetupMutation.isPending ? t('totpGenerating') : t('totpSetupBtn')}
                  </button>
                )}
              </div>

              {/* Telegram */}
              {telegramConfigured && (
                <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} style={{ color: 'var(--accent)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('telegramTitle')}</p>
                  </div>
                  {tgStatus?.linked ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#16a34a' }}>{t('telegramLinked')}</span>
                        {tgStatus.username && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>@{tgStatus.username}</span>}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('telegramUse2FA')}</span>
                        <Toggle value={!!tgStatus.telegram_2fa_enabled} onChange={(v) => tgToggle2FAMutation.mutate(v)} />
                      </div>
                      <button type="button" onClick={() => tgUnlinkMutation.mutate()} disabled={tgUnlinkMutation.isPending} className="flex items-center gap-1.5 text-xs text-red-500 hover:underline">
                        <Unlink size={12} /> {t('telegramUnlinkBtn')}
                      </button>
                    </div>
                  ) : tgLinkData ? (
                    <div className="space-y-3">
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('telegramSendCommand')}</p>
                      <code className="block p-2 rounded text-sm text-center font-mono" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                        {tgLinkData.code}
                      </code>
                      {tgLinkData.core_bot_url && (
                        <a href={tgLinkData.core_bot_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-500 hover:underline">
                          <ExternalLink size={12} /> {t('telegramOpenBot')}
                        </a>
                      )}
                      <button type="button" onClick={() => refetchTg()} className="btn-secondary text-xs px-3 py-1.5">{t('telegramCheckLink')}</button>
                      <button type="button" onClick={() => setTgLinkData(null)} className="text-xs block" style={{ color: 'var(--text-muted)' }}>{t('cancel')}</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => tgLinkMutation.mutate()} disabled={tgLinkMutation.isPending} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                      <MessageCircle size={13} />
                      {tgLinkMutation.isPending ? t('telegramLoading') : t('telegramLinkBtn')}
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </form>

      {/* ── Card 5: Active sessions (full width) ─────────────────────────── */}
      <div className="card p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Monitor size={15} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('sessionsTitle')}</h2>
          </div>
          {sessions && sessions.filter((s) => !s.is_current).length > 0 && (
            <button onClick={() => revokeAllMutation.mutate()} disabled={revokeAllMutation.isPending} className="text-xs text-red-500 hover:underline flex items-center gap-1">
              <LogOut size={12} /> {t('sessionsTerminateAll')}
            </button>
          )}
        </div>
        {sessionsLoading ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('sessionsLoading')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(sessions || []).map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {[s.device_os, s.device_browser].filter(Boolean).join(', ') || t('sessionsUnknown')}
                    </span>
                    {s.is_current && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: '#dcfce7', color: '#16a34a' }}>
                        {t('sessionsCurrent')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {[s.country, s.city].filter(Boolean).join(', ') || t('sessionsUnknown')}
                    {s.ip_address ? ` (${s.ip_address})` : ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {t('sessionsLoginAt')}: {new Date(s.created_at).toLocaleString()}
                  </p>
                </div>
                {!s.is_current && (
                  <button onClick={() => revokeSessionMutation.mutate(s.id)} disabled={revokeSessionMutation.isPending} className="flex-shrink-0 text-xs text-red-500 hover:underline whitespace-nowrap">
                    {t('sessionsTerminate')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {cropSrc && (
        <AvatarCropModal
          src={cropSrc}
          onClose={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null) }}
          onSave={handleCropSave}
        />
      )}
    </div>
  )
}
