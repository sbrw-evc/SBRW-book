import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/auth'
import { useTranslation } from '../../hooks/useTranslation'
import { PageSpinner } from '../../components/ui/Spinner'
import { Navigate } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { Send, Eye, Plus, Mail, CheckCircle, Clock, FileText, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

function inlineHtml(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\{\{([^}]+)\}\}/g, (_, v) => `{{${v}}}`)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:13px">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#6d28d9;text-decoration:underline">$1</a>')
}

function mdToHtml(md) {
  if (!md) return ''
  const lines = md.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    const h3m = line.match(/^### (.+)$/)
    if (h3m) { out.push(`<h3 style="font-size:16px;font-weight:600;margin:18px 0 8px;color:#111">${inlineHtml(h3m[1])}</h3>`); i++; continue }

    const h2m = line.match(/^## (.+)$/)
    if (h2m) { out.push(`<h2 style="font-size:20px;font-weight:700;margin:20px 0 10px;color:#111">${inlineHtml(h2m[1])}</h2>`); i++; continue }

    const h1m = line.match(/^# (.+)$/)
    if (h1m) { out.push(`<h1 style="font-size:24px;font-weight:700;margin:24px 0 12px;color:#111">${inlineHtml(h1m[1])}</h1>`); i++; continue }

    if (/^---+$/.test(line.trim())) {
      out.push('<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">')
      i++; continue
    }

    if (/^[*-] /.test(line)) {
      const items = []
      while (i < lines.length && /^[*-] /.test(lines[i])) {
        items.push(`<li style="margin:4px 0;color:#374151">${inlineHtml(lines[i].slice(2))}</li>`)
        i++
      }
      out.push(`<ul style="margin:12px 0;padding-left:20px">${items.join('')}</ul>`)
      continue
    }

    const paraLines = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3} /.test(lines[i]) &&
      !/^---/.test(lines[i].trim()) &&
      !/^[*-] /.test(lines[i])
    ) {
      paraLines.push(inlineHtml(lines[i]))
      i++
    }
    if (paraLines.length) {
      out.push(`<p style="margin:0 0 16px;line-height:1.65;color:#374151">${paraLines.join('<br>')}</p>`)
    }
  }
  return out.join('\n')
}

// ─── Default templates ────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES = {
  verify: {
    subject: '{{app_name}} — подтверждение регистрации',
    md: `Привет, **{{user_name}}**!

Вы зарегистрировались в **{{app_name}}**. Подтвердите свой email, нажав на кнопку ниже.

{{action_button}}

Ссылка действительна 48 часов. Если вы не регистрировались — просто проигнорируйте это письмо.`,
  },
  reset: {
    subject: '{{app_name}} — сброс пароля',
    md: `Привет, **{{user_name}}**!

Мы получили запрос на сброс пароля для вашего аккаунта. Нажмите кнопку ниже, чтобы задать новый пароль:

{{action_button}}

Ссылка действительна 2 часа. Если вы не запрашивали сброс — просто проигнорируйте это письмо, пароль не изменится.`,
  },
  series: {
    subject: '{{app_name}} — новая книга в серии «{{series_name}}»',
    md: `Привет, **{{user_name}}**!

В серии **{{series_name}}**, на которую вы подписаны, появилась новая книга:

## {{book_title}}

*{{book_authors}}*

{{action_button}}`,
  },
  newsletter: {
    subject: '{{app_name}} — новости библиотеки',
    md: `Привет, **{{user_name}}**!

Новости от команды **{{app_name}}**.

{{action_button}}`,
  },
}

const DEFAULT_COMPOSE_MD = {
  new_book: `Привет, **{{user_name}}**!\n\nВ библиотеке **{{app_name}}** появилась новая книга. Заходите, чтобы её найти!`,
  update:   `Привет, **{{user_name}}**!\n\nМы обновили **{{app_name}}**. Приложение стало лучше — заходите!`,
  custom:   `Привет!\n\nСообщение от команды **{{app_name}}**.`,
}

