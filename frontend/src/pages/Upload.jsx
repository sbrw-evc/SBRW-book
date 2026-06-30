import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { booksApi } from '../api/books'
import { useTranslation } from '../hooks/useTranslation'
import {
  Upload as UploadIcon, X, Check, Search,
  ExternalLink, ChevronDown, ChevronUp, Globe,
  BookOpen, Headphones, Mic, Plus, Trash2, GripVertical, Minus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { MetadataPanel } from '../components/MetadataSearch'

const BOOK_EXTS = ['.epub', '.pdf', '.mobi', '.fb2', '.txt', '.djvu', '.doc', '.docx', '.rtf']
const AUDIO_EXTS = ['.mp3', '.m4a', '.m4b', '.ogg', '.flac', '.aac', '.opus']
const AUDIO_ACCEPT = { 'audio/*': AUDIO_EXTS }

// ─── Shared ──────────────────────────────────────────────────────────────────

function ModeTab({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all"
      style={{
        background: active ? 'var(--bg-card)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      {icon} {label}
    </button>
  )
}

// ─── BookSearch (for attach-to-existing) ────────────────────────────────────

function BookSearchSelect({ value, onChange }) {
  const [query, setQuery] = useState(value?.title || '')
  const [open, setOpen] = useState(false)

  const { data, isFetching } = useQuery({
    queryKey: ['books-search', query],
    queryFn: () => booksApi.list({ search: query, page_size: 10 }).then((r) => r.data.items),
    enabled: query.length >= 2,
    staleTime: 30000,
  })

  const pick = (book) => {
    onChange(book)
    setQuery(book.title)
    setOpen(false)
  }

  return (
    <div className="relative">
      <label className="label">Выберите книгу</label>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="input pr-8"
          placeholder="Начните вводить название книги..."
        />
        {isFetching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--accent)' }} />
        )}
      </div>

      {open && data?.length > 0 && (
        <div
          className="absolute z-20 w-full mt-1 rounded-xl shadow-xl overflow-hidden border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {data.map((book) => (
            <button
              key={book.id}
              type="button"
              onMouseDown={() => pick(book)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-secondary)]"
            >
              {book.cover_path ? (
                <img src={book.cover_path} alt="" className="w-8 h-12 object-cover rounded flex-shrink-0" />
              ) : (
                <div className="w-8 h-12 rounded flex-shrink-0 flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
                  <BookOpen size={12} style={{ color: 'var(--accent)' }} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{book.title}</p>
                {book.authors?.length > 0 && (
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{book.authors.map((a) => a.name).join(', ')}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {value && (
        <div className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--accent-muted)' }}>
          {value.cover_path ? (
            <img src={value.cover_path} alt="" className="w-8 h-12 object-cover rounded flex-shrink-0" />
          ) : (
            <div className="w-8 h-12 rounded flex-shrink-0 flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
              <BookOpen size={12} style={{ color: 'var(--accent)' }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{value.title}</p>
            {value.authors?.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{value.authors.map((a) => a.name).join(', ')}</p>
            )}
          </div>
          <button type="button" onClick={() => { onChange(null); setQuery('') }} className="p-1" style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── AudioChapterList ─────────────────────────────────────────────────────────

function AudioChapterList({ chapters, onChange }) {
  const updateChapter = (idx, patch) => {
    onChange(chapters.map((ch, i) => i === idx ? { ...ch, ...patch } : ch))
  }

  const removeChapter = (idx) => {
    onChange(chapters.filter((_, i) => i !== idx))
  }

  if (!chapters.length) return null

  return (
    <div className="space-y-2">
      {chapters.map((ch, idx) => (
        <div
          key={ch.id}
          className="flex items-center gap-2 p-3 rounded-xl"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <GripVertical size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />

          {/* Chapter number stepper */}
          <div
            className="flex items-center gap-1 flex-shrink-0 rounded-xl px-1.5 py-1"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={() => updateChapter(idx, { number: Math.max(1, ch.number - 1) })}
              className="w-5 h-5 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <Minus size={10} />
            </button>
            <span
              className="w-6 text-center text-sm font-bold tabular-nums select-none"
              style={{ color: 'var(--accent)' }}
            >
              {ch.number}
            </span>
            <button
              type="button"
              onClick={() => updateChapter(idx, { number: ch.number + 1 })}
              className="w-5 h-5 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <Plus size={10} />
            </button>
          </div>

          <input
            value={ch.title}
            onChange={(e) => updateChapter(idx, { title: e.target.value })}
            className="input flex-1 py-1.5 text-sm"
            placeholder="Название главы"
          />

          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {(ch.file.size / 1024 / 1024).toFixed(1)} МБ
          </span>

          <button
            type="button"
            onClick={() => removeChapter(idx)}
            className="p-1.5 flex-shrink-0 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Upload page ──────────────────────────────────────────────────────────────

export function Upload() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // mode: 'book' | 'audio'
  const [mode, setMode] = useState('book')
  // audioTarget: 'existing' | 'new'
  const [audioTarget, setAudioTarget] = useState('new')

  // --- Book upload state ---
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({
    title: '', author: '', series: '', tags: '',
    language: '', description: '', publisher: '', year: '', isbn: '', coverUrl: '',
  })
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [metaStatus, setMetaStatus] = useState('idle')
  const [allResults, setAllResults] = useState([])
  const [appliedResult, setAppliedResult] = useState(null)
  const [showDescription, setShowDescription] = useState(false)

  // --- Audio upload state ---
  const [audioForm, setAudioForm] = useState({
    title: '', author: '', series: '', tags: '',
    language: '', description: '', publisher: '', year: '', isbn: '', coverUrl: '', narrator: '',
  })
  const [audioChapters, setAudioChapters] = useState([]) // [{id, file, title, number}]
  const [selectedBook, setSelectedBook] = useState(null) // existing book object
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [audioProgress, setAudioProgress] = useState({ current: 0, total: 0 })
  const [uploadedToBookId, setUploadedToBookId] = useState(null) // set after successful upload to existing book

  const { data: existingChapters = [], isLoading: existingLoading } = useQuery({
    queryKey: ['book', selectedBook?.id, 'audio'],
    queryFn: () => booksApi.getAudioChapters(selectedBook.id).then((r) => r.data),
    enabled: audioTarget === 'existing' && !!selectedBook,
  })

  const deleteExistingChapter = async (chapterId) => {
    try {
      await booksApi.deleteAudioChapter(selectedBook.id, chapterId)
      qc.invalidateQueries({ queryKey: ['book', selectedBook.id, 'audio'] })
      toast.success('Глава удалена')
    } catch {
      toast.error('Ошибка при удалении')
    }
  }

  const runMetadataSearch = useCallback(async (fileArg, titleHint, authorHint) => {
    setMetaStatus('loading')
    setAllResults([])
    setAppliedResult(null)
    try {
      let data
      if (fileArg) {
        const fd = new FormData()
        fd.append('file', fileArg)
        if (titleHint) fd.append('title', titleHint)
        if (authorHint) fd.append('authors', authorHint);
        ({ data } = await booksApi.extractMetadata(fd))
      } else {
        ({ data } = await booksApi.searchMetadata({ title: titleHint, authors: authorHint }))
      }
      const fm = data.file_meta || {}
      setForm((prev) => ({
        ...prev,
        title: prev.title || fm.title || titleHint || '',
        author: prev.author || (fm.authors || []).join(', ') || authorHint || '',
        language: prev.language || fm.language || '',
        description: prev.description || fm.description || '',
        publisher: prev.publisher || fm.publisher || '',
        year: prev.year || (fm.published_year?.toString() || ''),
        isbn: prev.isbn || fm.isbn || '',
      }))
      const flat = (data.sources || []).flatMap((s) => s.results || [])
      setAllResults(flat)
      setMetaStatus('done')
      if (data.best && flat.length > 0) {
        setForm((prev) => {
          const b = data.best
          return {
            title: prev.title || b.title || '',
            author: prev.author || (b.authors || []).join(', ') || '',
            series: prev.series || b.series || '',
            tags: prev.tags || (b.genres || []).slice(0, 6).join(', ') || '',
            language: prev.language || b.language || '',
            description: prev.description || b.description || '',
            publisher: prev.publisher || b.publisher || '',
            year: prev.year || (b.published_year?.toString() || ''),
            isbn: prev.isbn || b.isbn || '',
            coverUrl: prev.coverUrl || b.cover_url || '',
          }
        })
      }
    } catch {
      setMetaStatus('error')
    }
  }, [])

  const onDrop = useCallback(async (accepted) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    const guessedTitle = f.name.replace(/\.[^.]+$/, '').replace(/[_]/g, ' ').trim()
    setForm({ title: '', author: '', series: '', tags: '', language: '', description: '', publisher: '', year: '', isbn: '', coverUrl: '' })
    await runMetadataSearch(f, guessedTitle, '')
  }, [runMetadataSearch])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': BOOK_EXTS },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024,
  })

  const applyResult = (result) => {
    setAppliedResult(result)
    setForm({
      title: result.title || form.title,
      author: (result.authors || []).join(', ') || form.author,
      series: result.series || form.series,
      tags: (result.genres || []).slice(0, 8).join(', ') || form.tags,
      language: result.language || form.language,
      description: result.description || form.description,
      publisher: result.publisher || form.publisher,
      year: result.published_year?.toString() || form.year,
      isbn: result.isbn || form.isbn,
      coverUrl: result.cover_url || form.coverUrl,
    })
    if (result.description) setShowDescription(true)
  }

  const handleRetry = () => {
    if (file) runMetadataSearch(file, form.title, form.author)
    else if (form.title) runMetadataSearch(null, form.title, form.author)
  }

  // Book submit
  const handleBookSubmit = async (e) => {
    e.preventDefault()
    if (!file) { toast.error('Выберите файл'); return }
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    if (form.title)       fd.append('title', form.title)
    if (form.author)      fd.append('author', form.author)
    if (form.series)      fd.append('series', form.series)
    if (form.tags)        fd.append('tags', form.tags)
    if (form.language)    fd.append('language', form.language)
    if (form.description) fd.append('description', form.description)
    if (form.publisher)   fd.append('publisher', form.publisher)
    if (form.year)        fd.append('published_year', form.year)
    if (form.isbn)        fd.append('isbn', form.isbn)
    if (form.coverUrl)    fd.append('cover_url', form.coverUrl)
    try {
      const { data } = await booksApi.upload(fd, (evt) => {
        setUploadProgress(Math.round((evt.loaded / evt.total) * 100))
      })
      toast.success(t('uploadSuccess'))
      qc.invalidateQueries({ queryKey: ['books'] })
      navigate(`/books/${data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || t('uploadError'))
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  // Audio files drop
  const onAudioDrop = useCallback((accepted) => {
    const base = existingChapters.length + audioChapters.length
    const newChapters = accepted.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      file: f,
      title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').trim(),
      number: base + i + 1,
    }))
    setAudioChapters((prev) => [...prev, ...newChapters])
  }, [audioChapters, existingChapters])

  const { getRootProps: getAudioRootProps, getInputProps: getAudioInputProps, isDragActive: isAudioDragActive } = useDropzone({
    onDrop: onAudioDrop,
    accept: AUDIO_ACCEPT,
    multiple: true,
    maxSize: 500 * 1024 * 1024,
  })

  // Audio submit
  const handleAudioSubmit = async (e) => {
    e.preventDefault()

    if (audioChapters.length === 0) {
      toast.error('Добавьте хотя бы одну аудиофайл')
      return
    }

    let targetBookId

    if (audioTarget === 'existing') {
      if (!selectedBook) { toast.error('Выберите книгу'); return }
      targetBookId = selectedBook.id
      setUploadingAudio(true)
    } else {
      if (!audioForm.title.trim()) { toast.error('Укажите название'); return }
      setUploadingAudio(true)
      try {
        const { data: newBook } = await booksApi.createAudioBook({
          title: audioForm.title,
          author: audioForm.author,
          series: audioForm.series,
          tags: audioForm.tags,
          language: audioForm.language || 'ru',
          description: audioForm.description,
          publisher: audioForm.publisher,
          published_year: audioForm.year || null,
          isbn: audioForm.isbn,
          cover_url: audioForm.coverUrl,
          narrator: audioForm.narrator,
        })
        targetBookId = newBook.id
        qc.invalidateQueries({ queryKey: ['books'] })
      } catch (err) {
        toast.error(err.response?.data?.detail || t('uploadError'))
        setUploadingAudio(false)
        return
      }
    }

    // Sort chapters by number before uploading
    const sorted = [...audioChapters].sort((a, b) => a.number - b.number)
    setAudioProgress({ current: 0, total: sorted.length })

    let succeeded = 0
    for (let i = 0; i < sorted.length; i++) {
      const ch = sorted[i]
      setAudioProgress({ current: i + 1, total: sorted.length })
      const fd = new FormData()
      fd.append('audio_file', ch.file)
      fd.append('title', ch.title)
      fd.append('chapter_number', String(ch.number))
      try {
        await booksApi.uploadAudioChapter(targetBookId, fd)
        succeeded++
      } catch (err) {
        toast.error(`Глава "${ch.title}": ${err.response?.data?.detail || 'ошибка загрузки'}`)
      }
    }

    setUploadingAudio(false)
    setAudioProgress({ current: 0, total: 0 })

    if (succeeded > 0) {
      toast.success(`Загружено ${succeeded} из ${sorted.length} ${sorted.length === 1 ? 'главы' : 'глав'}`)
      qc.invalidateQueries({ queryKey: ['book', targetBookId, 'audio'] })
      if (audioTarget === 'existing') {
        setAudioChapters([])
        setUploadedToBookId(targetBookId)
      } else {
        navigate(`/books/${targetBookId}`)
      }
    } else {
      toast.error('Не удалось загрузить ни одну главу')
    }
  }

  const field = (key, label, placeholder, opts = {}) => (
    <div key={key}>
      <label className="label">{label}</label>
      {opts.textarea ? (
        <textarea
          value={opts.source === 'audio' ? audioForm[key] : form[key]}
          onChange={(e) => opts.source === 'audio'
            ? setAudioForm({ ...audioForm, [key]: e.target.value })
            : setForm({ ...form, [key]: e.target.value })
          }
          className="input resize-none"
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          value={opts.source === 'audio' ? audioForm[key] : form[key]}
          onChange={(e) => opts.source === 'audio'
            ? setAudioForm({ ...audioForm, [key]: e.target.value })
            : setForm({ ...form, [key]: e.target.value })
          }
          className="input"
          placeholder={placeholder}
          type={opts.type || 'text'}
        />
      )}
    </div>
  )

  const af = (key, label, placeholder, opts = {}) => field(key, label, placeholder, { ...opts, source: 'audio' })

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('uploadTitle')}
      </h1>

      {/* Mode switcher */}
      <div className="flex gap-1 p-1 rounded-2xl mb-6" style={{ background: 'var(--bg-secondary)' }}>
        <ModeTab
          active={mode === 'book'}
          onClick={() => setMode('book')}
          icon={<BookOpen size={15} />}
          label="Книга"
        />
        <ModeTab
          active={mode === 'audio'}
          onClick={() => setMode('audio')}
          icon={<Headphones size={15} />}
          label="Аудиокнига"
        />
      </div>

      {/* ═══════════════ BOOK MODE ═══════════════ */}
      {mode === 'book' && (
        <form onSubmit={handleBookSubmit} className="space-y-5">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${isDragActive ? 'scale-[1.01]' : ''}`}
            style={{
              borderColor: isDragActive ? 'var(--accent)' : 'var(--border)',
              background: isDragActive ? 'var(--accent-muted)' : 'var(--bg-card)',
            }}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)' }}>
                  <Check size={20} style={{ color: '#059669' }} />
                </div>
                <div className="text-left min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null); setMetaStatus('idle'); setAllResults([]); setAppliedResult(null)
                    setForm({ title: '', author: '', series: '', tags: '', language: '', description: '', publisher: '', year: '', isbn: '', coverUrl: '' })
                  }}
                  className="ml-auto p-1.5 rounded-lg"
                >
                  <X size={16} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            ) : (
              <div>
                <UploadIcon size={36} className="mx-auto mb-3" style={{ color: 'var(--accent)' }} />
                <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('dragAndDrop')}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('supportedFormats')}</p>
              </div>
            )}
          </div>

          {uploading && (
            <div>
              <div className="flex justify-between text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                <span>{t('uploading')}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full bg-primary-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <MetadataPanel
            status={metaStatus}
            allResults={allResults}
            appliedResult={appliedResult}
            onApply={applyResult}
            onRetry={handleRetry}
          />

          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Метаданные книги</h3>
              {(form.title || form.author) && metaStatus !== 'loading' && (
                <button
                  type="button"
                  onClick={() => runMetadataSearch(file || null, form.title, form.author)}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  <Search size={12} /> Найти по этим данным
                </button>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Данные заполняются автоматически. Вы можете отредактировать их перед загрузкой.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('title', t('bookTitle'), 'Название книги')}
              {field('author', t('authorName'), 'Иван Иванов')}
              {field('series', t('seriesName'), 'Серия книг')}
              {field('tags', t('tagsLabel'), 'фантастика, роман')}
              <div>
                <label className="label">{t('language')}</label>
                <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="input">
                  <option value="">Автоопределение</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                  <option value="uk">Українська</option>
                </select>
              </div>
              {field('year', 'Год издания', '2024', { type: 'number' })}
              {field('publisher', t('publisher'), 'Издательство')}
              {field('isbn', t('isbn'), '978-5-...')}
            </div>
            <div>
              <button type="button" onClick={() => setShowDescription(!showDescription)} className="flex items-center gap-1.5 text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                {showDescription ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {t('description')}
                {form.description && !showDescription && <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: 'var(--bg-hover)' }}>заполнено</span>}
              </button>
              {showDescription && field('description', '', 'Описание книги...', { textarea: true })}
            </div>
            {appliedResult?.source_url && (
              <a href={appliedResult.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
                <Globe size={12} /> Источник: {appliedResult.source} <ExternalLink size={10} />
              </a>
            )}
          </div>

          <button type="submit" disabled={!file || uploading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {uploading ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('uploading')}</>
            ) : (
              <><UploadIcon size={18} />{t('uploadTitle')}</>
            )}
          </button>
        </form>
      )}

      {/* ═══════════════ AUDIO MODE ═══════════════ */}
      {mode === 'audio' && (
        <form onSubmit={handleAudioSubmit} className="space-y-5">

          {/* Audio target selector */}
          <div className="card p-4 space-y-3">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Куда добавить аудио?</p>
            <div className="flex gap-3">
              {[
                { key: 'new', label: 'Новая аудиокнига', desc: 'Создать отдельную запись без текстового файла' },
                { key: 'existing', label: 'К существующей книге', desc: 'Прикрепить аудио к уже загруженной книге' },
              ].map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAudioTarget(key)}
                  className="flex-1 text-left p-3 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: audioTarget === key ? 'var(--accent)' : 'var(--border)',
                    background: audioTarget === key ? 'var(--accent-muted)' : 'var(--bg-card)',
                  }}
                >
                  <p className="text-sm font-semibold mb-0.5" style={{ color: audioTarget === key ? 'var(--accent)' : 'var(--text-primary)' }}>{label}</p>
                  <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Existing book selector */}
          {audioTarget === 'existing' && (
            <div className="card p-4 space-y-4">
              <BookSearchSelect
                value={selectedBook}
                onChange={(book) => {
                  setSelectedBook(book)
                  setAudioChapters([])
                  setUploadedToBookId(null)
                }}
              />

              {/* Existing chapters */}
              {selectedBook && (
                <div>
                  {existingLoading ? (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Загрузка глав…</p>
                  ) : existingChapters.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                        Уже загружено: {existingChapters.length} {existingChapters.length === 1 ? 'глава' : 'глав'}
                      </p>
                      <div className="space-y-1.5">
                        {existingChapters.map((ch) => (
                          <div
                            key={ch.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{ background: 'var(--bg-secondary)' }}
                          >
                            <span
                              className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0"
                              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                            >
                              {ch.chapter_number}
                            </span>
                            <p className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{ch.title}</p>
                            {ch.duration_seconds && (
                              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                {Math.floor(ch.duration_seconds / 60)}м
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteExistingChapter(ch.id)}
                              className="p-1 flex-shrink-0 rounded hover:bg-red-100 dark:hover:bg-red-950/40"
                              style={{ color: '#ef4444' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Аудиоглав ещё нет</p>
                  )}
                </div>
              )}

              {/* Success banner: uploaded, add more? */}
              {uploadedToBookId && (
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}
                >
                  <div className="flex items-center gap-2">
                    <Check size={15} style={{ color: '#059669' }} />
                    <span className="text-sm font-medium" style={{ color: '#059669' }}>Главы загружены</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/books/${uploadedToBookId}`)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: '#059669', color: '#fff' }}
                  >
                    Перейти к книге →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* New audiobook metadata */}
          {audioTarget === 'new' && (
            <div className="card p-6 space-y-4">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Метаданные аудиокниги</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {af('title', t('bookTitle'), 'Название аудиокниги')}
                {af('author', t('authorName'), 'Иван Иванов')}
                {af('narrator', t('narrator') || 'Рассказчик', 'Имя рассказчика')}
                {af('series', t('seriesName'), 'Серия')}
                {af('tags', t('tagsLabel'), 'фантастика, аудио')}
                <div>
                  <label className="label">{t('language')}</label>
                  <select value={audioForm.language} onChange={(e) => setAudioForm({ ...audioForm, language: e.target.value })} className="input">
                    <option value="">Автоопределение</option>
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="fr">Français</option>
                    <option value="es">Español</option>
                    <option value="uk">Українська</option>
                  </select>
                </div>
                {af('year', 'Год издания', '2024', { type: 'number' })}
                {af('publisher', t('publisher'), 'Издательство')}
                {af('isbn', t('isbn'), '978-5-...')}
                {af('coverUrl', 'Обложка (URL)', 'https://...')}
              </div>
              <div>
                <button type="button" onClick={() => setShowDescription(!showDescription)} className="flex items-center gap-1.5 text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {showDescription ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {t('description')}
                  {audioForm.description && !showDescription && <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: 'var(--bg-hover)' }}>заполнено</span>}
                </button>
                {showDescription && af('description', '', 'Описание аудиокниги...', { textarea: true })}
              </div>
            </div>
          )}

          {/* Audio files drop zone */}
          <div className="card p-4 space-y-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Аудиофайлы
              {audioChapters.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                  {audioChapters.length} глав
                </span>
              )}
            </h3>

            <div
              {...getAudioRootProps()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isAudioDragActive ? 'scale-[1.01]' : ''}`}
              style={{
                borderColor: isAudioDragActive ? 'var(--accent)' : 'var(--border)',
                background: isAudioDragActive ? 'var(--accent-muted)' : 'transparent',
              }}
            >
              <input {...getAudioInputProps()} />
              <Headphones size={28} className="mx-auto mb-2" style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                {existingChapters.length > 0 ? 'Добавить следующую главу' : 'Перетащите аудиофайлы или нажмите'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                MP3, M4A, M4B, OGG, FLAC, AAC, OPUS · можно выбрать сразу несколько
              </p>
            </div>

            {audioChapters.length > 0 && (
              <>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Укажите название и номер для каждой главы. Файлы будут загружены в порядке номеров.
                </p>
                <AudioChapterList chapters={audioChapters} onChange={setAudioChapters} />
                <button
                  type="button"
                  onClick={() => setAudioChapters([])}
                  className="text-xs flex items-center gap-1.5"
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={12} /> Очистить все
                </button>
              </>
            )}
          </div>

          {/* Audio upload progress */}
          {uploadingAudio && audioProgress.total > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                <span>Загружается глава {audioProgress.current} из {audioProgress.total}…</span>
                <span>{Math.round((audioProgress.current / audioProgress.total) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${(audioProgress.current / audioProgress.total) * 100}%`, background: 'var(--accent)' }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={uploadingAudio || audioChapters.length === 0 || (audioTarget === 'existing' && !selectedBook) || (audioTarget === 'new' && !audioForm.title.trim())}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            {uploadingAudio ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('uploading')}</>
            ) : (
              <><Headphones size={18} />Загрузить аудиокнигу ({audioChapters.length} {audioChapters.length === 1 ? 'глава' : 'глав'})</>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
