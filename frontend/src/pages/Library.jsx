import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { booksApi, tagsApi } from '../api/books'
import { BookCard, BookListItem } from '../components/book/BookCard'
import { PageSpinner } from '../components/ui/Spinner'
import { useTranslation } from '../hooks/useTranslation'
import { Filter, Grid, List, ChevronDown, X, Search } from 'lucide-react'

const FORMATS = ['epub', 'pdf', 'mobi', 'fb2', 'txt']
const SORT_OPTIONS = [
  { value: 'created_at', order: 'desc', labelKey: 'sortByDate' },
  { value: 'avg_rating', order: 'desc', labelKey: 'sortByRating' },
  { value: 'title', order: 'asc', labelKey: 'sortByTitle' },
  { value: 'download_count', order: 'desc', labelKey: 'sortByDownloads' },
]

export function Library() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState('grid')
  const [showFilters, setShowFilters] = useState(false)

  const search = searchParams.get('search') || ''
  const authorId = searchParams.get('author_id') || ''
  const seriesId = searchParams.get('series_id') || ''
  const tagId = searchParams.get('tag_id') || ''
  const language = searchParams.get('language') || ''
  const format = searchParams.get('format') || ''
  const sort = searchParams.get('sort') || 'created_at'
  const order = searchParams.get('order') || 'desc'
  const page = parseInt(searchParams.get('page') || '1')

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.set('page', '1')
    setSearchParams(next)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['books', 'list', { search, authorId, seriesId, tagId, language, format, sort, order, page }],
    queryFn: () =>
      booksApi.list({
        search: search || undefined,
        author_id: authorId || undefined,
        series_id: seriesId || undefined,
        tag_id: tagId || undefined,
        language: language || undefined,
        format: format || undefined,
        sort,
        order,
        page,
        page_size: 24,
      }).then((r) => r.data),
    keepPreviousData: true,
  })

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list().then((r) => r.data),
  })

  const hasFilters = search || authorId || tagId || language || format

  const sortLabel = SORT_OPTIONS.find((s) => s.value === sort)?.labelKey || 'sortByDate'

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('library')}
          {data?.total > 0 && (
            <span className="ml-2 text-base font-normal" style={{ color: 'var(--text-muted)' }}>
              {data.total}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
              showFilters || hasFilters ? 'border-primary-600 text-primary-600 bg-primary-50 dark:bg-primary-950' : 'border-[var(--border)]'
            }`}
            style={{ color: showFilters || hasFilters ? undefined : 'var(--text-secondary)' }}
          >
            <Filter size={15} />
            {t('filters')}
            {hasFilters && <span className="w-2 h-2 bg-primary-600 rounded-full" />}
          </button>

          {/* Sort dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium border-[var(--border)] transition-colors hover:border-gray-300" style={{ color: 'var(--text-secondary)' }}>
              {t(sortLabel)}
              <ChevronDown size={14} />
            </button>
            <div
              className="hidden group-hover:block absolute right-0 top-full mt-1 w-44 rounded-xl shadow-lg border z-20 py-1"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams)
                    next.set('sort', s.value)
                    next.set('order', s.order)
                    setSearchParams(next)
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    sort === s.value ? 'text-primary-600 font-medium' : ''
                  }`}
                  style={{ color: sort === s.value ? undefined : 'var(--text-secondary)' }}
                >
                  {t(s.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-primary-600 text-white' : ''}`} style={{ color: viewMode === 'grid' ? undefined : 'var(--text-secondary)' }}>
              <Grid size={16} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-primary-600 text-white' : ''}`} style={{ color: viewMode === 'list' ? undefined : 'var(--text-secondary)' }}>
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="card p-5 mb-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">{t('search')}</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setParam('search', e.target.value)}
                  className="input pl-8 py-2 text-sm"
                  placeholder={t('search')}
                />
              </div>
            </div>
            <div>
              <label className="label">{t('format')}</label>
              <select
                value={format}
                onChange={(e) => setParam('format', e.target.value)}
                className="input py-2 text-sm"
              >
                <option value="">{t('allFormats')}</option>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>{f.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('language')}</label>
              <select
                value={language}
                onChange={(e) => setParam('language', e.target.value)}
                className="input py-2 text-sm"
              >
                <option value="">Все</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
              </select>
            </div>
            <div>
              <label className="label">{t('genre')}</label>
              <select
                value={tagId}
                onChange={(e) => setParam('tag_id', e.target.value)}
                className="input py-2 text-sm"
              >
                <option value="">{t('allGenres')}</option>
                {tagsData?.map((tag) => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            </div>
          </div>
          {hasFilters && (
            <button
              onClick={() => { setSearchParams(new URLSearchParams()) }}
              className="mt-3 flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
            >
              <X size={14} /> Сбросить фильтры
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <PageSpinner />
      ) : !data?.items?.length ? (
        <div className="text-center py-20">
          <p className="text-xl font-medium" style={{ color: 'var(--text-secondary)' }}>{t('noBooks')}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {data.items.map((book) => (
            <BookCard key={book.id} book={book} size="md" />
          ))}
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {data.items.map((book) => <BookListItem key={book.id} book={book} />)}
        </div>
      )}

      {/* Pagination */}
      {data?.pages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          {Array.from({ length: Math.min(data.pages, 10) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.set('page', String(p))
                setSearchParams(next)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                p === page ? 'bg-primary-600 text-white' : 'border hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              style={{ borderColor: p === page ? undefined : 'var(--border)', color: p === page ? undefined : 'var(--text-secondary)' }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
