import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/auth'
import { useAppStore } from '../../store/appStore'
import { useTranslation } from '../../hooks/useTranslation'
import { PageSpinner } from '../../components/ui/Spinner'
import { Navigate } from 'react-router-dom'
import { Mail, Send, Save, Bell, BookOpen, Library, BookMarked, BookText, Feather, PenLine, MessageCircle, ShieldCheck, Upload, Shield, Wifi, Plus, X, RefreshCw, RotateCcw, CheckCircle, Zap, Settings, Globe, Lock, Sparkles, BrainCircuit, FlaskConical, ChevronDown } from 'lucide-react'
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
  { key: 'email_notify_verify',     labelKey: 'emailNotifyVerify' },
  { key: 'email_notify_reset',      labelKey: 'emailNotifyReset' },
  { key: 'email_notify_series',     labelKey: 'emailNotifySeries' },
  { key: 'email_notify_newsletter', labelKey: 'emailNotifyNewsletter' },
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

function timeAgo(iso, t) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 5)  return t('timeJustNow')
  if (secs < 60) return `${secs} ${t('timeSecondsAgo')}`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} ${t('timeMinutesAgo')}`
  return `${Math.floor(mins / 60)} ${t('timeHoursAgo')}`
}

function StatusDot({ up, unknown }) {
  if (unknown) return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--text-muted)' }} />
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: up ? '#22c55e' : '#ef4444' }} />
}

function TelegramBotStatus({ token }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState(undefined)

  useEffect(() => {
    if (!token) { setStatus(null); return }
    setStatus(undefined)
    fetch(`https://api.telegram.org/bot${token}/getMe`)
      .then((r) => r.json())
      .then((d) => setStatus(d.ok ? d.result : null))
      .catch(() => setStatus(null))
  }, [token])

  if (!token) return null

  if (status === undefined) return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
      <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      {t('vpnStatusChecking')}
    </div>
  )

  if (!status) return (
    <div className="flex items-center gap-1.5 text-xs text-red-500">
      <StatusDot up={false} />
      {t('vpnStatusUnreachable')}
    </div>
  )

  return (
    <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
      <StatusDot up={true} />
      <span>@{status.username}</span>
      <span style={{ color: 'var(--text-muted)' }}>·</span>
      <span style={{ color: 'var(--text-secondary)' }}>{status.first_name}</span>
      {status.is_bot && (
        <span className="px-1 rounded text-xs" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>bot</span>
      )}
    </div>
  )
}

function VpnStatus() {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try { const { data: d } = await adminApi.getVpnStatus(); setData(d) }
    catch { } finally { setLoading(false) }
  }

  useEffect(() => { refresh(); const id = setInterval(refresh, 30000); return () => clearInterval(id) }, [])

  if (!data) return null

  const rows = [
    { label: t('vpnStatusBots'),       up: data.bots_online, unknown: false, detail: data.bots_online && data.last_seen ? timeAgo(data.last_seen, t) : null },
    { label: t('vpnStatusVpn'),        up: data.vpn_up,      unknown: data.vpn_up === null || !data.bots_online, detail: data.vpn_up && data.vpn_peers > 0 ? `${data.vpn_peers} peer` : data.apply_error || null },
    { label: t('vpnStatusTelegramApi'), up: data.telegram_ok === true, unknown: !data.bots_online || data.telegram_ok === null || data.telegram_ok === undefined, detail: null },
  ]

  return (
    <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('vpnStatusTitle')}</span>
        <button onClick={refresh} disabled={loading} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40" title={t('dockerRefresh')}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
      {rows.map(({ label, up, unknown, detail }) => (
        <div key={label} className="flex items-center gap-2 text-xs">
          <StatusDot up={up} unknown={unknown} />
          <span style={{ color: 'var(--text-primary)' }}>{label}</span>
          {detail && <span style={{ color: unknown || !up ? '#ef4444' : 'var(--text-muted)' }}>— {detail}</span>}
          {!unknown && <span className="ml-auto" style={{ color: up ? '#22c55e' : '#ef4444' }}>{up ? t('vpnStatusOk') : t('vpnStatusNo')}</span>}
        </div>
      ))}
      {data.last_seen && (
        <p className="text-xs pt-1" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          {t('vpnStatusUpdated')}: {timeAgo(data.last_seen, t)}
        </p>
      )}
    </div>
  )
}

