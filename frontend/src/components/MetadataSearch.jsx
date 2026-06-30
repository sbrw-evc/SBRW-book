import { useState } from 'react'
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Check, BookOpen } from 'lucide-react'

export const SOURCE_COLORS = {
  'Google Books':  { bg: 'rgba(66,133,244,0.12)',  text: '#4285F4' },
  'Open Library':  { bg: 'rgba(250,165,0,0.12)',   text: '#c97800' },
  'ЛитРес':        { bg: 'rgba(237,28,28,0.12)',   text: '#ed1c1c' },
  'Author.Today':  { bg: 'rgba(16,185,129,0.12)',  text: '#059669' },
  'Fantlab':       { bg: 'rgba(99,102,241,0.12)',  text: '#6366f1' },
}

export function SourceBadge({ source }) {
  const colors = SOURCE_COLORS[source] || { bg: 'var(--bg-hover)', text: 'var(--text-muted)' }
  return (
    <span
      className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: colors.bg, color: colors.text }}
    >
      {source}
    </span>
  )
}

export function ResultCard({ result, selected, onApply }) {
  return (
    <div
      onClick={onApply}
      className="flex-shrink-0 w-36 cursor-pointer rounded-xl border overflow-hidden transition-all duration-150"
      style={{
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        background: selected ? 'var(--accent-muted)' : 'var(--bg-card)',
        boxShadow: selected ? '0 0 0 2px var(--accent)' : 'var(--shadow)',
      }}
    >
      <div className="w-full h-44 overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        {result.cover_url ? (
          <img src={result.cover_url} alt={result.title} className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={28} style={{ color: 'var(--text-muted)' }} />
          </div>
        )}
      </div>
      <div className="p-2 space-y-1">
        <SourceBadge source={result.source} />
        <p className="text-xs font-semibold leading-tight line-clamp-2" style={{ color: 'var(--text-primary)' }}>
          {result.title || '—'}
        </p>
        {result.authors?.length > 0 && (
          <p className="text-[11px] line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
            {result.authors.slice(0, 2).join(', ')}
          </p>
        )}
        <div className="flex items-center justify-between">
          {result.published_year && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{result.published_year}</span>
          )}
          {selected && (
            <span className="ml-auto flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
              <Check size={11} /> Применено
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function MetadataPanel({ status, allResults, appliedResult, onApply, onRetry }) {
  const [expanded, setExpanded] = useState(true)
  const [activeSource, setActiveSource] = useState('all')

  if (status === 'idle') return null

  const sources  = [...new Set(allResults.map((r) => r.source))]
  const filtered = activeSource === 'all' ? allResults : allResults.filter((r) => r.source === activeSource)

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: expanded ? '1px solid var(--border)' : 'none' }}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Найдено онлайн</span>
          {status === 'loading' && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Поиск по источникам...
            </span>
          )}
          {status === 'done' && allResults.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
              {allResults.length} результатов
            </span>
          )}
          {status === 'done' && allResults.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Ничего не найдено</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === 'done' && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onRetry() }}
              className="p-1 rounded-lg transition-colors" title="Обновить поиск"
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <RefreshCw size={13} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
          {expanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {status === 'done' && sources.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {['all', ...sources].map((src) => (
                <button key={src} type="button" onClick={() => setActiveSource(src)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: activeSource === src ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: activeSource === src ? '#fff' : 'var(--text-secondary)',
                  }}>
                  {src === 'all' ? `Все (${allResults.length})` : src}
                </button>
              ))}
            </div>
          )}

          {status === 'loading' && (
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-36 h-64 rounded-xl skeleton" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          )}

          {status === 'done' && filtered.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
              {filtered.map((result, idx) => (
                <ResultCard key={`${result.source}-${idx}`} result={result}
                  selected={appliedResult === result} onApply={() => onApply(result)} />
              ))}
            </div>
          )}

          {status === 'done' && filtered.length === 0 && (
            <div className="py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Нет результатов по этому фильтру
            </div>
          )}

          {status === 'error' && (
            <div className="py-3 text-center">
              <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Не удалось получить данные</p>
              <button type="button" onClick={onRetry} className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
                Попробовать ещё раз
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
