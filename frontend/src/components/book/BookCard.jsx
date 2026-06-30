import { Link } from 'react-router-dom'
import { StarRating } from '../ui/StarRating'
import { BookOpen } from 'lucide-react'

const COVER_GRADIENTS = [
  'from-purple-500 to-indigo-600',
  'from-blue-500 to-cyan-600',
  'from-green-500 to-emerald-600',
  'from-orange-500 to-red-600',
  'from-pink-500 to-rose-600',
  'from-teal-500 to-green-600',
  'from-violet-500 to-purple-700',
  'from-amber-500 to-orange-600',
]

function CoverPlaceholder({ title }) {
  const idx = title ? title.charCodeAt(0) % COVER_GRADIENTS.length : 0
  return (
    <div className={`w-full aspect-[2/3] rounded-xl bg-gradient-to-br ${COVER_GRADIENTS[idx]} flex flex-col items-center justify-center p-4 gap-2`}>
      <BookOpen size={40} className="text-white opacity-80" />
      <span className="text-white text-xs text-center font-medium leading-tight line-clamp-3">
        {title}
      </span>
    </div>
  )
}

export function BookCard({ book, size = 'md' }) {
  const sizeClasses = { sm: 'w-32', md: 'w-44', lg: 'w-52' }

  return (
    <Link
      to={`/books/${book.id}`}
      className={`${sizeClasses[size]} book-card flex-shrink-0 block group`}
    >
      {/* Cover with zoom-on-hover */}
      <div
        className="cover-zoom shadow-[var(--shadow)]"
        style={{ transition: 'box-shadow 0.25s ease' }}
        onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow)'}
      >
        {book.cover_path ? (
          <img
            src={book.cover_path}
            alt={book.title}
            className="book-cover"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
        ) : null}
        <div style={{ display: book.cover_path ? 'none' : 'flex' }}>
          <CoverPlaceholder title={book.title} />
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-2.5 px-0.5">
        <p className="text-sm font-medium leading-tight line-clamp-2 text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
          {book.title}
        </p>
        {book.authors?.length > 0 && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
            {book.authors.map((a) => a.name).join(', ')}
          </p>
        )}
        {book.avg_rating > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <StarRating value={book.avg_rating} size={12} />
            <span className="text-xs text-[var(--text-muted)]">{book.avg_rating.toFixed(1)}</span>
          </div>
        )}
        {book.files?.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {book.files.map((f) => (
              <span
                key={f.id}
                className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wide"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              >
                {f.format}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

export function BookListItem({ book }) {
  return (
    <Link
      to={`/books/${book.id}`}
      className="flex gap-4 p-3 rounded-xl transition-colors group"
      style={{ transition: 'background 0.15s ease' }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div className="w-16 flex-shrink-0 cover-zoom rounded-lg overflow-hidden">
        {book.cover_path ? (
          <img src={book.cover_path} alt={book.title} className="w-full aspect-[2/3] object-cover" loading="lazy" />
        ) : (
          <CoverPlaceholder title={book.title} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
          {book.title}
        </p>
        {book.authors?.length > 0 && (
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {book.authors.map((a) => a.name).join(', ')}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1">
          {book.avg_rating > 0 && (
            <div className="flex items-center gap-1">
              <StarRating value={book.avg_rating} size={12} />
              <span className="text-xs text-[var(--text-muted)]">{book.avg_rating.toFixed(1)}</span>
            </div>
          )}
          {book.published_year && (
            <span className="text-xs text-[var(--text-muted)]">{book.published_year}</span>
          )}
          <div className="flex gap-1">
            {book.files?.map((f) => (
              <span
                key={f.id}
                className="text-[10px] px-1.5 py-0.5 rounded-md uppercase font-semibold tracking-wide"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              >
                {f.format}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}

export function BookCardSkeleton() {
  return (
    <div className="w-44 flex-shrink-0 animate-fade-in">
      <div className="skeleton w-full aspect-[2/3] rounded-xl" />
      <div className="mt-2.5 space-y-1.5">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-3 w-3/4" />
      </div>
    </div>
  )
}