async function tgCall(token, method, payload = {}) {
  const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  const data = await resp.json()
  if (!data.ok) throw new Error(data.description || 'Telegram API error')
  return data
}

function BotProfileEditor({ token }) {
  const { t } = useTranslation()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!token) return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('enterTokenFirst')}</p>

  const load = async () => {
    setLoading(true)
    try {
      const [cmds, desc, shortDesc] = await Promise.all([
        tgCall(token, 'getMyCommands'),
        tgCall(token, 'getMyDescription'),
        tgCall(token, 'getMyShortDescription'),
      ])
      setProfile({ commands: cmds.result || [], description: desc.result?.description || '', short_description: shortDesc.result?.short_description || '' })
    } catch (err) { toast.error(err.message || t('error')) }
    finally { setLoading(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        tgCall(token, 'setMyCommands', { commands: profile.commands.filter((c) => c.command) }),
        tgCall(token, 'setMyDescription', { description: profile.description }),
        tgCall(token, 'setMyShortDescription', { short_description: profile.short_description }),
      ])
      toast.success(t('botProfileSaved'))
    } catch (err) { toast.error(err.message || t('error')) }
    finally { setSaving(false) }
  }

  const addCmd    = () => setProfile((p) => ({ ...p, commands: [...p.commands, { command: '', description: '' }] }))
  const updateCmd = (i, field, val) => setProfile((p) => ({ ...p, commands: p.commands.map((c, idx) => idx === i ? { ...c, [field]: val } : c) }))
  const removeCmd = (i) => setProfile((p) => ({ ...p, commands: p.commands.filter((_, idx) => idx !== i) }))

  if (!profile) return (
    <button onClick={load} disabled={loading} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50">
      {loading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {t('loadBotProfile')}
    </button>
  )

  return (
    <div className="space-y-4">
      <div>
        <label className="label">{t('botDescription')}</label>
        <textarea value={profile.description} onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))} className="input text-sm resize-none" rows={3} maxLength={512} placeholder={t('botDescriptionPlaceholder')} />
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{profile.description.length}/512</p>
      </div>
      <div>
        <label className="label">{t('botAbout')}</label>
        <input type="text" value={profile.short_description} onChange={(e) => setProfile((p) => ({ ...p, short_description: e.target.value }))} className="input text-sm" maxLength={120} placeholder={t('botAboutPlaceholder')} />
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{profile.short_description.length}/120</p>
      </div>
      <div>
        <label className="label">{t('botCommands')}</label>
        <div className="space-y-2 mb-2">
          {profile.commands.map((cmd, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>/</span>
              <input value={cmd.command} onChange={(e) => updateCmd(i, 'command', e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())} className="input text-sm font-mono w-28" placeholder={t('commandPlaceholder')} maxLength={32} />
              <input value={cmd.description} onChange={(e) => updateCmd(i, 'description', e.target.value)} className="input text-sm flex-1" placeholder={t('commandDescPlaceholder')} maxLength={256} />
              <button onClick={() => removeCmd(i)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
            </div>
          ))}
        </div>
        <button onClick={addCmd} className="btn-secondary text-xs flex items-center gap-1">
          <Plus size={13} /> {t('addCommand')}
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
          {saving ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
          {t('saveToTelegram')}
        </button>
        <button onClick={() => setProfile(null)} className="btn-secondary text-sm">{t('cancel')}</button>
      </div>
    </div>
  )
}

const LLM_PROVIDERS = [
  { value: 'local',    label: 'Локальная (Ollama)' },
  { value: 'claude',   label: 'Claude (Anthropic)' },
  { value: 'openai',   label: 'OpenAI (ChatGPT)' },
  { value: 'gemini',   label: 'Gemini (Google)' },
  { value: 'deepseek', label: 'DeepSeek' },
]

const LLM_DEFAULT_MODELS = {
  local:    'qwen2.5:1.5b',
  claude:   'claude-haiku-4-5-20251001',
  openai:   'gpt-4o-mini',
  gemini:   'gemini-2.0-flash',
  deepseek: 'deepseek-chat',
}

