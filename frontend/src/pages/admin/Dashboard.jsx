import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../api/auth'
import { useTranslation } from '../../hooks/useTranslation'
import { BookCard } from '../../components/book/BookCard'
import { PageSpinner } from '../../components/ui/Spinner'
import { BookOpen, Users, User, Library } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.stats().then((r) => r.data),
  })

  if (isLoading) return <PageSpinner />

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>{t('dashboard')}</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={BookOpen} label={t('totalBooks')} value={data?.total_books ?? 0} color="bg-blue-500" />
        <StatCard icon={Users} label={t('totalUsers')} value={data?.total_users ?? 0} color="bg-green-500" />
        <StatCard icon={User} label={t('totalAuthors')} value={data?.total_authors ?? 0} color="bg-purple-500" />
        <StatCard icon={Library} label={t('totalSeries')} value={data?.total_series ?? 0} color="bg-orange-500" />
      </div>

      {data?.books_by_format && Object.keys(data.books_by_format).length > 0 && (
        <div className="card p-5 mb-8">
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Форматы книг</h3>
          <div className="flex gap-6 flex-wrap">
            {Object.entries(data.books_by_format).map(([fmt, count]) => (
              <div key={fmt} className="text-center">
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{count}</p>
                <p className="text-sm uppercase font-medium" style={{ color: 'var(--text-muted)' }}>{fmt}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.recent_books?.length > 0 && (
        <div>
          <h3 className="section-title">Последние добавленные</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {data.recent_books.map((book) => (
              <BookCard key={book.id} book={book} size="sm" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
