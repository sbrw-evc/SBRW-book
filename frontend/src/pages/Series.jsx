import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { seriesApi } from '../api/books'
import { useAppStore } from '../store/appStore'
import { BookCard } from '../components/book/BookCard'
import { PageSpinner } from '../components/ui/Spinner'
import { useTranslation } from '../hooks/useTranslation'
import { Library, Search, Bell, BellOff } from 'lucide-react'
import toast from 'react-hot-toast'

export function SeriesList() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['series', search],
    queryFn: () => seriesApi.list({ search: search || undefined, page_size: 100 }).then((r) => r.data),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>{t('series')}</h1>
      <div className="relative mb-6 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск серий..."
          className="input pl-9 py-2.5 text-sm"
        />
      </div>
      {isLoading ? <PageSpinner /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data?.items?.map((s) => (
            <Link
              key={s.id}
              to={`/series/${s.id}`}
              className="card p-5 group cursor-pointer"
              style={{ transition: 'border-color 0.15s ease, box-shadow 0.15s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--color-p400)), rgb(var(--color-p700)))' }}>
                  <Library size={20} className="text-white" />
                </div>
                <p className="font-medium transition-colors group-hover:text-[var(--accent)]" style={{ color: 'var(--text-primary)' }}>
                  {s.name}
                </p>
              </div>
              {s.description && (
                <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{s.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function SeriesDetail() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { isAuthenticated } = useAppStore()
  const qc = useQueryClient()

  const { data: series, isLoading } = useQuery({
    queryKey: ['series', id],
    queryFn: () => seriesApi.get(id).then((r) => r.data),
  })
  const { data: books } = useQuery({
    queryKey: ['series', id, 'books'],
    queryFn: () => seriesApi.books(id).then((r) => r.data),
  })
  const { data: sub } = useQuery({
    queryKey: ['series', id, 'subscription'],
    queryFn: () => seriesApi.subscription(id).then((r) => r.data),
    enabled: isAuthenticated(),
  })

  const subMutation = useMutation({
    mutationFn: () => (sub?.subscribed ? seriesApi.unsubscribe(id) : seriesApi.subscribe(id)),
    onSuccess: (res) => {
      qc.setQueryData(['series', id, 'subscription'], res.data)
      toast.success(res.data.subscribed ? t('subscribedToSeries') : t('unsubscribedFromSeries'))
    },
    onError: () => toast.error(t('error')),
  })

  if (isLoading) return <PageSpinner />

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-2xl flex items-center justify-center">
          <Library size={32} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{series?.name}</h1>
          {series?.description && <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{series.description}</p>}
        </div>
        {isAuthenticated() && (
          <button
            onClick={() => subMutation.mutate()}
            disabled={subMutation.isPending}
            className={sub?.subscribed ? 'btn-secondary flex items-center gap-2 text-sm' : 'btn-primary flex items-center gap-2 text-sm'}
            title={t('seriesSubscriptionHint')}
          >
            {sub?.subscribed ? <BellOff size={16} /> : <Bell size={16} />}
            {sub?.subscribed ? t('unsubscribe') : t('subscribe')}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
        {books?.map((book) => <BookCard key={book.id} book={book} />)}
      </div>
    </div>
  )
}
