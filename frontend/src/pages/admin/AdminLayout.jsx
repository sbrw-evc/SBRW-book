import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { useTranslation } from '../../hooks/useTranslation'
import { BarChart2, Users, BookOpen, Settings, Home, Mail } from 'lucide-react'
import { AdminDashboard } from './Dashboard'
import { UserManagement } from './UserManagement'
import { AdminBooks } from './AdminBooks'
import { AdminSettings } from './AdminSettings'
import { AdminNewsletter } from './AdminNewsletter'

export function AdminLayout() {
  const { isModerator } = useAppStore()
  const { t } = useTranslation()
  const location = useLocation()

  if (!isModerator()) return <Navigate to="/" replace />

  const links = [
    { to: '/admin', label: t('dashboard'), icon: BarChart2, exact: true },
    { to: '/admin/users', label: t('users'), icon: Users },
    { to: '/admin/books', label: t('books'), icon: BookOpen },
    { to: '/admin/newsletters', label: t('newsletters'), icon: Mail },
    { to: '/admin/settings', label: t('settings'), icon: Settings },
  ]

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
      <aside className="md:w-48 md:flex-shrink-0">
        <Link
          to="/"
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-1"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <Home size={16} /> {t('home')}
        </Link>
        <div className="hidden md:block border-t mb-1" style={{ borderColor: 'var(--border)' }} />

        <nav className="hidden md:block space-y-1">
          {links.map((link) => {
            const Icon = link.icon
            const active = link.exact
              ? location.pathname === link.to
              : location.pathname.startsWith(link.to)
            return (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: active ? 'var(--accent-muted)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            )
          })}
        </nav>

        <nav className="md:hidden flex gap-1 overflow-x-auto pb-1 scroll-hide">
          {links.map((link) => {
            const Icon = link.icon
            const active = link.exact
              ? location.pathname === link.to
              : location.pathname.startsWith(link.to)
            return (
              <Link
                key={link.to}
                to={link.to}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
                style={{
                  background: active ? 'var(--accent-muted)' : 'var(--bg-secondary)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                }}
              >
                <Icon size={14} />
                {link.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="books" element={<AdminBooks />} />
          <Route path="newsletters" element={<AdminNewsletter />} />
          <Route path="settings" element={<AdminSettings />} />
        </Routes>
      </div>
    </div>
  )
}
