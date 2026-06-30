import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shelvesApi } from '../api/auth'
import { BookCard } from '../components/book/BookCard'
import { PageSpinner } from '../components/ui/Spinner'
import { useTranslation } from '../hooks/useTranslation'
import { Plus, BookMarked, Trash2, Globe, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

export function Shelves() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newShelf, setNewShelf] = useState({ name: '', description: '', is_public: false })

  const { data: shelves, isLoading } = useQuery({
    queryKey: ['shelves'],
    queryFn: () => shelvesApi.list().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => shelvesApi.create(newShelf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shelves'] })
      setShowCreate(false)
      setNewShelf({ name: '', description: '', is_public: false })
      toast.success(t('success'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => shelvesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shelves'] }); toast.success(t('success')) },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('myCollections')}</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          {t('createShelf')}
        </button>
      </div>

      {showCreate && (
        <div className="card p-5 mb-6 animate-fade-in">
          <div className="space-y-3">
            <div>
              <label className="label">{t('shelfName')}</label>
              <input
                value={newShelf.name}
                onChange={(e) => setNewShelf({ ...newShelf, name: e.target.value })}
                className="input"
                placeholder="Моя полка"
                autoFocus
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newShelf.is_public}
                onChange={(e) => setNewShelf({ ...newShelf, is_public: e.target.checked })}
                className="w-4 h-4 accent-primary-600"
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('public')}</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => newShelf.name && createMutation.mutate()} disabled={!newShelf.name} className="btn-primary">
                {t('save')}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? <PageSpinner /> : !shelves?.length ? (
        <div className="text-center py-20">
          <BookMarked size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>{t('noShelves')}</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">{t('createFirst')}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shelves.map((shelf) => (
            <div key={shelf.id} className="card p-5 hover:border-primary-300 transition-colors group">
              <div className="flex justify-between items-start mb-3">
                <Link to={`/shelves/${shelf.id}`} className="flex-1">
                  <h3 className="font-semibold group-hover:text-primary-600 transition-colors" style={{ color: 'var(--text-primary)' }}>
                    {shelf.name}
                  </h3>
                </Link>
                <div className="flex items-center gap-1 ml-2">
                  {shelf.is_public ? (
                    <Globe size={14} style={{ color: 'var(--text-muted)' }} />
                  ) : (
                    <Lock size={14} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(shelf.id)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-red-400 hover:text-red-600 transition-colors ml-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {shelf.description && (
                <p className="text-sm line-clamp-2" style={{ color: 'var(--text-muted)' }}>{shelf.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ShelfDetail() {
  const { id } = useParams()
  const { t } = useTranslation()

  const { data: shelf, isLoading } = useQuery({
    queryKey: ['shelf', id],
    queryFn: () => shelvesApi.get(id).then((r) => r.data),
  })

  if (isLoading) return <PageSpinner />

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>{shelf?.name}</h1>
      {!shelf?.books?.length ? (
        <p style={{ color: 'var(--text-muted)' }}>Полка пуста</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {shelf.books.map((book) => <BookCard key={book.id} book={book} />)}
        </div>
      )}
    </div>
  )
}
