import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { booksApi } from '../../api/books'
import { useTranslation } from '../../hooks/useTranslation'
import { PageSpinner } from '../../components/ui/Spinner'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { Edit, Trash2, Eye, Search } from 'lucide-react'
import toast from 'react-hot-toast'

export function AdminBooks() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'books', search, page],
    queryFn: () => booksApi.list({ search: search || undefined, page, page_size: 20 }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => booksApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'books'] }); toast.success(t('success')) },
    onError: () => toast.error(t('error')),
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('books')}</h1>
        <Link to="/upload" className="btn-primary text-sm">{t('uploadBook')}</Link>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Поиск книг..."
          className="input pl-9 py-2.5 text-sm"
        />
      </div>

      {isLoading ? <PageSpinner /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  {['Книга', 'Авторы', 'Форматы', 'Загрузки', 'Оценка', 'Действия'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((book) => (
                  <tr key={book.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {book.cover_path ? (
                          <img src={book.cover_path} alt="" className="w-8 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-8 h-12 bg-gray-200 dark:bg-gray-700 rounded" />
                        )}
                        <span className="font-medium line-clamp-2 max-w-xs" style={{ color: 'var(--text-primary)' }}>{book.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {book.authors?.map((a) => a.name).join(', ')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {book.files?.map((f) => (
                          <span key={f.id} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded uppercase font-medium" style={{ color: 'var(--text-muted)' }}>
                            {f.format}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{book.download_count}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {book.avg_rating > 0 ? book.avg_rating.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link to={`/books/${book.id}`} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-400 hover:text-blue-600 transition-colors">
                          <Eye size={15} />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(book.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: Math.min(data.pages, 10) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-xs font-medium ${p === page ? 'bg-primary-600 text-white' : 'border'}`}
              style={{ borderColor: p === page ? undefined : 'var(--border)', color: p === page ? undefined : 'var(--text-secondary)' }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      {deleteTarget && (
        <ConfirmModal
          title={t('deleteBook') + '?'}
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  )
}
