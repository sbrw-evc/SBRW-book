import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BookCard, BookCardSkeleton } from './BookCard'

export function BookCarousel({ title, books, loading, onViewAll }) {
  const scrollRef = useRef(null)

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' })
  }

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="section-title mb-0">{title}</h2>
        <div className="flex items-center gap-2">
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-sm font-medium transition-colors"
              style={{ color: 'var(--accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent)'}
            >
              Все →
            </button>
          )}
          <button
            onClick={() => scroll(-1)}
            className="p-1.5 rounded-lg border transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scroll(1)}
            className="p-1.5 rounded-lg border transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto scroll-hide pb-2">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <BookCardSkeleton key={i} style={{ animationDelay: `${i * 60}ms` }} />)
          : books?.map((book) => <BookCard key={book.id} book={book} />)}
      </div>
    </section>
  )
}
