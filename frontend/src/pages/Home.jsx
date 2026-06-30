import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { booksApi, tagsApi } from '../api/books'
import { BookCarousel } from '../components/book/BookCarousel'
import { useTranslation } from '../hooks/useTranslation'
import { useAppStore } from '../store/appStore'
import { Search, BookOpen, Sparkles } from 'lucide-react'
import { useState } from 'react'

export function Home() {
  const { t } = useTranslation()
  const { appName } = useAppStore()
  const navigate = useNavigate()
  const [searchQ, setSearchQ] = useState('')

  const { data: recentData,   isLoading: recentLoading   } = useQuery({ queryKey: ['books', 'recent'],   queryFn: () => booksApi.recent(12).then((r) => r.data)   })
  const { data: popularData,  isLoading: popularLoading  } = useQuery({ queryKey: ['books', 'popular'],  queryFn: () => booksApi.popular(12).then((r) => r.data)  })
  const { data: topRatedData, isLoading: topRatedLoading } = useQuery({ queryKey: ['books', 'topRated'], queryFn: () => booksApi.topRated(12).then((r) => r.data) })
  const { data: tagsData } = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list().then((r) => r.data) })

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQ.trim()) navigate(`/library?search=${encodeURIComponent(searchQ)}`)
  }

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────── */}
      <div
        className="rounded-3xl mb-10 px-5 sm:px-8 py-10 sm:py-14 text-white relative overflow-hidden"
        style={{ background: 'var(--hero-gradient)' }}
      >
        {/* Floating decorative circles */}
        <div className="absolute -right-14 -top-14 w-64 h-64 rounded-full bg-white/5 animate-float-slow" />
        <div className="absolute right-24 -bottom-16 w-44 h-44 rounded-full bg-white/5 animate-float" style={{ animationDelay: '1.2s' }} />
        <div className="absolute -left-10 bottom-8 w-32 h-32 rounded-full bg-white/5 animate-float" style={{ animationDelay: '0.6s' }} />

        {/* Content */}
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-3 animate-fade-in">
            <Sparkles size={16} className="text-white/70" />
            <span className="text-sm text-white/70 font-medium">Self-hosted digital library</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-3 animate-slide-up delay-75">
            {appName}
          </h1>
          <p className="text-white/75 mb-7 text-lg animate-slide-up delay-150">
            {t('library')} — {t('allBooks')}
          </p>
          <form onSubmit={handleSearch} className="flex gap-2 animate-slide-up delay-250">
            <div className="flex-1 relative">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder={t('search')}
                className="w-full pl-11 pr-4 py-3 rounded-xl text-gray-900 bg-white outline-none text-sm transition-shadow"
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.3)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
              />
            </div>
            <button
              type="submit"
              className="bg-white/15 hover:bg-white/25 border border-white/25 text-white font-semibold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5"
            >
              {t('search').split(' ')[0]}
            </button>
          </form>
        </div>
      </div>

      {/* ── Tags ─────────────────────────────────────────── */}
      {tagsData?.length > 0 && (
        <div className="mb-8 flex gap-2 flex-wrap">
          {tagsData.slice(0, 14).map((tag, i) => (
            <button
              key={tag.id}
              onClick={() => navigate(`/library?tag_id=${tag.id}`)}
              className="tag-chip px-3.5 py-1.5 rounded-full text-sm border animate-fade-in"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
                animationDelay: `${i * 35}ms`,
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Carousels ────────────────────────────────────── */}
      <div className="animate-slide-up delay-100">
        <BookCarousel
          title={t('newBooks')}
          books={recentData}
          loading={recentLoading}
          onViewAll={() => navigate('/library?sort=created_at&order=desc')}
        />
      </div>
      <div className="animate-slide-up delay-200">
        <BookCarousel
          title={t('popular')}
          books={popularData}
          loading={popularLoading}
          onViewAll={() => navigate('/library?sort=download_count&order=desc')}
        />
      </div>
      <div className="animate-slide-up delay-300">
        <BookCarousel
          title={t('topRated')}
          books={topRatedData}
          loading={topRatedLoading}
          onViewAll={() => navigate('/library?sort=avg_rating&order=desc')}
        />
      </div>
    </div>
  )
}