const TEMPLATE_VARS = {
  verify:     ['user_name', 'app_name', 'verify_url', 'action_button'],
  reset:      ['user_name', 'app_name', 'reset_url', 'action_button'],
  series:     ['user_name', 'app_name', 'series_name', 'book_title', 'book_authors', 'book_url', 'action_button'],
  newsletter: ['user_name', 'app_name', 'action_button'],
}

const COMPOSE_VARS = ['user_name', 'app_name']

const TEMPLATE_EVENTS = [
  { key: 'verify',     labelKey: 'tplEventVerify',     variables: TEMPLATE_VARS.verify },
  { key: 'reset',      labelKey: 'tplEventReset',      variables: TEMPLATE_VARS.reset },
  { key: 'series',     labelKey: 'tplEventSeries',     variables: TEMPLATE_VARS.series },
  { key: 'newsletter', labelKey: 'tplEventNewsletter', variables: TEMPLATE_VARS.newsletter },
]

const NL_TYPES = ['new_book', 'update', 'custom']

// ─── MarkdownEditor ───────────────────────────────────────────────────────────

function MarkdownEditor({ value, onChange, variables = [], rows = 10 }) {
  const [mode, setMode] = useState('edit')
  const ref = useRef(null)

  const wrap = (before, after = '') => {
    const el = ref.current
    if (!el) return
    const s = el.selectionStart
    const e = el.selectionEnd
    const sel = value.slice(s, e) || 'текст'
    const next = value.slice(0, s) + before + sel + after + value.slice(e)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + before.length, s + before.length + sel.length)
    })
  }

  const insertAtLineStart = (prefix) => {
    const el = ref.current
    if (!el) return
    const s = el.selectionStart
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length) })
  }

  const insertVar = (varName) => {
    const el = ref.current
    if (!el) return
    const s = el.selectionStart
    const token = `{{${varName}}}`
    onChange(value.slice(0, s) + token + value.slice(s))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length) })
  }

  const tools = [
    { label: 'B',  cls: 'font-bold', title: 'Жирный (**текст**)',     action: () => wrap('**', '**') },
    { label: 'I',  cls: 'italic',    title: 'Курсив (*текст*)',        action: () => wrap('*', '*') },
    { label: 'H2', cls: '',          title: 'Заголовок (## Текст)',    action: () => insertAtLineStart('## ') },
    { label: 'H3', cls: '',          title: 'Подзаголовок (### Текст)',action: () => insertAtLineStart('### ') },
    { label: '≡',  cls: '',          title: 'Список (- пункт)',        action: () => insertAtLineStart('- ') },
    { label: '—',  cls: '',          title: 'Разделитель (---)',       action: () => onChange(value + '\n\n---\n\n') },
    { label: '🔗', cls: '',          title: 'Ссылка ([текст](url))',   action: () => wrap('[', '](url)') },
  ]

  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap gap-y-1"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>

        {tools.map(({ label, cls, title, action }) => (
          <button key={label} type="button" onClick={action} title={title}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 ${cls}`}
            style={{ color: 'var(--text-secondary)', minWidth: '1.75rem', textAlign: 'center' }}>
            {label}
          </button>
        ))}

        {variables.length > 0 && (
          <>
            <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: 'var(--border)' }} />
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) { insertVar(e.target.value); e.target.value = '' } }}
              className="text-xs px-1.5 py-1 rounded cursor-pointer border"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-muted)', maxWidth: 160 }}
            >
              <option value="" disabled>＋ переменная</option>
              {variables.map(v => <option key={v} value={v}>{`{{${v}}}`}</option>)}
            </select>
          </>
        )}

        <div className="flex-1" />

        {/* Edit / Preview */}
        <div className="flex rounded-lg overflow-hidden border text-xs" style={{ borderColor: 'var(--border)' }}>
          <button type="button" onClick={() => setMode('edit')}
            className="px-2.5 py-1 font-medium transition-colors"
            style={{ background: mode === 'edit' ? 'var(--accent)' : 'transparent', color: mode === 'edit' ? '#fff' : 'var(--text-muted)' }}>
            Markdown
          </button>
          <button type="button" onClick={() => setMode('preview')}
            className="px-2.5 py-1 font-medium transition-colors"
            style={{ background: mode === 'preview' ? 'var(--accent)' : 'transparent', color: mode === 'preview' ? '#fff' : 'var(--text-muted)' }}>
            <Eye size={11} className="inline mr-1" />Просмотр
          </button>
        </div>
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          style={{
            display: 'block', width: '100%', padding: '12px',
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            fontFamily: 'ui-monospace, monospace', fontSize: 13,
            minHeight: rows * 22, resize: 'vertical', outline: 'none', border: 'none',
          }}
        />
      ) : (
        <div
          style={{
            padding: '20px 24px', background: '#fff', color: '#111827',
            fontSize: 14, lineHeight: 1.65, minHeight: rows * 22,
          }}
          dangerouslySetInnerHTML={{
            __html: mdToHtml(value) ||
              '<span style="color:#9ca3af;font-size:13px">Нет содержимого для предпросмотра</span>',
          }}
        />
      )}
    </div>
  )
}

// ─── EmailTemplateEditor ──────────────────────────────────────────────────────

function EmailTemplateEditor({ event, label, variables, data, onSave, t }) {
  const def = DEFAULT_TEMPLATES[event] || {}
  const [subject, setSubject] = useState(data?.subject || def.subject || '')
  const [body, setBody] = useState(data?.body_html || def.md || '')
  const [dirty, setDirty] = useState(false)

  const handleReset = () => { setSubject(def.subject || ''); setBody(def.md || ''); setDirty(true) }
  const handleSave  = () => { onSave(event, { subject, body_html: mdToHtml(body) }); setDirty(false) }

  return (
    <div className="border rounded-xl p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{label}</h3>
        <button type="button" onClick={handleReset}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
          <RotateCcw size={12} /> {t('tplResetToDefault')}
        </button>
      </div>

      <div>
        <label className="label">{t('tplSubject')}</label>
        <input
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setDirty(true) }}
          className="input text-sm"
          placeholder={def.subject || ''}
        />
      </div>

      <div>
        <label className="label mb-2">{t('tplBody')}</label>
        <MarkdownEditor
          value={body}
          onChange={(v) => { setBody(v); setDirty(true) }}
          variables={variables}
          rows={9}
        />
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={!dirty} className="btn-primary text-sm px-4 disabled:opacity-50">
          {t('save')}
        </button>
      </div>
    </div>
  )
}

// ─── TabButton ────────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
      style={{ background: active ? 'var(--accent)' : 'transparent', color: active ? '#ffffff' : 'var(--text-secondary)' }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      {children}
    </button>
  )
}

function NlTypeLabel({ type, t }) {
  if (type === 'new_book') return t('newsletterTypeNewBook')
  if (type === 'update')   return t('newsletterTypeUpdate')
  return t('newsletterTypeCustom')
}

// ─── AdminNewsletter ──────────────────────────────────────────────────────────

export function AdminNewsletter() {
  const { t } = useTranslation()
  const { isAdmin } = useAppStore()
  const qc = useQueryClient()

  if (!isAdmin()) return <Navigate to="/" replace />

  const [activeTab, setActiveTab] = useState('compose')
  const [form, setForm] = useState({
    subject:  '',
    nl_type:  'custom',
    body_md:  DEFAULT_COMPOSE_MD.custom,
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'email-templates'] }); toast.success(t('emailTemplatesSaved')) },
    onError: () => toast.error(t('error')),
  })

  const handleTypeChange = (nl_type) => {
    setForm((f) => ({ ...f, nl_type, body_md: DEFAULT_COMPOSE_MD[nl_type] || DEFAULT_COMPOSE_MD.custom }))
  }

  const handlePreview = async () => {
    try {
      const { data } = await adminApi.previewNewsletter({ subject: form.subject, body_html: mdToHtml(form.body_md) })
      setPreview(data.html); setShowPreview(true)
    } catch { toast.error(t('error')) }
  }

  const handleSend = async () => {
    if (!form.subject.trim() || !form.body_md.trim()) { toast.error(t('required')); return }
    try {
      const { data: created } = await adminApi.createNewsletter({ ...form, body_html: mdToHtml(form.body_md), body_text: form.body_text })
      setSendingId(created.id)
      const { data: result } = await adminApi.sendNewsletter(created.id)
      toast.success(`${t('newsletterSent')} · ${t('newsletterSentCount')}: ${result.sent_count}`, { duration: 5000 })
      qc.invalidateQueries({ queryKey: ['admin', 'newsletters'] })
      setForm({ subject: '', nl_type: 'custom', body_md: DEFAULT_COMPOSE_MD.custom, body_text: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'), { duration: 6000 })
    } finally { setSendingId(null) }
  }

  const handleResend = async (id) => {
    setSendingId(id)
    try {
      const { data } = await adminApi.sendNewsletter(id)
      toast.success(`${t('newsletterSent')} · ${t('newsletterSentCount')}: ${data.sent_count}`)
      qc.invalidateQueries({ queryKey: ['admin', 'newsletters'] })
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'), { duration: 6000 })
    } finally { setSendingId(null) }
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
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-primary-600" />
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('newsletterNew')}</h2>
            </div>

            {/* Type */}
            <div>
              <label className="label">{t('newsletterType')}</label>
              <div className="flex gap-2 flex-wrap">
                {NL_TYPES.map((type) => (
                  <button key={type} type="button" onClick={() => handleTypeChange(type)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${form.nl_type === type ? 'bg-primary-600 text-white border-primary-600' : 'border-[var(--border)] hover:border-primary-400'}`}
                    style={{ color: form.nl_type === type ? undefined : 'var(--text-secondary)' }}>
                    <NlTypeLabel type={type} t={t} />
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="label">{t('newsletterSubject')}</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input" placeholder={t('newsletterSubject')} />
            </div>

            {/* Body — Markdown editor */}
            <div>
              <label className="label mb-2">{t('newsletterBody')}</label>
              <MarkdownEditor
                value={form.body_md}
                onChange={(v) => setForm({ ...form, body_md: v })}
                variables={COMPOSE_VARS}
                rows={12}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button onClick={handleSend} disabled={!!sendingId} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                {sendingId ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={15} />}
                {t('newsletterSend')}
              </button>
              <button onClick={handlePreview} className="btn-secondary flex items-center gap-2 text-sm">
                <Eye size={15} /> {t('newsletterPreview')}
              </button>
            </div>
          </div>

          {/* History */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail size={18} className="text-primary-600" />
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('newsletterHistory')}</h2>
            </div>
            {nlLoading ? <PageSpinner /> : !newsletters?.length ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>—</p>
            ) : (
              <div className="space-y-3">
                {newsletters.map((nl) => (
                  <div key={nl.id} className="flex items-start gap-3 py-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="mt-0.5">
                      {nl.sent_at ? <CheckCircle size={16} className="text-green-500" /> : <Clock size={16} className="text-yellow-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{nl.subject}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        <NlTypeLabel type={nl.nl_type} t={t} />
                        {nl.sent_at && <> · {new Date(nl.sent_at).toLocaleString()} · {t('newsletterSentCount')}: {nl.sent_count}</>}
                        {!nl.sent_at && <> · {t('newsletterNotSent')}</>}
                      </p>
                    </div>
                    <button onClick={() => handleResend(nl.id)} disabled={sendingId === nl.id}
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
                      {sendingId === nl.id ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Send size={12} />}
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
        <div className="card p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText size={18} className="text-primary-600" />
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('emailTemplates')}</h2>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('emailTemplatesHint')}</p>
          </div>

          {tplLoading ? <PageSpinner /> : (
            <div className="space-y-4">
              {TEMPLATE_EVENTS.map(({ key, labelKey, variables }) => (
                <EmailTemplateEditor
                  key={key}
                  event={key}
                  label={t(labelKey)}
                  variables={variables}
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
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