function LLMSettingsCard({ settings, qc, t }) {
  const [enabled, setEnabled] = useState(settings.llm_enabled === 'true')
  const [provider, setProvider] = useState(settings.llm_provider || 'local')
  const [apiKey, setApiKey] = useState(settings.llm_api_key || '')
  const [model, setModel] = useState(settings.llm_model || '')
  const [ollamaUrl, setOllamaUrl] = useState(settings.llm_ollama_url || 'http://ollama:11434')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [ollamaModels, setOllamaModels] = useState([])
  const [showPull, setShowPull] = useState(false)
  const [pullModel, setPullModel] = useState('')
  const [pulling, setPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState(null)
  

  const { data: llmStatus } = useQuery({
    queryKey: ['admin', 'llm', 'status'],
    queryFn: () => adminApi.getLLMStatus().then((r) => r.data),
    refetchInterval: 30000,
  })

  const loadOllamaModels = async () => {
    try {
      const { data } = await adminApi.getOllamaModels()
      setOllamaModels(data.models || [])
    } catch { setOllamaModels([]) }
  }

  useEffect(() => {
    if (provider === 'local') loadOllamaModels()
  }, [provider])

  const save = async () => {
    try {
      await Promise.all([
        adminApi.updateSetting('llm_enabled', enabled ? 'true' : 'false'),
        adminApi.updateSetting('llm_provider', provider),
        adminApi.updateSetting('llm_api_key', apiKey),
        adminApi.updateSetting('llm_model', model),
        adminApi.updateSetting('llm_ollama_url', ollamaUrl),
      ])
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
      qc.invalidateQueries({ queryKey: ['admin', 'llm', 'status'] })
      toast.success(t('success'))
    } catch { toast.error(t('error')) }
  }

  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await adminApi.testLLM()
      setTestResult({ ok: true, review: data.review })
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.detail || t('error') })
    } finally { setTesting(false) }
  }

  const pullOllamaModel = async () => {
    if (!pullModel.trim() || pulling) return
    setPulling(true)
    setPullProgress({ status: 'connecting…', percent: null })
    try {
      const token = useAppStore.getState().accessToken
      const API_URL = import.meta.env.VITE_API_URL || '/api'
      const resp = await fetch(`${API_URL}/admin/llm/ollama-pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ model: pullModel.trim() }),
      })
      if (!resp.ok) throw new Error(await resp.text())

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const raw = trimmed.slice(5).trim()
          if (!raw) continue
          let msg
          try { msg = JSON.parse(raw) } catch { continue }
          if (msg.done) break
          if (msg.error) { toast.error(msg.error); break }
          setPullProgress({
            status: msg.status || '',
            percent: msg.total ? Math.round((msg.completed / msg.total) * 100) : null,
            completed: msg.completed || 0,
            total: msg.total || 0,
          })
          if (msg.status === 'success') {
            toast.success(`${pullModel} загружена`)
            setShowPull(false)
            setPullModel('')
            loadOllamaModels()
            break
          }
        }
      }
    } catch (err) {
      toast.error(err.message || t('error'))
    } finally {
      setPulling(false)
      setPullProgress(null)
    }
  }

  const serviceOk = llmStatus?.service_healthy

  return (
    <div className="card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('llmTitle')}</h2>
          {serviceOk != null && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${serviceOk ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>
              {serviceOk ? t('llmServiceOk') : t('llmServiceDown')}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${enabled ? 'bg-primary-600' : 'bg-gray-400'}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
      <p className="text-xs -mt-3" style={{ color: 'var(--text-muted)' }}>{t('llmHint')}</p>

      {enabled && (
        <div className="space-y-4">
          {/* Provider */}
          <div>
            <label className="label">{t('llmProvider')}</label>
            <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(LLM_DEFAULT_MODELS[e.target.value] || '') }} className="input">
              {LLM_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {/* Ollama URL (only for local) */}
          {provider === 'local' && (
            <div>
              <label className="label">{t('llmOllamaUrl')}</label>
              <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} className="input text-sm font-mono" placeholder="http://ollama:11434" />
            </div>
          )}

          {/* API key (external providers) */}
          {provider !== 'local' && (
            <div>
              <label className="label">{t('llmApiKey')}</label>
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="input text-sm" type="password" autoComplete="off" placeholder="sk-..." />
            </div>
          )}

          {/* Model */}
          <div>
            <label className="label">{t('llmModel')}</label>
            {provider === 'local' && ollamaModels.length > 0 ? (
              <select value={model} onChange={(e) => setModel(e.target.value)} className="input text-sm">
                <option value="">{t('llmModelDefault')}</option>
                {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input value={model} onChange={(e) => setModel(e.target.value)} className="input text-sm font-mono"
                placeholder={LLM_DEFAULT_MODELS[provider] || ''} />
            )}
          </div>

          {/* Ollama model pull */}
          {provider === 'local' && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {t('llmOllamaModels')}: {ollamaModels.length > 0 ? ollamaModels.join(', ') : t('llmNoModels')}
                </span>
                {!pulling && (
                  <button type="button" onClick={() => { setShowPull(!showPull); setPullProgress(null) }} className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                    <Plus size={11} /> {t('llmPullModel')}
                  </button>
                )}
              </div>

              {showPull && !pulling && (
                <div className="flex gap-2">
                  <input
                    value={pullModel}
                    onChange={(e) => setPullModel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && pullOllamaModel()}
                    className="input text-xs flex-1"
                    placeholder="qwen2.5:1.5b / phi3.5:mini / llama3.2:1b"
                  />
                  <button type="button" onClick={pullOllamaModel} className="btn-primary text-xs px-3 flex-shrink-0">
                    {t('llmPull')}
                  </button>
                </div>
              )}

              {pulling && pullProgress && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="truncate max-w-[70%]">{pullProgress.status}</span>
                    {pullProgress.percent != null && (
                      <span className="font-mono font-semibold tabular-nums flex-shrink-0 ml-2">{pullProgress.percent}%</span>
                    )}
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: pullProgress.percent != null ? `${pullProgress.percent}%` : '100%',
                        background: 'var(--accent)',
                        animation: pullProgress.percent == null ? 'pulse 1.5s ease-in-out infinite' : 'none',
                      }}
                    />
                  </div>
                  {pullProgress.total > 0 && (
                    <div className="text-[10px] text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {(pullProgress.completed / 1e9).toFixed(2)} / {(pullProgress.total / 1e9).toFixed(2)} GB
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div className={`rounded-xl p-3 text-sm ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {testResult.ok ? (testResult.review || t('llmTestOk')) : testResult.msg}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={save} className="btn-primary flex items-center gap-2 text-sm">
              <Save size={14} /> {t('save')}
            </button>
            <button onClick={runTest} disabled={testing} className="btn-secondary flex items-center gap-2 text-sm">
              {testing ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <FlaskConical size={14} />}
              {t('llmTest')}
            </button>
          </div>
        </div>
      )}

      {!enabled && (
        <div className="flex gap-2 pt-1">
          <button onClick={save} className="btn-primary flex items-center gap-2 text-sm">
            <Save size={14} /> {t('save')}
          </button>
        </div>
      )}
    </div>
  )
}

