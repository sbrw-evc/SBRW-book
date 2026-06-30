import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authorsApi } from '../api/books'
import { BookCard } from '../components/book/BookCard'
import { PageSpinner } from '../components/ui/Spinner'
import { useTranslation } from '../hooks/useTranslation'
import { Search, User } from 'lucide-react'

export function Authors() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['authors', search],
    queryFn: () => authorsApi.list({ search: search || undefined, page_size: 100 }).then((r) => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('authors')}</h1>
      </div>
      <div className="relative mb-6 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск авторов..."
          className="input pl-9 py-2.5 text-sm"
        />
      </div>
      {isLoading ? <PageSpinner /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {data?.items?.map((author) => (
            <Link
              key={author.id}
              to={`/authors/${author.id}`}
              className="card p-4 flex flex-col items-center text-center group cursor-pointer"
              style={{ transition: 'border-color 0.15s ease, box-shadow 0.15s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgb(var(--color-p400)), rgb(var(--color-p600)))' }}>
                {author.photo ? (
                  <img src={author.photo} alt={author.name} className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <User size={28} className="text-white" />
                )}
              </div>
              <p className="font-medium text-sm line-clamp-2 transition-colors group-hover:text-[var(--accent)]" style={{ color: 'var(--text-primary)' }}>
                {author.name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function AuthorDetail() {
  const { id } = useParams()
  const { t } = useTranslation()

  const { data: author, isLoading: authorLoading } = useQuery({
    queryKey: ['author', id],
    queryFn: () => authorsApi.get(id).then((r) => r.data),
  })

  const { data: books, isLoading: booksLoading } = useQuery({
    queryKey: ['author', id, 'books'],
    queryFn: () => authorsApi.books(id).then((r) => r.data),
  })

  if (authorLoading) return <PageSpinner />

  return (
    <div>
      <div className="flex items-start gap-6 mb-10">
        <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
          {author?.photo ? (
            <img src={author.photo} alt={author.name} className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <User size={40} className="text-white" />
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{author?.name}</h1>
          {author?.bio && (
            <p className="text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--text-secondary)' }}>{author.bio}</p>
          )}
        </div>
      </div>
      <h2 className="section-title">{t('books')}</h2>
      {booksLoading ? <PageSpinner /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {books?.map((book) => <BookCard key={book.id} book={book} />)}
        </div>
      )}
    </div>
  )
}
