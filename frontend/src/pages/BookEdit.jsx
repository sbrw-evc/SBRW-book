import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { booksApi } from '../api/books'
import { useAppStore } from '../store/appStore'
import { useTranslation } from '../hooks/useTranslation'
import { PageSpinner } from '../components/ui/Spinner'
import { MetadataPanel } from '../components/MetadataSearch'
import { ArrowLeft, Save, BookOpen, Image as ImageIcon, Link as LinkIcon, Upload, Trash2, Check, X, Search, Sparkles, StopCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export function BookEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { isModerator, user } = useAppStore()
  const qc = useQueryClient()

  const { data: book, isLoading } = useQuery({
    queryKey: ['book', id],
    queryFn: () => booksApi.get(id).then((r) => r.data),
  })

  const [form, setForm] = useState(null)
  const [coverUrl, setCoverUrl] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)

  
  const [metaStatus, setMetaStatus] = useState('idle')
  const [allResults, setAllResults] = useState([])
  const [appliedResult, setAppliedResult] = useState(null)

  
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiReviewStatus, setAiReviewStatus] = useState(book?.ai_review_status || null)
  const [aiThinking, setAiThinking] = useState('')      
  const [aiStatus, setAiStatus] = useState('')          
  const [aiElapsed, setAiElapsed] = useState(0)         
  const [aiFinalReview, setAiFinalReview] = useState(null)
  const aiAbortRef = useRef(null)                        
  const aiTimerRef = useRef(null)
  const thinkingRef = useRef(null)                       
  const AI_TIMEOUT = 300                                 

  
  const [addFileLabel, setAddFileLabel] = useState('')
  const [addFileUploading, setAddFileUploading] = useState(false)
  const [editingLabelId, setEditingLabelId] = useState(null)
  const [editingLabelVal, setEditingLabelVal] = useState('')
  const addFileInputRef = useRef(null)

  useEffect(() => {
    if (book && !form) {
      setForm({
        title: book.title || '',
        author_names: (book.authors || []).map((a) => a.name).join(', '),
        series_names: (book.series || []).map((s) => s.name).join(', '),
        tag_names: (book.tags || []).map((tg) => tg.name).join(', '),
        description: book.description || '',
        language: book.language || '',
        published_year: book.published_year?.toString() || '',
        publisher: book.publisher || '',
        isbn: book.isbn || '',
        page_count: book.page_count?.toString() || '',
        narrator: book.narrator || '',
        is_public: book.is_public,
      })
    }
  }, [book, form])

  const runMetadataSearch = useCallback(async (titleHint, authorHint) => {
    if (!titleHint && !authorHint) return
    setMetaStatus('loading')
    setAllResults([])
    setAppliedResult(null)
    try {
      const { data } = await booksApi.searchMetadata({ title: titleHint, authors: authorHint })
      const flat = (data.sources || []).flatMap((s) => s.results || [])
      setAllResults(flat)
      setMetaStatus('done')
    } catch {
      setMetaStatus('error')
    }
  }, [])

  const applyResult = useCallback((result) => {
    setAppliedResult(result)
    setForm((prev) => ({
      ...prev,
      title: result.title || prev.title,
      author_names: (result.authors || []).join(', ') || prev.author_names,
      series_names: result.series || prev.series_names,
      tag_names: (result.genres || []).slice(0, 8).join(', ') || prev.tag_names,
      language: result.language || prev.language,
      description: result.description || prev.description,
      publisher: result.publisher || prev.publisher,
      published_year: result.published_year?.toString() || prev.published_year,
      isbn: result.isbn || prev.isbn,
    }))
    if (result.cover_url) {
      setCoverUrl(result.cover_url)
      setCoverFile(null)
      setCoverPreview(null)
    }
  }, [])

  const stopAIAnalyze = useCallback(() => {
    aiAbortRef.current?.abort()
    clearInterval(aiTimerRef.current)
    setAiAnalyzing(false)
    setAiStatus('')
    setAiElapsed(0)
  }, [])

  const triggerAIAnalyze = useCallback(async () => {
    if (aiAnalyzing) return
    setAiAnalyzing(true)
    setAiThinking('')
    setAiStatus('Подготовка…')
    setAiElapsed(0)
    setAiFinalReview(null)

    const controller = new AbortController()
    aiAbortRef.current = controller

    
    const start = Date.now()
    aiTimerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000)
      setAiElapsed(secs)
      if (secs >= AI_TIMEOUT) {
        controller.abort()
        clearInterval(aiTimerRef.current)
        setAiStatus(`Таймаут ${AI_TIMEOUT}s — ИИ не ответил`)
        setAiAnalyzing(false)
        Book.objects?.filter(id)?.update?.({ai_review_status: 'error'})
      }
    }, 1000)

    try {
      const token = useAppStore.getState().accessToken
      const API_URL = import.meta.env.VITE_API_URL || '/api'

      const resp = await fetch(`${API_URL}/books/${id}/analyze/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP ${resp.status}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        const events = buf.split('\n\n')
        buf = events.pop()

        for (const event of events) {
          for (const line of event.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (!raw) continue
            let msg
            try { msg = JSON.parse(raw) } catch { continue }

            if (msg.type === 'status') {
              setAiStatus(msg.message || '')
            } else if (msg.type === 'thinking') {
              setAiThinking((prev) => {
                const next = prev + (msg.content || '')
                // auto-scroll
                setTimeout(() => thinkingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 0)
                return next
              })
            } else if (msg.type === 'done') {
              clearInterval(aiTimerRef.current)
              setAiFinalReview(msg.review || null)
              setAiStatus('Готово')
              setAiAnalyzing(false)
              setAiReviewStatus('done')
              qc.invalidateQueries({ queryKey: ['book', id] })
              toast.success('ИИ-рецензия готова')
            } else if (msg.type === 'error') {
              clearInterval(aiTimerRef.current)
              setAiStatus(`Ошибка: ${msg.message}`)
              setAiAnalyzing(false)
              setAiReviewStatus('error')
              toast.error(msg.message || 'Ошибка ИИ-анализа')
            }
          }
        }
      }
    } catch (err) {
      clearInterval(aiTimerRef.current)
      if (err.name !== 'AbortError') {
        setAiStatus(`Ошибка: ${err.message}`)
        toast.error(err.message || 'Ошибка ИИ-анализа')
      }
      setAiAnalyzing(false)
    }
  }, [id, aiAnalyzing, qc])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        language: form.language || 'ru',
        published_year: form.published_year ? +form.published_year : null,
        publisher: form.publisher || null,
        isbn: form.isbn || null,
        page_count: form.page_count ? +form.page_count : null,
        narrator: form.narrator || null,
        is_public: form.is_public,
        author_names: form.author_names.split(',').map((s) => s.trim()).filter(Boolean),
        tag_names: form.tag_names.split(',').map((s) => s.trim()).filter(Boolean),
        series_names: form.series_names.split(',').map((s) => s.trim()).filter(Boolean),
      }
      if (coverUrl.trim()) payload.cover_url = coverUrl.trim()
      await booksApi.update(id, payload)
      if (coverFile) {
        const fd = new FormData()
        fd.append('file', coverFile)
        await booksApi.uploadCover(id, fd)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['book', id] })
      qc.invalidateQueries({ queryKey: ['books'] })
      qc.invalidateQueries({ queryKey: ['authors'] })
      qc.invalidateQueries({ queryKey: ['series'] })
      toast.success(t('success'))
      navigate(`/books/${id}`)
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('error')),
  })

  if (isLoading || !form) return <PageSpinner />
  if (!book) return <div className="text-center py-20" style={{ color: 'var(--text-secondary)' }}>{t('notFound')}</div>

  const canEdit = isModerator() || book.uploaded_by_id === user?.id
  if (!canEdit) {
    return <div className="text-center py-20" style={{ color: 'var(--text-secondary)' }}>{t('error')}: 403</div>
  }

  const field = (key, label, placeholder, opts = {}) => (
    <div className={opts.full ? 'sm:col-span-2' : ''}>
      <label className="label">{label}</label>
      {opts.textarea ? (
        <textarea
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="input resize-none"
          placeholder={placeholder}
          rows={4}
        />
      ) : (
        <input
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="input"
          placeholder={placeholder}
          type={opts.type || 'text'}
        />
      )}
    </div>
  )

  const onCoverFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setCoverFile(f)
    setCoverUrl('')
    setCoverPreview(URL.createObjectURL(f))
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <Link
        to={`/books/${id}`}
        className="inline-flex items-center gap-1.5 text-sm mb-4"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={15} /> {book.title}
      </Link>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('editBook')}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => runMetadataSearch(form.title, form.author_names)}
            disabled={metaStatus === 'loading' || (!form.title && !form.author_names)}
            className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {metaStatus === 'loading' ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search size={14} />
            )}
            Найти метаданные
          </button>
          <button
            type="button"
            onClick={aiAnalyzing ? stopAIAnalyze : triggerAIAnalyze}
            className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl transition-colors"
            style={aiAnalyzing
              ? { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
              : { background: 'var(--accent-muted)', color: 'var(--accent)' }}
          >
            {aiAnalyzing ? (
              <><StopCircle size={14} /> Остановить</>
            ) : (
              <><Sparkles size={14} /> ИИ-рецензия</>
            )}
          </button>
        </div>
      </div>

      {/* AI thinking panel */}
      {(aiAnalyzing || aiThinking || aiFinalReview) && (
        <div className="mb-5 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--accent)30', background: 'var(--bg-secondary)' }}>
          {/* Header with progress */}
          <div className="px-4 pt-3 pb-2 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={13} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
                  ИИ-рецензия
                </span>
                {aiAnalyzing && (
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--accent)' }} />
                )}
              </div>
              {aiAnalyzing && (
                <span className="text-xs tabular-nums flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {aiElapsed}s / {AI_TIMEOUT}s
                </span>
              )}
            </div>

            {/* Progress bar */}
            {aiAnalyzing && (
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{
                    width: `${Math.min((aiElapsed / AI_TIMEOUT) * 100, 97)}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
            )}

            {/* Status text */}
            {aiStatus && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{aiStatus}</p>
            )}
          </div>

          {/* Thinking output */}
          {aiThinking && (
            <div
              className="mx-4 mb-3 rounded-xl p-3 font-mono text-xs leading-relaxed overflow-y-auto"
              style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                maxHeight: '220px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {aiThinking}
              <div ref={thinkingRef} />
            </div>
          )}

          {/* Final review */}
          {aiFinalReview && !aiAnalyzing && (
            <div className="mx-4 mb-4 p-3 rounded-xl text-sm leading-relaxed" style={{ background: 'var(--accent-muted)', color: 'var(--text-primary)' }}>
              {aiFinalReview}
            </div>
          )}
        </div>
      )}

      {/* Metadata search results */}
      <div className="mb-5">
        <MetadataPanel
          status={metaStatus}
          allResults={allResults}
          appliedResult={appliedResult}
          onApply={applyResult}
          onRetry={() => runMetadataSearch(form.title, form.author_names)}
        />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); saveMutation.mutate() }}
        className="space-y-5"
      >
        <div className="card p-6 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-6">
          {/* Cover */}
          <div className="space-y-3">
            <div className="w-44 aspect-[2/3] rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
              {coverPreview || coverUrl || book.cover_path ? (
                <img
                  src={coverPreview || coverUrl || book.cover_path}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
                  <BookOpen size={36} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
            </div>
            <label className="btn-secondary w-44 flex items-center justify-center gap-2 text-xs cursor-pointer">
              <ImageIcon size={14} /> {t('uploadCover')}
              <input type="file" accept="image/*" className="hidden" onChange={onCoverFileChange} />
            </label>
            <div className="w-44">
              <div className="flex items-center gap-1.5 mb-1">
                <LinkIcon size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('coverFromUrl')}</span>
              </div>
              <input
                value={coverUrl}
                onChange={(e) => { setCoverUrl(e.target.value); setCoverFile(null); setCoverPreview(null) }}
                className="input text-xs py-1.5"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
            {field('title', t('bookTitle'), '', { full: true })}
            {field('author_names', t('authorName'), 'Иван Иванов, Пётр Петров', { full: true })}
            {field('series_names', t('seriesName'), '')}
            {field('tag_names', t('tagsLabel'), '')}
            <div>
              <label className="label">{t('language')}</label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="input"
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
                <option value="uk">Українська</option>
              </select>
            </div>
            {field('published_year', t('year'), '2024', { type: 'number' })}
            {field('publisher', t('publisher'), '')}
            {field('isbn', t('isbn'), '978-5-...')}
            {field('page_count', t('pages'), '', { type: 'number' })}
            {field('narrator', t('narrator') || 'Рассказчик', '')}
            <div className="flex items-center justify-between sm:col-span-2 py-1">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('publicBook')}</span>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_public: !form.is_public })}
                className={`w-12 h-6 rounded-full transition-colors relative ${form.is_public ? 'bg-primary-600' : 'bg-gray-400'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.is_public ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            {field('description', t('description'), '', { textarea: true, full: true })}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            {saveMutation.isPending ? t('loading') : t('save')}
          </button>
          <Link to={`/books/${id}`} className="btn-secondary">{t('cancel')}</Link>
        </div>
      </form>

      {/* Files & Versions section */}
      <div className="card p-6 mt-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
            {t('bookFilesTitle')}
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('bookFilesHint')}</p>
        </div>

        {/* Existing files */}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {(book.files || []).map((bf) => (
            <div key={bf.id} className="py-3 flex items-center gap-3 flex-wrap">
              <span
                className="text-xs font-semibold uppercase px-2 py-0.5 rounded"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              >
                {bf.format}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {bf.file_size ? `${(bf.file_size / 1024 / 1024).toFixed(1)} MB` : '—'}
              </span>

              {/* Inline label editor */}
              {editingLabelId === bf.id ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <input
                    value={editingLabelVal}
                    onChange={(e) => setEditingLabelVal(e.target.value)}
                    className="input text-xs py-1 flex-1 min-w-0"
                    placeholder={t('versionLabelPlaceholder')}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveLabelEdit(bf.id)
                      if (e.key === 'Escape') { setEditingLabelId(null) }
                    }}
                  />
                  <button onClick={() => saveLabelEdit(bf.id)} className="text-green-500 hover:text-green-600">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingLabelId(null)} className="text-gray-400 hover:text-gray-500">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingLabelId(bf.id); setEditingLabelVal(bf.version_label || '') }}
                  className="text-xs flex-1 text-left truncate"
                  style={{ color: bf.version_label ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  {bf.version_label || `+ ${t('versionLabel')}`}
                </button>
              )}

              <button
                onClick={() => handleDeleteFile(bf.id)}
                className="ml-auto text-red-400 hover:text-red-600 transition-colors"
                title={t('deleteFile')}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {/* Add new file */}
        <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="label text-xs">{t('versionLabel')}</label>
              <input
                value={addFileLabel}
                onChange={(e) => setAddFileLabel(e.target.value)}
                className="input text-sm"
                placeholder={t('versionLabelPlaceholder')}
              />
            </div>
            <label
              className={`btn-secondary flex items-center gap-2 text-sm cursor-pointer ${addFileUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {addFileUploading
                ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <Upload size={14} />}
              {t('addFileVersion')}
              <input
                ref={addFileInputRef}
                type="file"
                className="hidden"
                accept=".epub,.pdf,.fb2,.mobi,.txt,.djvu,.doc,.docx,.rtf,.zip"
                onChange={handleAddFile}
                disabled={addFileUploading}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  async function handleAddFile(e) {
    const file = e.target.files?.[0]
    if (addFileInputRef.current) addFileInputRef.current.value = ''
    if (!file) return
    setAddFileUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (addFileLabel.trim()) fd.append('version_label', addFileLabel.trim())
      await booksApi.addFile(id, fd)
      qc.invalidateQueries({ queryKey: ['book', id] })
      setAddFileLabel('')
      toast.success(t('fileAdded'))
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'))
    } finally {
      setAddFileUploading(false)
    }
  }

  async function saveLabelEdit(fileId) {
    setEditingLabelId(null)
    try {
      await booksApi.updateFileLabel(id, fileId, editingLabelVal)
      qc.invalidateQueries({ queryKey: ['book', id] })
      toast.success(t('labelSaved'))
    } catch {
      toast.error(t('error'))
    }
  }

  async function handleDeleteFile(fileId) {
    try {
      await booksApi.deleteFile(id, fileId)
      qc.invalidateQueries({ queryKey: ['book', id] })
      toast.success(t('fileDeleted'))
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'))
    }
  }
}