export function AdminSettings() {
  const { t } = useTranslation()
  const { isAdmin, user, setAppSettings } = useAppStore()
  const qc = useQueryClient()

  if (!isAdmin()) return <Navigate to="/" replace />

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.getSettings().then((r) => r.data),
  })

  const [smtp, setSmtp] = useState(null)
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)
  const [tgTesting, setTgTesting] = useState(false)

  const { data: vpnConfigs = [], refetch: refetchVpnConfigs } = useQuery({
    queryKey: ['vpn-configs'],
    queryFn: () => adminApi.listVpnConfigs().then((r) => r.data),
  })
  const [vpnModal, setVpnModal] = useState(null)
  const [vpnForm, setVpnForm] = useState({ name: '', config_text: '' })
  const [vpnTesting, setVpnTesting] = useState(false)

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
        setAppSettings({ app_name: key === 'app_name' ? value : (cur.app_name || 'SBRW Books'), app_icon: key === 'app_icon' ? value : (cur.app_icon || 'BookOpen') })
      }
      toast.success(t('success'))
    },
    onError: () => toast.error(t('error')),
  })

  const saveSmtp = async () => {
    const entries = {
      smtp_enabled: smtp.smtp_enabled ? 'true' : 'false',
      smtp_host: smtp.smtp_host, smtp_port: smtp.smtp_port, smtp_user: smtp.smtp_user,
      smtp_password: smtp.smtp_password, smtp_from: smtp.smtp_from || smtp.smtp_user,
      smtp_use_tls: smtp.smtp_use_tls ? 'true' : 'false', smtp_use_ssl: smtp.smtp_use_ssl ? 'true' : 'false',
    }
    try {
      for (const [key, value] of Object.entries(entries)) await adminApi.updateSetting(key, value)
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
      toast.success(t('smtpSaved'))
    } catch { toast.error(t('error')) }
  }

  const sendTest = async () => {
    setTesting(true)
    try {
      await saveSmtp()
      const { data } = await adminApi.smtpTest(testTo)
      toast.success(`${t('testEmailSent')}: ${data.to}`)
    } catch (err) { toast.error(err.response?.data?.detail || t('error'), { duration: 6000 }) }
    finally { setTesting(false) }
  }

  if (isLoading || !smtp) return <PageSpinner />

  const SMTP_FIELDS = [
    { key: 'smtp_host',     label: 'SMTP',           placeholder: 'smtp.gmail.com' },
    { key: 'smtp_port',     label: t('smtpSettings').split(' ')[0] === 'SMTP' ? 'Port' : 'Порт', placeholder: '587' },
    { key: 'smtp_user',     label: 'Login',          placeholder: 'user@example.com' },
    { key: 'smtp_password', label: t('password'),    placeholder: '••••••••', type: 'password' },
    { key: 'smtp_from',     label: 'From',           placeholder: 'noreply@example.com' },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('settings')}</h1>

      {/* Row 1: General + Email notifications */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Card: General */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Settings size={15} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('settings')}</h2>
          </div>

          {/* Toggle rows */}
          {[
            { key: 'require_auth',     label: t('requireAuthLabel'),  hint: t('requireAuthHint') },
            { key: 'allow_registration', label: t('allowRegistration') },
            { key: 'require_2fa',      label: t('require2fa'),        hint: t('require2faHint') },
          ].map(({ key, label, hint }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="min-w-0">
                <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
                {hint && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
              </div>
              <Toggle value={settings[key] === 'true'} onChange={(v) => mutation.mutate({ key, value: v ? 'true' : 'false' })} />
            </div>
          ))}

          {/* App name */}
          <div className="py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <label className="label">{t('appNameLabel')}</label>
            <div className="flex gap-2">
              <input defaultValue={settings.app_name || ''} id="setting-app_name" className="input text-sm" />
              <button onClick={() => mutation.mutate({ key: 'app_name', value: document.getElementById('setting-app_name').value })} className="btn-primary px-3 text-sm">{t('save')}</button>
            </div>
          </div>

          {/* Site URL */}
          <div className="py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <label className="label">{t('siteUrlLabel')}</label>
            <div className="flex gap-2">
              <input defaultValue={settings.site_url || ''} id="setting-site_url" className="input text-sm" />
              <button onClick={() => mutation.mutate({ key: 'site_url', value: document.getElementById('setting-site_url').value })} className="btn-primary px-3 text-sm">{t('save')}</button>
            </div>
          </div>

          {/* App icon */}
          <div className="py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <label className="label">{t('appIconLabel')}</label>
            <div className="flex gap-2 flex-wrap mt-1">
              {APP_ICONS.map(({ name, Icon }) => (
                <button key={name} onClick={() => mutation.mutate({ key: 'app_icon', value: name })}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-colors ${(settings.app_icon || 'BookOpen') === name ? 'border-primary-600 bg-primary-50 dark:bg-primary-950' : 'border-transparent hover:border-primary-400'}`}
                  style={{ background: (settings.app_icon || 'BookOpen') === name ? undefined : 'var(--bg-secondary)' }}
                  title={name}>
                  <Icon size={20} style={{ color: (settings.app_icon || 'BookOpen') === name ? 'var(--accent)' : 'var(--text-secondary)' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Locale */}
          <div className="py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <label className="label">{t('defaultLocaleLabel')}</label>
            <div className="flex gap-2">
              <select defaultValue={settings.default_locale || 'ru'} id="setting-default_locale" className="input text-sm">
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
              <button onClick={() => mutation.mutate({ key: 'default_locale', value: document.getElementById('setting-default_locale').value })} className="btn-primary px-3 text-sm">{t('save')}</button>
            </div>
          </div>

          {/* Theme */}
          <div className="py-2">
            <label className="label">{t('defaultThemeLabel')}</label>
            <div className="flex gap-2">
              <select defaultValue={settings.default_theme || 'dark'} id="setting-default_theme" className="input text-sm">
                <option value="light">{t('themeLight')}</option>
                <option value="dark">{t('themeDark')}</option>
                <option value="colorful">{t('themeColorful')}</option>
              </select>
              <button onClick={() => mutation.mutate({ key: 'default_theme', value: document.getElementById('setting-default_theme').value })} className="btn-primary px-3 text-sm">{t('save')}</button>
            </div>
          </div>
        </div>

        {/* Card: SMTP */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              <Mail size={15} className="text-primary-600" /> {t('smtpSettings')}
            </h2>
            <Toggle value={smtp.smtp_enabled} onChange={(v) => setSmtp({ ...smtp, smtp_enabled: v })} />
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{t('smtpHint')}</p>

          <div className="space-y-3 mb-4">
            {[
              { key: 'smtp_host',     labelKey: 'smtpHost',     placeholder: 'smtp.gmail.com' },
              { key: 'smtp_port',     labelKey: 'smtpPort',     placeholder: '587' },
              { key: 'smtp_user',     labelKey: 'smtpLogin',    placeholder: 'user@example.com' },
              { key: 'smtp_password', labelKey: 'password',     placeholder: '••••••••', type: 'password' },
              { key: 'smtp_from',     labelKey: 'smtpFrom',     placeholder: 'noreply@example.com' },
            ].map(({ key, labelKey, placeholder, type }) => (
              <div key={key}>
                <label className="label">{t(labelKey)}</label>
                <input type={type || 'text'} value={smtp[key]} onChange={(e) => setSmtp({ ...smtp, [key]: e.target.value })} className="input text-sm" placeholder={placeholder} autoComplete="off" />
              </div>
            ))}
            <div>
              <label className="label">{t('smtpEncryption')}</label>
              <select value={smtp.smtp_use_ssl ? 'ssl' : smtp.smtp_use_tls ? 'tls' : 'none'} onChange={(e) => setSmtp({ ...smtp, smtp_use_tls: e.target.value === 'tls', smtp_use_ssl: e.target.value === 'ssl' })} className="input text-sm">
                <option value="tls">STARTTLS (587)</option>
                <option value="ssl">SSL (465)</option>
                <option value="none">{t('smtpNoEncryption')}</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <button onClick={saveSmtp} className="btn-primary flex items-center gap-2 text-sm w-full sm:w-auto">
              <Save size={14} /> {t('save')}
            </button>
            <div className="flex gap-2">
              <input value={testTo} onChange={(e) => setTestTo(e.target.value)} className="input text-sm py-2 flex-1 min-w-0" placeholder="test@example.com" />
              <button onClick={sendTest} disabled={testing || !smtp.smtp_host} className="btn-secondary flex items-center gap-1.5 text-sm flex-shrink-0 disabled:opacity-50">
                {testing ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Send size={13} />}
                <span className="hidden sm:inline">{t('sendTestEmail')}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Row 2: Email notifications + VPN */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Card: Email notifications */}
        <div className="card p-6 space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Bell size={15} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('emailNotifyTypes')}</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{t('emailNotifyTypesHint')}</p>
          <div className="space-y-3">
            {EMAIL_NOTIFY_FIELDS.map(({ key, labelKey }) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t(labelKey)}</span>
                <Toggle value={(settings[key] ?? 'true') === 'true'} onChange={(v) => mutation.mutate({ key, value: v ? 'true' : 'false' })} />
              </div>
            ))}
          </div>
        </div>

        {/* Card: VPN */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              <Shield size={15} className="text-green-500" /> AmneziaWG VPN
            </h2>
            <button onClick={() => { setVpnModal({ mode: 'add' }); setVpnForm({ name: '', config_text: '' }) }} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
              <Plus size={12} /> {t('vpnAddConfig')}
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{t('vpnHint')}</p>

          <VpnStatus />

          <div className="mt-3 space-y-2">
            {vpnConfigs.length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('vpnNoConfigs')}</p>}
            {vpnConfigs.map((cfg) => (
              <div key={cfg.id} className="flex items-center gap-3 p-3 rounded-lg"
                style={{ background: cfg.is_active ? 'rgba(34,197,94,0.08)' : 'var(--bg-secondary)', border: cfg.is_active ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{cfg.name}</span>
                    {cfg.is_active && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#16a34a' }}>{t('vpnActive')}</span>}
                  </div>
                  {cfg.last_latency_ms != null ? (
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Zap size={10} /> {cfg.last_latency_ms.toFixed(0)} {t('vpnMs')}
                      {cfg.last_checked && <span> · {new Date(cfg.last_checked).toLocaleString()}</span>}
                    </p>
                  ) : (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('vpnLatencyUnknown')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!cfg.is_active && (
                    <button onClick={async () => { try { await adminApi.activateVpnConfig(cfg.id); refetchVpnConfigs(); toast.success(`«${cfg.name}» ${t('vpnActivated')}`) } catch { toast.error(t('error')) } }}
                      className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <CheckCircle size={12} /> {t('vpnActivate')}
                    </button>
                  )}
                  <button onClick={() => adminApi.getVpnConfig(cfg.id).then(({ data }) => { setVpnForm({ name: data.name, config_text: data.config_text || '' }); setVpnModal({ mode: 'edit', id: cfg.id, name: data.name }) })}
                    className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>
                    {t('vpnEdit')}
                  </button>
                  <button onClick={async () => { if (!window.confirm(`${t('vpnDeleteConfirm')} «${cfg.name}»?`)) return; await adminApi.deleteVpnConfig(cfg.id); refetchVpnConfigs(); toast.success(t('vpnDeleted')) }}
                    className="text-xs text-red-500 hover:underline">
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={async () => {
                if (!window.confirm(t('vpnAutoSelectConfirm'))) return
                setVpnTesting(true)
                try { await adminApi.testVpnConfigs(); toast.success(t('vpnAutoSelectStarted'), { duration: 6000 }); setTimeout(() => refetchVpnConfigs(), 30000) }
                catch (err) { toast.error(err.response?.data?.detail || t('error')) }
                finally { setVpnTesting(false) }
              }}
              disabled={vpnTesting || vpnConfigs.length < 2}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
              {vpnTesting ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap size={14} />}
              {t('vpnAutoSelect')}
            </button>
            <button
              onClick={async () => {
                try {
                  const activeExists = vpnConfigs.some(c => c.is_active)
                  if (!activeExists && vpnConfigs.length === 1) { await adminApi.activateVpnConfig(vpnConfigs[0].id); refetchVpnConfigs() }
                  else if (!activeExists && vpnConfigs.length > 1) { toast.error(t('vpnApplySelectFirst')); return }
                  await adminApi.restartBots()
                  toast.success(t('vpnRestartStarted'))
                } catch (err) { toast.error(err.response?.data?.detail || t('error')) }
              }}
              className="btn-secondary flex items-center gap-2 text-sm">
              <RotateCcw size={14} /> {t('vpnApplyRestart')}
            </button>
          </div>
        </div>
      </div>

      {/* Row 3+4: Bots — identical structure side by side on lg, stacked on mobile */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Card: Main Telegram bot */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={15} className="text-blue-500" />
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('telegramBot')}</h2>
            </div>
            <Toggle value={settings.telegram_enabled !== 'false'} onChange={(v) => mutation.mutate({ key: 'telegram_enabled', value: v ? 'true' : 'false' })} />
          </div>
          <p className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>{t('telegramBotHint')}</p>

          <div>
            <label className="label">{t('botToken')}</label>
            <input defaultValue={settings.telegram_bot_token || ''} id="setting-telegram_bot_token" className="input text-sm" placeholder="1234567890:ABCDef..." type="password" autoComplete="off" />
          </div>
          <div>
            <label className="label">{t('botUsername')}</label>
            <input defaultValue={settings.telegram_bot_username || ''} id="setting-telegram_bot_username" className="input text-sm" placeholder="my_sbrw_bot" />
          </div>

          <TelegramBotStatus token={settings.telegram_bot_token} />

          <div className="flex flex-wrap gap-2">
            <button onClick={async () => { try { await adminApi.updateSetting('telegram_bot_token', document.getElementById('setting-telegram_bot_token').value); await adminApi.updateSetting('telegram_bot_username', document.getElementById('setting-telegram_bot_username').value); qc.invalidateQueries({ queryKey: ['admin', 'settings'] }); toast.success(t('success')) } catch { toast.error(t('error')) } }} className="btn-primary flex items-center gap-2 text-sm">
              <Save size={14} /> {t('save')}
            </button>
            <button onClick={async () => { setTgTesting(true); try { await adminApi.telegramTest(); toast.success(t('testMessageSent')) } catch (err) { toast.error(err.response?.data?.detail || t('error'), { duration: 6000 }) } finally { setTgTesting(false) } }} disabled={tgTesting} className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50">
              {tgTesting ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Send size={13} />}
              {t('testSendSelf')}
            </button>
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>{t('botProfileSection')}</p>
            <BotProfileEditor token={settings.telegram_bot_token} />
          </div>
        </div>

        {/* Card: Upload bot */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Upload size={15} className="text-blue-500" />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('uploadBot')}</h2>
          </div>
          <p className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>{t('uploadBotHint')}</p>

          <div>
            <label className="label">{t('uploadBotToken')}</label>
            <input defaultValue={settings.telegram_upload_bot_token || ''} id="setting-telegram_upload_bot_token" className="input text-sm" placeholder="1234567890:ABCDef..." type="password" autoComplete="off" />
          </div>
          <div>
            <label className="label">{t('botUsername')}</label>
            <input defaultValue={settings.telegram_upload_bot_username || ''} id="setting-telegram_upload_bot_username" className="input text-sm" placeholder="my_upload_bot" />
          </div>

          <TelegramBotStatus token={settings.telegram_upload_bot_token} />

          <div className="flex flex-wrap gap-2">
            <button onClick={async () => { try { await adminApi.updateSetting('telegram_upload_bot_token', document.getElementById('setting-telegram_upload_bot_token').value); await adminApi.updateSetting('telegram_upload_bot_username', document.getElementById('setting-telegram_upload_bot_username').value); qc.invalidateQueries({ queryKey: ['admin', 'settings'] }); toast.success(t('success')) } catch { toast.error(t('error')) } }} className="btn-primary flex items-center gap-2 text-sm">
              <Save size={14} /> {t('save')}
            </button>
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>{t('botProfileSection')}</p>
            <BotProfileEditor token={settings.telegram_upload_bot_token} />
          </div>
        </div>

      </div>

      {/* ── Row 4: AI Assistant card ──────────────────────────────────────── */}
      <LLMSettingsCard settings={settings} qc={qc} t={t} />

      {/* VPN modal */}
      {vpnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="card p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {vpnModal.mode === 'add' ? t('vpnModalAdd') : `${t('vpnEdit')} «${vpnModal.name}»`}
              </h3>
              <button onClick={() => setVpnModal(null)}><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">{t('vpnConfigName')}</label>
                <input value={vpnForm.name} onChange={(e) => setVpnForm((f) => ({ ...f, name: e.target.value }))} className="input" placeholder="NL-1 / Hetzner VPN" />
              </div>
              <div>
                <label className="label">{t('vpnConfigText')}</label>
                <textarea value={vpnForm.config_text} onChange={(e) => setVpnForm((f) => ({ ...f, config_text: e.target.value }))} className="input text-xs font-mono resize-none" rows={14} spellCheck={false} placeholder={`[Interface]\nPrivateKey = ...\nAddress = 10.0.0.2/24\n\n[Peer]\nPublicKey = ...\nEndpoint = vpn.example.com:51820`} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={async () => {
                  if (!vpnForm.name || !vpnForm.config_text) { toast.error(t('vpnFillAll')); return }
                  try {
                    if (vpnModal.mode === 'add') { await adminApi.createVpnConfig(vpnForm); toast.success(t('vpnConfigAdded')) }
                    else { await adminApi.updateVpnConfig(vpnModal.id, vpnForm); toast.success(t('vpnConfigUpdated')) }
                    refetchVpnConfigs(); setVpnModal(null)
                  } catch { toast.error(t('error')) }
                }}
                className="btn-primary text-sm">
                {vpnModal.mode === 'add' ? t('vpnModalAdd') : t('save')}
              </button>
              <button onClick={() => setVpnModal(null)} className="btn-secondary text-sm">{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
