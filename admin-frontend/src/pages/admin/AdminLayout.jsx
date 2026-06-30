import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { useTranslation } from '../../hooks/useTranslation'
import { BarChart2, Users, BookOpen, Settings, ExternalLink, Mail, LogOut, TrendingUp, Container } from 'lucide-react'
import { AdminDashboard } from './Dashboard'
import { UserManagement } from './UserManagement'
import { AdminBooks } from './AdminBooks'
import { AdminSettings } from './AdminSettings'
import { AdminNewsletter } from './AdminNewsletter'
import { Analytics } from './Analytics'
import { AdminDocker } from './AdminDocker'

const MAIN_SITE = import.meta.env.VITE_MAIN_SITE_URL || '/'

function LocaleSwitcher() {
  const { locale, setLocale } = useAppStore()
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {['ru', 'en'].map((loc) => (
        <button
          key={loc}
          onClick={() => setLocale(loc)}
          className="text-xs font-semibold px-2 py-0.5 rounded-md transition-colors"
          style={{
            background: locale === loc ? 'var(--accent-muted)' : 'transparent',
            color: locale === loc ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export function AdminLayout() {
  const { isAdmin, logout, locale, setLocale } = useAppStore()
  const { t } = useTranslation()
  const location = useLocation()

  if (!isAdmin()) return <Navigate to="/login" replace />

  const links = [
    { to: '/',            label: t('dashboard'),   icon: BarChart2, exact: true },
    { to: '/analytics',   label: t('analytics'),   icon: TrendingUp },
    { to: '/users',       label: t('users'),        icon: Users },
    { to: '/books',       label: t('books'),        icon: BookOpen },
    { to: '/newsletters', label: t('newsletters'),  icon: Mail },
    { to: '/docker',      label: 'Docker',          icon: Container },
    { to: '/settings',    label: t('settings'),     icon: Settings },
  ]

  return (
    <>
      <nav
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex gap-1 overflow-x-auto px-3 py-2"
        style={{
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          WebkitBackdropFilter: 'blur(12px)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {links.map((link) => {
          const Icon = link.icon
          const active = link.exact
            ? location.pathname === link.to
            : location.pathname.startsWith(link.to) && !link.exact
          return (
            <Link
              key={link.to}
              to={link.to}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap"
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
        <div className="flex-shrink-0 flex items-center gap-0.5 ml-1">
          {['ru', 'en'].map((loc) => (
            <button
              key={loc}
              onClick={() => setLocale(loc)}
              className="text-xs font-semibold px-2 py-1 rounded-lg"
              style={{
                background: locale === loc ? 'var(--accent-muted)' : 'var(--bg-secondary)',
                color: locale === loc ? 'var(--accent)' : 'var(--text-muted)',
                border: `1px solid ${locale === loc ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {loc.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      {/* Spacer to push content below fixed nav on mobile */}
      <div className="md:hidden h-12" />

      <div className="flex flex-col md:flex-row gap-3 md:gap-6">
        {/* ── Desktop sidebar ──────────────────────────────── */}
        <aside className="hidden md:block md:w-44 lg:w-48 flex-shrink-0">
          <a
            href={MAIN_SITE}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-1"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <ExternalLink size={14} /> {t('toMainSite')}
          </a>
          <div className="border-t mb-1" style={{ borderColor: 'var(--border)' }} />

          <nav className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon
              const active = link.exact
                ? location.pathname === link.to
                : location.pathname.startsWith(link.to) && !link.exact
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
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mt-2"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <LogOut size={16} /> {t('logout')}
            </button>
            <div className="border-t mt-2 pt-1" style={{ borderColor: 'var(--border)' }}>
              <LocaleSwitcher />
            </div>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="books" element={<AdminBooks />} />
            <Route path="newsletters" element={<AdminNewsletter />} />
            <Route path="docker" element={<AdminDocker />} />
            <Route path="settings" element={<AdminSettings />} />
          </Routes>
        </div>
      </div>
    </>
  )
}
