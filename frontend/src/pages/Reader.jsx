import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { booksApi } from '../api/books'
import { usersApi } from '../api/auth'
import { useAppStore } from '../store/appStore'
import toast from 'react-hot-toast'
import { useTranslation } from '../hooks/useTranslation'
import { PageSpinner } from '../components/ui/Spinner'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Settings2, List, X, Minus, Plus,
  Moon, Sun, PenLine, Highlighter, Trash2, Eye, EyeOff, BookMarked, Check
} from 'lucide-react'

const FONTS = ['Inter', 'Georgia', 'Times New Roman', 'Arial', 'Verdana']
const EPUB_LIKE = new Set(['epub', 'fb2'])
const PDF_LIKE  = new Set(['pdf', 'djvu'])

const ANIM_OPTIONS = ['none', 'fade', 'slide']
const ANNOTATION_COLORS = {
  yellow: '#fef08a',
  green:  '#bbf7d0',
  blue:   '#bfdbfe',
  pink:   '#fbcfe8',
}

const BG_PRESETS = [
  { key: 'default', label: 'bgDefault', value: null },
  { key: 'white',   label: 'bgWhite',   value: '#ffffff' },
  { key: 'cream',   label: 'bgCream',   value: '#faf8f3' },
  { key: 'dark',    label: 'bgDark',    value: '#1a1a2e' },
  { key: 'black',   label: 'bgBlack',   value: '#0d0d0d' },
]

