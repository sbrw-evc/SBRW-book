import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/auth'
import { useTranslation } from '../../hooks/useTranslation'
import { PageSpinner } from '../../components/ui/Spinner'
import { Navigate } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { Send, Eye, Plus, Mail, CheckCircle, Clock, FileText, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

const NL_TYPES = ['new_book', 'update', 'custom']

const DEFAULT_COMPOSE_TEMPLATES = {
  new_book: `<p>Привет, <b>{{user_name}}</b>!</p>
<p>В библиотеке <b>{{app_name}}</b> появилась новая книга. Заходите, чтобы её найти!</p>`,
  update: `<p>Привет, <b>{{user_name}}</b>!</p>
<p>Мы обновили <b>{{app_name}}</b>. Приложение стало лучше — заходите!</p>`,
  custom: '<p>Привет!</p>\n<p>Сообщение от команды <b>{{app_name}}</b>.</p>',
}

const TEMPLATE_EVENTS = [
  { key: 'verify',     labelKey: 'tplEventVerify',     varsKey: 'tplVarsVerify' },
  { key: 'reset',      labelKey: 'tplEventReset',      varsKey: 'tplVarsReset' },
  { key: 'series',     labelKey: 'tplEventSeries',     varsKey: 'tplVarsSeries' },
  { key: 'newsletter', labelKey: 'tplEventNewsletter', varsKey: 'tplVarsNewsletter' },
]

function NlTypeLabel({ type, t }) {
  if (type === 'new_book') return t('newsletterTypeNewBook')
  if (type === 'update') return t('newsletterTypeUpdate')
  return t('newsletterTypeCustom')
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#ffffff' : 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

function EmailTemplateEditor({ event, label, varsKey, data, onSave, t }) {
  const [subject, setSubject] = useState(data?.subject ?? '')
  const [bodyHtml, setBodyHtml] = useState(data?.body_html ?? '')
  const [dirty, setDirty] = useState(false)

  const handleSubjectChange = (v) => { setSubject(v); setDirty(true) }
  const handleBodyChange = (v) => { setBodyHtml(v); setDirty(true) }

  const handleReset = () => {
    setSubject('')
    setBodyHtml('')
    setDirty(true)
  }

  const handleSave = () => {
    onSave(event, { subject, body_html: bodyHtml })
    setDirty(false)
  }

  const placeholder_subject = data?.default_subject || ''
  const placeholder_body = data?.default_body_html || ''

  return (
    <div className="border rounded-xl p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{label}</h3>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          title={t('tplResetToDefault')}
        >
          <RotateCcw size={12} /> {t('tplResetToDefault')}
        </button>
      </div>

      <div>
        <label className="label">{t('tplSubject')}</label>
        <input
          value={subject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          className="input text-sm"
          placeholder={placeholder_subject}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">{t('tplBody')}</label>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('tplVars')}: <code className="text-xs">{t(varsKey)}</code>
          </span>
        </div>
        <textarea
          value={bodyHtml}
          onChange={(e) => handleBodyChange(e.target.value)}
          className="input font-mono text-xs"
          rows={6}
          placeholder={placeholder_body}
          style={{ resize: 'vertical' }}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="btn-primary text-sm px-4 disabled:opacity-50"
        >
          {t('save')}
        </button>
      </div>
    </div>
  )
}

export function AdminNewsletter() {
  const { t } = useTranslation()
  const { isAdmin } = useAppStore()
  const qc = useQueryClient()

  if (!isAdmin()) return <Navigate to="/admin" replace />

  const [activeTab, setActiveTab] = useState('compose')
  const [form, setForm] = useState({
    subject: '',
    nl_type: 'custom',
    body_html: DEFAULT_COMPOSE_TEMPLATES.custom,
    body_text: '',
  })
  const [preview, setPreview] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [sendingId, setSendingId] = useState(null)

  const { data: newsletters, isLoading: nlLoading } = useQuery({
    queryKey: ['admin', 'newsletters'],
    queryFn: () => adminApi.listNewsletters().then((r) => r.data),
  })

  const { data: emailTemplates, isLoading: tplLoading } = useQuery({
    queryKey: ['admin', 'email-templates'],
    queryFn: () => adminApi.getEmailTemplates().then((r) => r.data),
  })

  const tplMutation = useMutation({
    mutationFn: ({ event, data }) => adminApi.updateEmailTemplate(event, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'email-templates'] })
      toast.success(t('emailTemplatesSaved'))
    },
    onError: () => toast.error(t('error')),
  })

  const handleTypeChange = (nl_type) => {
    setForm((f) => ({
      ...f,
      nl_type,
      body_html: DEFAULT_COMPOSE_TEMPLATES[nl_type] || DEFAULT_COMPOSE_TEMPLATES.custom,
    }))
  }

  const handlePreview = async () => {
    try {
      const { data } = await adminApi.previewNewsletter({
        subject: form.subject,
        body_html: form.body_html,
      })
      setPreview(data.html)
      setShowPreview(true)
    } catch {
      toast.error(t('error'))
    }
  }

  const handleSend = async () => {
    if (!form.subject.trim() || !form.body_html.trim()) {
      toast.error(t('required'))
      return
    }
    try {
      const { data: created } = await adminApi.createNewsletter(form)
      setSendingId(created.id)
      const { data: result } = await adminApi.sendNewsletter(created.id)
      toast.success(`${t('newsletterSent')} · ${t('newsletterSentCount')}: ${result.sent_count}`, { duration: 5000 })
      qc.invalidateQueries({ queryKey: ['admin', 'newsletters'] })
      setForm({ subject: '', nl_type: 'custom', body_html: DEFAULT_COMPOSE_TEMPLATES.custom, body_text: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'), { duration: 6000 })
    } finally {
      setSendingId(null)
    }
  }

  const handleResend = async (id) => {
    setSendingId(id)
    try {
      const { data } = await adminApi.sendNewsletter(id)
      toast.success(`${t('newsletterSent')} · ${t('newsletterSentCount')}: ${data.sent_count}`)
      qc.invalidateQueries({ queryKey: ['admin', 'newsletters'] })
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'), { duration: 6000 })
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('newsletters')}</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-secondary)' }}>
        <TabButton active={activeTab === 'compose'} onClick={() => setActiveTab('compose')}>
          <span className="flex items-center gap-1.5"><Mail size={14} /> {t('newsletterNew')}</span>
        </TabButton>
        <TabButton active={activeTab === 'templates'} onClick={() => setActiveTab('templates')}>
          <span className="flex items-center gap-1.5"><FileText size={14} /> {t('emailTemplates')}</span>
        </TabButton>
      </div>

      {activeTab === 'compose' && (
        <>
          {/* Compose */}
          <div className="card p-6 max-w-3xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Plus size={18} className="text-primary-600" />
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('newsletterNew')}</h2>
            </div>

            {/* Type */}
            <div>
              <label className="label">{t('newsletterType')}</label>
              <div className="flex gap-2 flex-wrap">
                {NL_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      form.nl_type === type
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-[var(--border)] hover:border-primary-400'
                    }`}
                    style={{ color: form.nl_type === type ? undefined : 'var(--text-secondary)' }}
                  >
                    <NlTypeLabel type={type} t={t} />
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="label">{t('newsletterSubject')}</label>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="input"
                placeholder={t('newsletterSubject')}
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">{t('newsletterBody')}</label>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('newsletterBodyHint')}
                </span>
              </div>
              <textarea
                value={form.body_html}
                onChange={(e) => setForm({ ...form, body_html: e.target.value })}
                className="input font-mono text-xs"
                rows={10}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Plain text */}
            <div>
              <label className="label">Текстовая версия (необязательно)</label>
              <textarea
                value={form.body_text}
                onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                className="input text-xs"
                rows={3}
                placeholder="Текст для почтовых клиентов, не поддерживающих HTML"
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button onClick={handleSend} disabled={!!sendingId} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                {sendingId ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : <Send size={15} />}
                {t('newsletterSend')}
              </button>
              <button onClick={handlePreview} className="btn-secondary flex items-center gap-2 text-sm">
                <Eye size={15} /> {t('newsletterPreview')}
              </button>
            </div>
          </div>

          {/* History */}
          <div className="card p-6 max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Mail size={18} className="text-primary-600" />
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('newsletterHistory')}</h2>
            </div>
            {nlLoading ? <PageSpinner /> : newsletters?.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>—</p>
            ) : (
              <div className="space-y-3">
                {newsletters?.map((nl) => (
                  <div key={nl.id} className="flex items-start gap-3 py-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="mt-0.5">
                      {nl.sent_at
                        ? <CheckCircle size={16} className="text-green-500" />
                        : <Clock size={16} className="text-yellow-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{nl.subject}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        <NlTypeLabel type={nl.nl_type} t={t} />
                        {nl.sent_at && (
                          <> · {new Date(nl.sent_at).toLocaleString()} · {t('newsletterSentCount')}: {nl.sent_count}</>
                        )}
                        {!nl.sent_at && <> · {t('newsletterNotSent')}</>}
                      </p>
                    </div>
                    <button
                      onClick={() => handleResend(nl.id)}
                      disabled={sendingId === nl.id}
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {sendingId === nl.id
                        ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        : <Send size={12} />}
                      {t('newsletterSend')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'templates' && (
        <div className="card p-6 max-w-3xl space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText size={18} className="text-primary-600" />
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('emailTemplates')}</h2>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('emailTemplatesHint')}</p>
          </div>

          {tplLoading ? <PageSpinner /> : (
            <div className="space-y-4">
              {TEMPLATE_EVENTS.map(({ key, labelKey, varsKey }) => (
                <EmailTemplateEditor
                  key={key}
                  event={key}
                  label={t(labelKey)}
                  varsKey={varsKey}
                  data={emailTemplates?.[key]}
                  onSave={(event, data) => tplMutation.mutate({ event, data })}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview modal */}
      {showPreview && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowPreview(false)}>
          <div
            className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <span className="font-semibold text-gray-800">{t('newsletterPreview')}</span>
              <button onClick={() => setShowPreview(false)} className="text-gray-500 hover:text-gray-800 text-lg leading-none">✕</button>
            </div>
            <div dangerouslySetInnerHTML={{ __html: preview }} />
          </div>
        </div>
      )}
    </div>
  )
}
