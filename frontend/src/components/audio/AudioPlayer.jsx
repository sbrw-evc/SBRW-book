import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, List, X, ChevronUp } from 'lucide-react'
import { booksApi } from '../../api/books'
import { useAppStore } from '../../store/appStore'
import toast from 'react-hot-toast'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function AudioPlayer({ book, chapters, initialChapterIndex = 0, initialSeekSeconds = 0, onClose, autoPlay = true }) {
  const audioRef = useRef(null)
  const pendingSeekRef = useRef(null)
  const closingRef = useRef(false)

  const [visible, setVisible] = useState(false)
  const [chapterIdx, setChapterIdx] = useState(initialChapterIndex)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1)
  const [showChapters, setShowChapters] = useState(false)
  const [loading, setLoading] = useState(false)

  const { isAuthenticated } = useAppStore()
  const authed = isAuthenticated()
  const chapter = chapters[chapterIdx]

  // ── Save progress ─────────────────────────────────────────────────────────

  const saveProgress = useCallback((idx, posSeconds) => {
    if (!authed) return
    const ch = chapters[idx]
    if (!ch) return
    booksApi.saveAudioProgress(book.id, {
      chapter_id: ch.id,
      position_seconds: Math.floor(posSeconds),
    }).catch((err) => console.error('[AudioPlayer] saveProgress failed', err?.response?.data || err?.message))
  }, [authed, book.id, chapters])

  // ── Load chapter ──────────────────────────────────────────────────────────

  const loadChapter = useCallback((idx, autoplay = false) => {
    const ch = chapters[idx]
    if (!ch || !audioRef.current) return
    setLoading(true)
    setCurrentTime(0)
    setDuration(0)
    audioRef.current.src = booksApi.audioStreamUrl(book.id, ch.id)
    audioRef.current.load()
    if (autoplay) audioRef.current.play().catch(() => {})
  }, [book.id, chapters])

  // ── Init: optionally restore saved position, then animate in ──────────────

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      if (initialSeekSeconds > 0) {
        // Resume position pre-loaded by caller — use directly, no extra API call
        pendingSeekRef.current = initialSeekSeconds
        if (!cancelled) loadChapter(initialChapterIndex, autoPlay)
      } else if (authed && initialChapterIndex === 0) {
        // Fallback: fetch saved progress from server (e.g. audioProgress not yet cached)
        try {
          const { data } = await booksApi.getAudioProgress(book.id)
          if (!cancelled && data.resume_chapter_id) {
            const idx = chapters.findIndex((ch) => ch.id === data.resume_chapter_id)
            if (idx >= 0) {
              setChapterIdx(idx)
              loadChapter(idx, autoPlay)
              pendingSeekRef.current = data.resume_position_seconds || 0
              return
            }
          }
        } catch {}
        if (!cancelled) loadChapter(initialChapterIndex, autoPlay)
      } else {
        if (!cancelled) loadChapter(initialChapterIndex, autoPlay)
      }
    }

    init()
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    return () => { cancelled = true; cancelAnimationFrame(raf) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-save every 10 s while playing ────────────────────────────────────

  useEffect(() => {
    if (!authed) return
    const id = setInterval(() => {
      const el = audioRef.current
      if (!el || el.paused) return
      saveProgress(chapterIdx, el.currentTime)
    }, 10_000)
    return () => clearInterval(id)
  }, [authed, chapterIdx, saveProgress])

  // ── Audio events ──────────────────────────────────────────────────────────

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onTime = () => setCurrentTime(el.currentTime)
    const onDur = () => { setDuration(el.duration); setLoading(false) }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      if (chapterIdx < chapters.length - 1) {
        const next = chapterIdx + 1
        setChapterIdx(next)
        loadChapter(next, true)
        saveProgress(next, 0)
      } else {
        setPlaying(false)
      }
    }
    const onWaiting = () => setLoading(true)
    const onCanPlay = () => {
      setLoading(false)
      if (pendingSeekRef.current !== null) {
        el.currentTime = pendingSeekRef.current
        pendingSeekRef.current = null
      }
    }
    const onError = () => {
      setLoading(false)
      setPlaying(false)
      const code = el.error?.code
      if (code === 2) toast.error('Ошибка сети при загрузке аудио')
      else if (code === 3) toast.error('Не удалось декодировать аудиофайл')
      else if (code === 4) toast.error('Аудиофайл недоступен')
      else toast.error('Ошибка воспроизведения аудио')
    }

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('durationchange', onDur)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    el.addEventListener('waiting', onWaiting)
    el.addEventListener('canplay', onCanPlay)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('durationchange', onDur)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('waiting', onWaiting)
      el.removeEventListener('canplay', onCanPlay)
      el.removeEventListener('error', onError)
    }
  }, [chapterIdx, chapters.length, loadChapter, saveProgress])

  // ── Controls ──────────────────────────────────────────────────────────────

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }

  const seek = (e) => {
    const el = audioRef.current
    if (!el || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    el.currentTime = ratio * duration
  }

  const skip = (delta) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min(el.currentTime + delta, duration))
  }

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length
    setSpeedIdx(next)
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next]
  }

  const goToChapter = (idx) => {
    saveProgress(chapterIdx, audioRef.current?.currentTime || 0)
    setChapterIdx(idx)
    loadChapter(idx, playing)
    setShowChapters(false)
  }

  const toggleMute = () => {
    const el = audioRef.current
    if (!el) return
    el.muted = !muted
    setMuted(!muted)
  }

  const changeVolume = (e) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audioRef.current) {
      audioRef.current.volume = v
      if (v === 0) setMuted(true)
      else if (muted) { setMuted(false); audioRef.current.muted = false }
    }
  }

  // ── Close with exit animation ─────────────────────────────────────────────

  const handleClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    saveProgress(chapterIdx, audioRef.current?.currentTime || 0)
    setVisible(false)
    setTimeout(() => onClose?.(), 380)
  }

  const progress = duration > 0 ? currentTime / duration : 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <audio ref={audioRef} preload="metadata" />

      {/* Fixed outer stack — centered capsule */}
      <div
        className="fixed left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* Chapter list panel */}
        {showChapters && (
          <div
            className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-scale-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                Главы ({chapters.length})
              </span>
              <button
                onClick={() => setShowChapters(false)}
                className="p-1 rounded-lg transition-all active:scale-90"
                style={{ color: 'var(--text-muted)' }}
              >
                <ChevronUp size={16} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-64">
              {chapters.map((ch, idx) => (
                <button
                  key={ch.id}
                  onClick={() => goToChapter(idx)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all active:scale-[0.98] hover:bg-[var(--accent-muted)]"
                  style={{ background: idx === chapterIdx ? 'var(--accent-muted)' : undefined }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: idx === chapterIdx ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: idx === chapterIdx ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {ch.chapter_number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm truncate font-medium"
                      style={{ color: idx === chapterIdx ? 'var(--accent)' : 'var(--text-primary)' }}
                    >
                      {ch.title}
                    </p>
                    {ch.duration_seconds && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatTime(ch.duration_seconds)}</p>
                    )}
                  </div>
                  {idx === chapterIdx && playing && (
                    <span className="flex gap-0.5 items-end h-4 flex-shrink-0">
                      {[3, 5, 4].map((h, i) => (
                        <span
                          key={i}
                          className="w-1 rounded-full animate-pulse"
                          style={{ height: `${h * 3}px`, background: 'var(--accent)', animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Player capsule ── */}
        <div
          className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(80px) scale(0.95)',
            opacity: visible ? 1 : 0,
            transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease',
          }}
        >
          {/* Progress bar — h-4 container gives the thumb dot room to render without being clipped */}
          <div
            className="h-4 cursor-pointer group relative flex items-center"
            onClick={seek}
          >
            {/* Track */}
            <div className="absolute inset-x-0 h-1 rounded-full" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${progress * 100}%`, background: 'var(--accent)', transition: 'width 0.25s linear' }}
              />
            </div>
            {/* Thumb */}
            <div
              className="absolute w-2.5 h-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${progress * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', background: 'var(--accent)' }}
            />
          </div>

          {/* Main content row */}
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">

            {/* Cover */}
            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
              {book.cover_path ? (
                <img src={book.cover_path} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>A</span>
                </div>
              )}
            </div>

            {/* Title + chapter name */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
                {book.title}
              </p>
              <p className="text-xs truncate leading-tight" style={{ color: 'var(--text-muted)' }}>
                {chapter?.title || ''}
              </p>
            </div>

            {/* Playback controls */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => skip(-30)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 hover:bg-[var(--bg-secondary)]"
                title="-30с"
              >
                <SkipBack size={16} style={{ color: 'var(--text-secondary)' }} />
              </button>

              <button
                onClick={togglePlay}
                disabled={loading}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : playing ? (
                  <Pause size={17} className="text-white" />
                ) : (
                  <Play size={17} className="text-white ml-0.5" />
                )}
              </button>

              <button
                onClick={() => skip(30)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 hover:bg-[var(--bg-secondary)]"
                title="+30с"
              >
                <SkipForward size={16} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* Secondary controls */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={cycleSpeed}
                className="px-2 py-1 rounded-lg text-xs font-bold transition-all active:scale-90 hover:bg-[var(--bg-secondary)]"
                style={{ color: 'var(--text-secondary)', minWidth: '2.5rem' }}
              >
                {SPEEDS[speedIdx]}×
              </button>

              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={toggleMute}
                  className="w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90 hover:bg-[var(--bg-secondary)]"
                >
                  {muted || volume === 0
                    ? <VolumeX size={14} style={{ color: 'var(--text-muted)' }} />
                    : <Volume2 size={14} style={{ color: 'var(--text-muted)' }} />}
                </button>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={muted ? 0 : volume}
                  onChange={changeVolume}
                  className="w-16 accent-[var(--accent)]"
                />
              </div>

              <button
                onClick={() => setShowChapters((v) => !v)}
                className="w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90 hover:bg-[var(--bg-secondary)]"
                title="Главы"
              >
                <List size={15} style={{ color: showChapters ? 'var(--accent)' : 'var(--text-muted)' }} />
              </button>

              <button
                onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90 hover:bg-[var(--bg-secondary)]"
              >
                <X size={15} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>

          {/* Time stamp row */}
          <div className="flex justify-end px-4 pb-2.5">
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