function buildReaderCSS() {
  const style = getComputedStyle(document.documentElement)
  const accent = style.getPropertyValue('--accent').trim() || '#4f46e5'
  
  let selectionBg = 'rgba(79,70,229,0.2)'
  if (accent.startsWith('#') && accent.length === 7) {
    const r = parseInt(accent.slice(1, 3), 16)
    const g = parseInt(accent.slice(3, 5), 16)
    const b = parseInt(accent.slice(5, 7), 16)
    selectionBg = `rgba(${r},${g},${b},0.2)`
  }
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Georgia&display=swap');

    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    p, div, span, li, td, th, blockquote {
      line-height: 1.75 !important;
      letter-spacing: 0.01em;
    }

    p { margin-bottom: 0.9em; }

    h1, h2, h3, h4, h5, h6 {
      font-weight: 700 !important;
      line-height: 1.3 !important;
      margin-top: 1.5em !important;
      margin-bottom: 0.5em !important;
      color: inherit !important;
      background: transparent !important;
      background-color: transparent !important;
      border: none !important;
    }

    h1 { font-size: 1.8em !important; }
    h2 { font-size: 1.4em !important; }
    h3 { font-size: 1.2em !important; }

    blockquote {
      border-left: 3px solid ${accent};
      margin: 1em 0;
      padding: 0.5em 1em;
      opacity: 0.85;
      font-style: italic;
    }

    a { color: ${accent}; text-decoration: none; }
    a:hover { text-decoration: underline; }

    img { max-width: 100%; height: auto; }

    ::selection { background: ${selectionBg}; }
  `
}

function isColorDark(color) {
  if (!color || color.startsWith('var(')) return false
  const m = color.match(/\d+/g)
  if (!m || m.length < 3) return false
  const [r, g, b] = m.map(Number)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

function AnnotationPanel({ bookId, isOpen, onClose, nightMode }) {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAppStore()
  const qc = useQueryClient()

  const { data: annotations = [] } = useQuery({
    queryKey: ['annotations', bookId],
    queryFn: () => booksApi.getAnnotations(bookId).then((r) => r.data),
    enabled: isOpen,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => booksApi.deleteAnnotation(bookId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['annotations', bookId] }),
  })

  const myAnnotations  = annotations.filter((a) => a.user_id === user?.id)
  const otherAnnotations = annotations.filter((a) => a.user_id !== user?.id && a.is_public)

  const annotationBg = nightMode ? '#1a1a1a' : 'var(--bg)'
  const borderColor  = nightMode ? '#333' : 'var(--border)'
  const textPrimary  = nightMode ? '#e5e5e5' : 'var(--text-primary)'
  const textSecondary = nightMode ? '#aaa' : 'var(--text-secondary)'
  const textMuted    = nightMode ? '#888' : 'var(--text-muted)'

  if (!isAuthenticated()) return null

  return (
    <div
      className="absolute right-0 top-0 w-72 h-full border-l z-20 overflow-y-auto shadow-2xl"
      style={{ background: annotationBg, borderColor }}
    >
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-sm" style={{ color: textPrimary }}>
            {t('annotations')}
          </h3>
          <button onClick={onClose}><X size={16} style={{ color: textMuted }} /></button>
        </div>

        {myAnnotations.length === 0 && otherAnnotations.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: textMuted }}>{t('noAnnotations')}</p>
        ) : (
          <div className="space-y-3">
            {[...myAnnotations, ...otherAnnotations].map((ann) => (
              <div
                key={ann.id}
                className="rounded-xl p-3 text-xs"
                style={{ background: ANNOTATION_COLORS[ann.color] || ANNOTATION_COLORS.yellow, color: '#333' }}
              >
                {ann.selected_text && (
                  <p className="font-medium mb-1 line-clamp-2 italic">«{ann.selected_text}»</p>
                )}
                {ann.note && <p className="mb-1">{ann.note}</p>}
                <div className="flex items-center justify-between mt-1 opacity-70">
                  <span>{ann.user_id === user?.id ? t('annotationPrivate') : ann.username}</span>
                  {ann.user_id === user?.id && (
                    <button onClick={() => deleteMutation.mutate(ann.id)}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AnnotationPopover({ cfiRange, selectedText, onSave, onClose, nightMode }) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [color, setColor] = useState('yellow')
  const [isPublic, setIsPublic] = useState(false)

  const bg = nightMode ? '#2a2a2a' : 'var(--bg-card)'
  const border = nightMode ? '#444' : 'var(--border)'
  const textColor = nightMode ? '#e5e5e5' : 'var(--text-primary)'

  return (
    <div
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 rounded-2xl border shadow-xl p-4 w-80"
      style={{ background: bg, borderColor: border }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold" style={{ color: textColor }}>{t('addAnnotation')}</span>
        <button onClick={onClose}><X size={16} style={{ color: nightMode ? '#888' : 'var(--text-muted)' }} /></button>
      </div>

      {selectedText && (
        <p className="text-xs italic mb-3 line-clamp-2 px-2 py-1.5 rounded-lg"
          style={{ background: nightMode ? '#333' : 'var(--bg-secondary)', color: nightMode ? '#ccc' : 'var(--text-secondary)' }}>
          «{selectedText}»
        </p>
      )}

      {/* Color picker */}
      <div className="flex gap-2 mb-3">
        {Object.entries(ANNOTATION_COLORS).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setColor(key)}
            className="w-6 h-6 rounded-full border-2 transition-all"
            style={{
              background: val,
              borderColor: color === key ? 'var(--accent)' : 'transparent',
              transform: color === key ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('annotationNote')}
        className="w-full resize-none rounded-xl p-2.5 text-sm outline-none mb-3"
        style={{ background: nightMode ? '#333' : 'var(--bg-secondary)', color: textColor, border: `1px solid ${border}` }}
        rows={2}
      />

      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsPublic(!isPublic)}
          className="flex items-center gap-1.5 text-xs"
          style={{ color: nightMode ? '#aaa' : 'var(--text-muted)' }}
        >
          {isPublic ? <Eye size={13} /> : <EyeOff size={13} />}
          {isPublic ? t('annotationPublic') : t('annotationPrivate')}
        </button>
        <button
          onClick={() => { onSave({ cfi_range: cfiRange, selected_text: selectedText, note, color, is_public: isPublic }); onClose() }}
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
        >
          <Check size={12} /> {t('saveAnnotation')}
        </button>
      </div>
    </div>
  )
}

export function Reader() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { isAuthenticated, user, setUser, setReaderUiHidden } = useAppStore()
  const qc = useQueryClient()
  const fmt = searchParams.get('fmt') || 'epub'

  const bookRef = useRef(null)
  const renditionRef = useRef(null)
  const animStyleRef = useRef('slide')
  const contentsListRef = useRef([])
  const nightModeRef = useRef(false)
  const readerBgRef = useRef(null)
  const pendingSaveRef = useRef(null)
  const savedProgressRef = useRef(isAuthenticated() ? undefined : null)
  const isFirstRelocate = useRef(true)
  const hasRestoredPosition = useRef(false)

  const [toc, setToc] = useState([])
  const [currentTocHref, setCurrentTocHref] = useState(null)
  const [showToc, setShowToc] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [fontSize, setFontSize] = useState(16)
  const [fontFamily, setFontFamily] = useState('Georgia')
  const [nightMode, setNightMode] = useState(false)
  const [animStyle, setAnimStyle] = useState('slide')
  const [readerBg, setReaderBg] = useState(null)
  const [progress, setProgress] = useState(0)
  const [cfi, setCfi] = useState(null)
  const [loading, setLoading] = useState(true)

  // Annotation state
  const [selectionCfi, setSelectionCfi] = useState(null)
  const [selectionText, setSelectionText] = useState('')
  const [showAnnotPopover, setShowAnnotPopover] = useState(false)
  const [loadedAnnotations, setLoadedAnnotations] = useState([])
  const [uiVisible, setUiVisible] = useState(true)

  const saveTimer = useRef(null)

  const { data: book } = useQuery({
    queryKey: ['book', id],
    queryFn: () => booksApi.get(id).then((r) => r.data),
  })

  const { data: savedProgress, isSuccess: progressSuccess, isError: progressError } = useQuery({
    queryKey: ['progress', id],
    queryFn: () => booksApi.getProgress(id).then((r) => r.data).catch(() => null),
    enabled: isAuthenticated(),
  })

  // Keep refs in sync so hook closures always see current values
  useEffect(() => { nightModeRef.current = nightMode }, [nightMode])
  useEffect(() => { readerBgRef.current = readerBg }, [readerBg])

  // Load user's bg preference from their profile
  useEffect(() => {
    if (user?.reader_bg !== undefined) {
      setReaderBg(user.reader_bg || null)
    }
  }, [user])

  const saveBgMutation = useMutation({
    mutationFn: (bg) => usersApi.updateMe({ reader_bg: bg }),
    onSuccess: (res) => {
      setUser(res.data)
      toast.success(t('success'))
    },
  })

  const createAnnotationMutation = useMutation({
    mutationFn: (data) => booksApi.createAnnotation(id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['annotations', id] })
      const ann = res.data
      setLoadedAnnotations((prev) => [...prev, ann])
      if (renditionRef.current && ann.cfi_range) {
        const color = ANNOTATION_COLORS[ann.color] || ANNOTATION_COLORS.yellow
        renditionRef.current.annotations.highlight(ann.cfi_range, {}, () => {}, 'hl', {
          fill: color,
          'fill-opacity': '0.4',
        })
      }
    },
  })

  // Get effective background color
  const getEffectiveBg = () => {
    if (nightMode) return '#1a1a1a'
    if (readerBg) return readerBg
    return 'var(--bg)'
  }

  // Get epub content bg
  const getContentBg = () => {
    if (nightMode) return '#1a1a1a'
    if (readerBg) return readerBg
    return getComputedStyle(document.documentElement).getPropertyValue('--bg')?.trim() || '#ffffff'
  }

  useEffect(() => {
    hasRestoredPosition.current = false
    isFirstRelocate.current = true
    savedProgressRef.current = isAuthenticated() ? undefined : null

    if (!EPUB_LIKE.has(fmt)) return
    let book, rendition

    const init = async () => {
      const ePub = (await import('epubjs')).default
      const url = booksApi.readUrl(id, fmt)
      const token = useAppStore.getState().accessToken
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buffer = await res.arrayBuffer()

      book = ePub(buffer)
      bookRef.current = book

      const container = document.getElementById('epub-container')
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || (window.innerHeight - 52)

      rendition = book.renderTo(container, {
        width: w,
        height: h,
        flow: 'paginated',
        spread: 'none',
      })
      renditionRef.current = rendition

      // Inject typography + theme CSS into each epub iframe on content render
      rendition.hooks.content.register((contents) => {
        try {
          const doc = contents.document
          if (!doc) return
          contentsListRef.current.push(contents)
          // Typography
          let typSt = doc.getElementById('sbrw-typography')
          if (!typSt) { typSt = doc.createElement('style'); typSt.id = 'sbrw-typography'; doc.head.appendChild(typSt) }
          typSt.textContent = buildReaderCSS()
          // Use refs so the hook always reads current nightMode/readerBg (not stale closure)
          const nm = nightModeRef.current
          const rb = readerBgRef.current
          const bg = nm ? '#1a1a1a' : (rb || getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff')
          const dark = isColorDark(bg)
          const tc = (nm || dark) ? '#e5e5e5' : (getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#111111')
          let themeSt = doc.getElementById('sbrw-theme')
          if (!themeSt) { themeSt = doc.createElement('style'); themeSt.id = 'sbrw-theme'; doc.head.appendChild(themeSt) }
          // Reset backgrounds/borders on all structural + heading elements (epub often sets these explicitly)
          themeSt.textContent = `h1,h2,h3,h4,h5,h6,section,div,article,nav,header,footer,aside,main,span,p,li,ul,ol,table,td,th,figure,figcaption{background:transparent!important;background-color:transparent!important;border:none!important}html,body{background:${bg}!important;background-color:${bg}!important;color:${tc}!important}`
        } catch {}
      })
      rendition.themes.fontSize(`${fontSize}px`)
      rendition.themes.font(fontFamily)
      applyTheme(rendition, nightMode, getContentBg())

      book.loaded.navigation.then((nav) => setToc(nav.toc || []))

      let locationsReady = false
      let lastCfi = null

      rendition.on('relocated', (loc) => {
        const cfi = loc.start.cfi
        setCfi(cfi)
        lastCfi = cfi
        if (loc.start.href) setCurrentTocHref(loc.start.href)

        const firstRelocate = isFirstRelocate.current
        isFirstRelocate.current = false

        let pct = null

        if (locationsReady) {
          try {
            const locs = book.locations
            if (locs?._locations?.length > 0 && locs.total > 0) {
              const locIdx = locs.locationFromCfi(cfi)
              if (locIdx >= 0) pct = Math.round((locIdx / locs.total) * 100)
            }
          } catch {}
        }

        if (pct === null) {
          try {
            const spineIdx = typeof loc.start.index === 'number'
              ? loc.start.index
              : book.spine.get(cfi)?.index
            const total = book.spine.spineItems?.length || book.spine.length || 0
            if (spineIdx != null && total > 0) {
              const pageInSection = loc.start.displayed?.page ?? 1
              const totalInSection = loc.start.displayed?.total || 1
              const sectionProgress = (pageInSection - 1) / totalInSection
              pct = Math.round(((spineIdx + sectionProgress) / total) * 100)
            }
          } catch {}
        }

        if (pct !== null) {
          setProgress(pct)
          if (!firstRelocate) {
            scheduleSave(cfi, pct)
          }
        }
      })

      rendition.on('rendered', () => setLoading(false))

      rendition.on('selected', (cfiRange, contents) => {
        const text = contents.window.getSelection()?.toString()?.trim()
        if (text && isAuthenticated()) {
          setSelectionCfi(cfiRange)
          setSelectionText(text)
          setShowAnnotPopover(true)
        }
      })

      if (savedProgressRef.current !== undefined && !hasRestoredPosition.current) {
        hasRestoredPosition.current = true
        rendition.display(savedProgressRef.current?.cfi_position || undefined)
      }

      const locKey = `epub-locs-${id}`
      const stored = localStorage.getItem(locKey)
      if (stored) {
        try {
          book.locations.load(stored)
          locationsReady = true
        } catch {
          localStorage.removeItem(locKey)
        }
      }
      if (!locationsReady) {
        book.locations.generate(1024).then(() => {
          locationsReady = true
          try { localStorage.setItem(locKey, book.locations.save()) } catch {}
          if (lastCfi) {
            try {
              const locs = book.locations
              if (locs?._locations?.length > 0 && locs.total > 0) {
                const locIdx = locs.locationFromCfi(lastCfi)
                if (locIdx >= 0) {
                  const pct = Math.round((locIdx / locs.total) * 100)
                  setProgress(pct)
                  scheduleSave(lastCfi, pct)
                }
              }
            } catch {}
          }
        }).catch(() => {})
      }

      // Load & apply existing annotations
      if (isAuthenticated()) {
        try {
          const { data: anns } = await booksApi.getAnnotations(id)
          setLoadedAnnotations(anns)
          anns.forEach((ann) => {
            if (!ann.cfi_range) return
            const color = ANNOTATION_COLORS[ann.color] || ANNOTATION_COLORS.yellow
            rendition.annotations.highlight(ann.cfi_range, {}, () => {}, 'hl', {
              fill: color,
              'fill-opacity': '0.4',
            })
          })
        } catch {}
      }
    }

    const handleResize = () => {
      const container = document.getElementById('epub-container')
      if (renditionRef.current && container) {
        renditionRef.current.resize(container.clientWidth, container.clientHeight)
      }
    }
    window.addEventListener('resize', handleResize)

    init().catch((err) => { console.error('epub init error', err); setLoading(false) })
    return () => {
      clearTimeout(saveTimer.current)
      const pending = pendingSaveRef.current
      if (pending && useAppStore.getState().accessToken) {
        booksApi.saveProgress(id, { cfi_position: pending.cfi, percentage: pending.pct }).catch(() => {})
      }
      book?.destroy()
      contentsListRef.current = []
      window.removeEventListener('resize', handleResize)
    }
  }, [id, fmt])

  // Once the progress query settles, update the ref and restore position if rendition is ready.
  // Using isSuccess/isError ensures we don't act on the initial undefined (pending) state.
  useEffect(() => {
    if (!progressSuccess && !progressError) return
    savedProgressRef.current = savedProgress ?? null
    if (renditionRef.current && !hasRestoredPosition.current) {
      hasRestoredPosition.current = true
      renditionRef.current.display(savedProgressRef.current?.cfi_position || undefined)
    }
  }, [progressSuccess, progressError, savedProgress])

  const applyTheme = (rendition, night, bg) => {
    let textColor, bgColor
    if (night) {
      textColor = '#e5e5e5'
      bgColor = '#1a1a1a'
    } else {
      bgColor = bg || '#ffffff'
      if (isColorDark(bgColor)) {
        textColor = '#e5e5e5'
      } else {
        textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary')?.trim() || '#111111'
      }
    }
    rendition.themes.override('color', textColor)
    rendition.themes.override('background', bgColor)
    rendition.themes.override('background-color', bgColor)
    // Force background + color with !important into all rendered iframes
    const themeCSS = `h1,h2,h3,h4,h5,h6,section,div,article,nav,header,footer,aside,main,span,p,li,ul,ol,table,td,th,figure,figcaption{background:transparent!important;background-color:transparent!important;border:none!important}html,body{background:${bgColor}!important;background-color:${bgColor}!important;color:${textColor}!important}`
    contentsListRef.current.forEach((contents) => {
      try {
        const doc = contents.document
        if (!doc) return
        let st = doc.getElementById('sbrw-theme')
        if (!st) { st = doc.createElement('style'); st.id = 'sbrw-theme'; doc.head.appendChild(st) }
        st.textContent = themeCSS
      } catch {}
    })
  }

  const scheduleSave = useCallback((position, pct) => {
    if (typeof pct !== 'number' || isNaN(pct)) return
    pendingSaveRef.current = { cfi: position, pct }
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (isAuthenticated()) {
        booksApi.saveProgress(id, { cfi_position: position, percentage: pct })
          .then(() => {
            pendingSaveRef.current = null
            qc.invalidateQueries({ queryKey: ['book', id, 'progress'] })
          })
          .catch(() => {})
      }
    }, 2000)
  }, [id, qc])

  const changeFont = (size) => {
    setFontSize(size)
    renditionRef.current?.themes.fontSize(`${size}px`)
  }

  const toggleNight = () => {
    const next = !nightMode
    setNightMode(next)
    if (renditionRef.current) applyTheme(renditionRef.current, next, getContentBg())
  }

  const changeAnimStyle = (style) => {
    setAnimStyle(style)
    animStyleRef.current = style
  }

  const flipPage = useCallback((fn, dir) => {
    const style = animStyleRef.current
    if (style === 'none' || !renditionRef.current) { fn(); return }
    const el = document.getElementById('epub-container')
    if (!el) { fn(); return }

    if (style === 'fade') {
      el.style.cssText = 'transition:opacity .18s ease;opacity:0'
      setTimeout(() => {
        fn()
        el.style.cssText = 'transition:none;opacity:0'
        requestAnimationFrame(() => requestAnimationFrame(() => {
          el.style.cssText = 'transition:opacity .18s ease;opacity:1'
        }))
      }, 185)
    } else {
      const outX = dir === 'next' ? '-18px' : '18px'
      const inX  = dir === 'next' ? '18px'  : '-18px'
      el.style.cssText = `transition:opacity .15s ease,transform .15s ease;opacity:0;transform:translateX(${outX})`
      setTimeout(() => {
        fn()
        el.style.cssText = `transition:none;opacity:0;transform:translateX(${inX})`
        requestAnimationFrame(() => requestAnimationFrame(() => {
          el.style.cssText = 'transition:opacity .15s ease,transform .15s ease;opacity:1;transform:translateX(0)'
        }))
      }, 160)
    }
  }, [])

  const goNext = useCallback(() => flipPage(() => renditionRef.current?.next(), 'next'), [flipPage])
  const goPrev = useCallback(() => flipPage(() => renditionRef.current?.prev(), 'prev'), [flipPage])

  const handleCenterTap = useCallback(() => {
    setUiVisible((v) => {
      setReaderUiHidden(v)   // hide chat when UI goes away, restore when it comes back
      return !v
    })
  }, [setReaderUiHidden])

  // Reset flag when leaving the reader
  useEffect(() => () => setReaderUiHidden(false), [setReaderUiHidden])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') goNext()
    if (e.key === 'ArrowLeft') goPrev()
  }, [goNext, goPrev])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Resize epub rendition after UI header animates in/out
  useEffect(() => {
    if (!EPUB_LIKE.has(fmt)) return
    const timer = setTimeout(() => {
      const container = document.getElementById('epub-container')
      if (renditionRef.current && container) {
        renditionRef.current.resize(container.clientWidth, container.clientHeight)
      }
    }, 220)
    return () => clearTimeout(timer)
  }, [uiVisible, fmt])

  if (PDF_LIKE.has(fmt)) {
    return (
      <div className="h-screen flex flex-col" style={{ background: nightMode ? '#1a1a1a' : 'var(--bg)' }}>
        <div className="flex items-center gap-3 px-4 h-12 border-b" style={{ borderColor: 'var(--border)' }}>
          <Link
            to={`/books/${id}`}
            className="p-1.5 rounded-lg transition-colors"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <ArrowLeft size={18} style={{ color: 'var(--text-secondary)' }} />
          </Link>
          <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{book?.title}</span>
        </div>
        <iframe
          src={booksApi.readUrl(id, fmt)}
          className="flex-1 w-full border-0"
          title={book?.title}
        />
      </div>
    )
  }

  const nightBg = nightMode ? '#1a1a1a' : (readerBg || 'var(--bg)')
  const nightBorder = nightMode ? '#333' : 'var(--border)'
  const nightText = nightMode ? '#aaa' : 'var(--text-secondary)'
  const nightMuted = nightMode ? '#888' : 'var(--text-muted)'

  return (
    <div
      className="h-screen flex flex-col select-none"
      style={{ background: nightBg }}
    >
      {/* Toolbar + progress — slide away on mobile center-tap */}
      <div
        className="flex-shrink-0 overflow-hidden"
        style={{
          maxHeight: uiVisible ? '60px' : 0,
          opacity: uiVisible ? 1 : 0,
          transition: 'max-height 0.2s ease, opacity 0.15s ease',
        }}
      >
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 h-12 border-b"
        style={{ background: nightMode ? '#1a1a1a' : 'var(--bg)', borderColor: nightBorder }}
      >
        <Link
          to={`/books/${id}`}
          className="p-1.5 rounded-lg transition-colors"
          onMouseEnter={(e) => { e.currentTarget.style.background = nightMode ? '#2a2a2a' : 'var(--bg-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <ArrowLeft size={18} style={{ color: nightText }} />
        </Link>
        <span className="flex-1 font-medium text-sm truncate" style={{ color: nightMode ? '#e5e5e5' : 'var(--text-primary)' }}>
          {book?.title}
        </span>
        <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ color: nightMuted, background: nightMode ? '#2a2a2a' : 'var(--bg-secondary)' }}>
          {progress}%
        </div>
        {isAuthenticated() && (
          <button
            onClick={() => { setShowAnnotations(!showAnnotations); setShowToc(false); setShowSettings(false) }}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              background: showAnnotations ? 'var(--accent-muted)' : 'transparent',
              color: showAnnotations ? 'var(--accent)' : nightText,
            }}
            onMouseEnter={(e) => { if (!showAnnotations) e.currentTarget.style.background = nightMode ? '#2a2a2a' : 'var(--bg-hover)' }}
            onMouseLeave={(e) => { if (!showAnnotations) e.currentTarget.style.background = 'transparent' }}
          >
            <PenLine size={18} />
          </button>
        )}
        <button
          onClick={() => { setShowToc(!showToc); setShowSettings(false); setShowAnnotations(false) }}
          className="p-1.5 rounded-lg transition-colors"
          style={{
            background: showToc ? 'var(--accent-muted)' : 'transparent',
            color: showToc ? 'var(--accent)' : nightText,
          }}
          onMouseEnter={(e) => { if (!showToc) e.currentTarget.style.background = nightMode ? '#2a2a2a' : 'var(--bg-hover)' }}
          onMouseLeave={(e) => { if (!showToc) e.currentTarget.style.background = 'transparent' }}
        >
          <List size={18} />
        </button>
        <button
          onClick={() => { setShowSettings(!showSettings); setShowToc(false); setShowAnnotations(false) }}
          className="p-1.5 rounded-lg transition-colors"
          style={{
            background: showSettings ? 'var(--accent-muted)' : 'transparent',
            color: showSettings ? 'var(--accent)' : nightText,
          }}
          onMouseEnter={(e) => { if (!showSettings) e.currentTarget.style.background = nightMode ? '#2a2a2a' : 'var(--bg-hover)' }}
          onMouseLeave={(e) => { if (!showSettings) e.currentTarget.style.background = 'transparent' }}
        >
          <Settings2 size={18} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5" style={{ background: nightMode ? '#333' : 'var(--border)' }}>
        <div className="h-full bg-primary-600 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      </div>{/* end animated header wrapper */}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Backdrop — dims book content when any panel is open */}
        {(showToc || showSettings || showAnnotations) && (
          <div
            className="absolute inset-0 z-10"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={() => { setShowToc(false); setShowSettings(false); setShowAnnotations(false) }}
          />
        )}

        {/* TOC Sidebar — overlay, does not push content */}
        {showToc && (
          <div
            className="absolute left-0 top-0 h-full w-64 border-r overflow-y-auto z-20 shadow-2xl"
            style={{ background: nightMode ? '#1a1a1a' : 'var(--bg)', borderColor: nightBorder }}
          >
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm" style={{ color: nightMode ? '#e5e5e5' : 'var(--text-primary)' }}>
                  {t('tableOfContents')}
                </h3>
                <button onClick={() => setShowToc(false)}><X size={16} style={{ color: nightMuted }} /></button>
              </div>
              <div className="space-y-0.5">
                {toc.map((item, i) => {
                  const itemPath = item.href?.split('#')[0] || ''
                  const isActive = currentTocHref && (
                    currentTocHref === itemPath ||
                    currentTocHref.endsWith('/' + itemPath) ||
                    itemPath.endsWith('/' + currentTocHref) ||
                    currentTocHref === item.href
                  )
                  return (
                    <button
                      key={i}
                      onClick={() => { renditionRef.current?.display(item.href); setShowToc(false) }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{
                        color: isActive ? 'var(--accent)' : (nightMode ? '#ccc' : 'var(--text-secondary)'),
                        background: isActive ? 'var(--accent-muted)' : 'transparent',
                        fontWeight: isActive ? 600 : 400,
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = nightMode ? '#2a2a2a' : 'var(--bg-hover)' }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Settings panel — overlay */}
        {showSettings && (
          <div
            className="absolute right-0 top-0 w-72 h-full border-l z-20 overflow-y-auto shadow-2xl"
            style={{ background: nightMode ? '#1a1a1a' : 'var(--bg)', borderColor: nightBorder }}
          >
            <div className="p-4 space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold" style={{ color: nightMode ? '#e5e5e5' : 'var(--text-primary)' }}>
                  {t('settings')}
                </h3>
                <button onClick={() => setShowSettings(false)}><X size={16} style={{ color: nightMuted }} /></button>
              </div>

              {/* Font size */}
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: nightMode ? '#ccc' : 'var(--text-secondary)' }}>
                  {t('fontSize')}: {fontSize}px
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => changeFont(Math.max(10, fontSize - 2))} className="p-2 rounded-lg border" style={{ borderColor: nightBorder, color: nightMode ? '#ccc' : 'var(--text-secondary)' }}>
                    <Minus size={14} />
                  </button>
                  <div className="flex-1 h-2 rounded-full" style={{ background: nightMode ? '#333' : 'var(--border)' }}>
                    <div className="h-2 rounded-full bg-primary-600" style={{ width: `${((fontSize - 10) / 22) * 100}%` }} />
                  </div>
                  <button onClick={() => changeFont(Math.min(32, fontSize + 2))} className="p-2 rounded-lg border" style={{ borderColor: nightBorder, color: nightMode ? '#ccc' : 'var(--text-secondary)' }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Font family */}
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: nightMode ? '#ccc' : 'var(--text-secondary)' }}>
                  {t('fontFamily')}
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {FONTS.map((f) => (
                    <button
                      key={f}
                      onClick={() => { setFontFamily(f); renditionRef.current?.themes.font(f) }}
                      className="px-3 py-2 rounded-lg text-sm text-left border transition-colors"
                      style={{
                        fontFamily: f,
                        borderColor: fontFamily === f ? 'var(--accent)' : (nightMode ? '#333' : 'var(--border)'),
                        color: fontFamily === f ? 'var(--accent)' : (nightMode ? '#ccc' : 'var(--text-secondary)'),
                        background: fontFamily === f ? 'var(--accent-muted)' : 'transparent',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Night mode */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: nightMode ? '#ccc' : 'var(--text-secondary)' }}>
                  {t('nightMode')}
                </span>
                <button
                  onClick={toggleNight}
                  className="w-12 h-6 rounded-full transition-colors relative"
                  style={{ background: nightMode ? 'var(--accent)' : 'var(--border-strong)' }}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full transition-all ${nightMode ? 'left-7' : 'left-1'}`}
                    style={{ background: nightMode ? '#fff' : 'var(--bg-card)' }} />
                </button>
              </div>

              {/* Animation style */}
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: nightMode ? '#ccc' : 'var(--text-secondary)' }}>
                  {t('pageAnimations')}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ANIM_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => changeAnimStyle(opt)}
                      className="px-2 py-2 rounded-lg text-xs border transition-colors"
                      style={{
                        borderColor: animStyle === opt ? 'var(--accent)' : (nightMode ? '#333' : 'var(--border)'),
                        color: animStyle === opt ? 'var(--accent)' : (nightMode ? '#ccc' : 'var(--text-secondary)'),
                        background: animStyle === opt ? 'var(--accent-muted)' : 'transparent',
                      }}
                    >
                      {t(`anim${opt.charAt(0).toUpperCase() + opt.slice(1)}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background */}
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: nightMode ? '#ccc' : 'var(--text-secondary)' }}>
                  {t('readerBackground')}
                </label>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {BG_PRESETS.map(({ key, value }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setReaderBg(value)
                        if (renditionRef.current) applyTheme(renditionRef.current, nightMode, value || getComputedStyle(document.documentElement).getPropertyValue('--bg')?.trim())
                      }}
                      className="w-8 h-8 rounded-lg border-2 transition-all"
                      style={{
                        background: value || 'var(--bg)',
                        borderColor: readerBg === value ? 'var(--accent)' : (nightMode ? '#444' : 'var(--border)'),
                        transform: readerBg === value ? 'scale(1.1)' : 'scale(1)',
                      }}
                      title={key}
                    />
                  ))}
                </div>
                {isAuthenticated() && (
                  <button
                    onClick={() => saveBgMutation.mutate(readerBg)}
                    className="w-full text-xs py-1.5 rounded-xl font-medium transition-colors"
                    disabled={saveBgMutation.isPending}
                    style={{
                      border: `1px solid ${nightMode ? '#444' : 'var(--border)'}`,
                      color: nightMode ? '#ccc' : 'var(--text-secondary)',
                      background: 'transparent',
                      opacity: saveBgMutation.isPending ? 0.5 : 1,
                    }}
                  >
                    {t('bgSave')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Annotations panel */}
        {showAnnotations && (
          <AnnotationPanel
            bookId={id}
            isOpen={showAnnotations}
            onClose={() => setShowAnnotations(false)}
            nightMode={nightMode}
          />
        )}

        {/* EPUB container */}
        <div className="flex-1 relative flex flex-col">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-30" style={{ background: nightMode ? '#1a1a1a' : 'var(--bg)' }}>
              <PageSpinner />
            </div>
          )}
          <div id="epub-container" className="flex-1" />

          {/* Annotation creation popover */}
          {showAnnotPopover && selectionCfi && (
            <AnnotationPopover
              cfiRange={selectionCfi}
              selectedText={selectionText}
              nightMode={nightMode}
              onSave={(data) => createAnnotationMutation.mutate(data)}
              onClose={() => { setShowAnnotPopover(false); setSelectionCfi(null); setSelectionText('') }}
            />
          )}

          {/* Mobile: three invisible tap zones — left=prev, center=toggle UI, right=next */}
          <div className="absolute inset-0 flex md:hidden" style={{ zIndex: 5 }}>
            <div className="w-1/5 h-full" onClick={goPrev} />
            <div className="flex-1 h-full" onClick={handleCenterTap} />
            <div className="w-1/5 h-full" onClick={goNext} />
          </div>

          {/* Desktop: arrow buttons (keyboard arrows also work) */}
          <button
            onClick={goPrev}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-xl shadow-md transition-opacity hover:opacity-100 opacity-40"
            style={{ background: nightMode ? '#2a2a2a' : 'var(--bg-card)' }}
          >
            <ChevronLeft size={20} style={{ color: nightMode ? '#e5e5e5' : 'var(--text-primary)' }} />
          </button>
          <button
            onClick={goNext}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-xl shadow-md transition-opacity hover:opacity-100 opacity-40"
            style={{ background: nightMode ? '#2a2a2a' : 'var(--bg-card)' }}
          >
            <ChevronRight size={20} style={{ color: nightMode ? '#e5e5e5' : 'var(--text-primary)' }} />
          </button>
        </div>
      </div>
    </div>
  )
}
