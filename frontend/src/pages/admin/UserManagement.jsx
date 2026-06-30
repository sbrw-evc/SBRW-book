import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../api/auth'
import { useAppStore } from '../../store/appStore'
import { useTranslation } from '../../hooks/useTranslation'
import { PageSpinner } from '../../components/ui/Spinner'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { Search, Shield, UserX, UserCheck, Trash2, UserPlus, X } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const ROLES = ['user', 'moderator', 'admin']

function CreateUserModal({ onClose, onCreated }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => usersApi.create(form),
    onSuccess: () => { toast.success(t('success')); onCreated() },
    onError: (err) => setError(err.response?.data?.detail || t('error')),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!form.username || !form.email || !form.password) { setError(t('required')); return }
    if (form.password.length < 8) { setError(t('passwordMin')); return }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
            Создать пользователя
          </h3>
          <button onClick={onClose}><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">{t('username')}</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="input text-sm"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">{t('email')}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input text-sm"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">{t('password')}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input text-sm"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">{t('role')}</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="input text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{t(`role${r.charAt(0).toUpperCase() + r.slice(1)}`)}</option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm flex-1">{t('cancel')}</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary text-sm flex-1">
              {mutation.isPending ? t('loading') : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function UserManagement() {
  const { t } = useTranslation()
  const { user: currentUser, isAdmin } = useAppStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => usersApi.list({ search: search || undefined }).then((r) => r.data),
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => usersApi.updateRole(id, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(t('success')) },
    onError: () => toast.error(t('error')),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => usersApi.updateRole(id, { is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(t('success')) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(t('success')) },
    onError: (err) => toast.error(err.response?.data?.detail || t('error')),
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('users')}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{users?.length ?? 0} пользователей</span>
          {isAdmin() && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2 text-sm py-2"
            >
              <UserPlus size={15} />
              Создать
            </button>
          )}
        </div>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или email..."
          className="input pl-9 py-2.5 text-sm"
        />
      </div>

      {isLoading ? <PageSpinner /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  {['Пользователь', 'Email', t('role'), 'Статус', t('registeredAt'), 'Действия'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: 'var(--accent-muted)' }}>
                          <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                            {u.username[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{u.username}</span>
                        {u.id === currentUser?.id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                            вы
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td className="px-4 py-3">
                      {isAdmin() && u.id !== currentUser?.id ? (
                        <select
                          value={u.role}
                          onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value })}
                          className="text-xs px-2 py-1 rounded-lg border outline-none"
                          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{t(`role${r.charAt(0).toUpperCase() + r.slice(1)}`)}</option>)}
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                          u.role === 'moderator' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}>
                          {t(`role${u.role.charAt(0).toUpperCase() + u.role.slice(1)}`)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {u.is_active ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {format(new Date(u.created_at), 'dd.MM.yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      {u.id !== currentUser?.id && isAdmin() && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleActiveMutation.mutate({ id: u.id, is_active: !u.is_active })}
                            className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'hover:bg-orange-50 text-orange-400 hover:text-orange-600' : 'hover:bg-green-50 text-green-400 hover:text-green-600'}`}
                            title={u.is_active ? 'Заблокировать' : 'Разблокировать'}
                          >
                            {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(u.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['users'] }) }}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title={t('deleteUser') + '?'}
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  )
}
