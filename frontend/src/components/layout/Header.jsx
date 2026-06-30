import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Search, Sun, Moon, Palette, Upload, User, LogOut, Settings, BookOpen, ChevronDown, Shield, Library, BookMarked, BookText, Feather, PenLine, Menu, X, MessageCircle } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { useTranslation } from '../../hooks/useTranslation'
import { booksApi } from '../../api/books'
import { OnlineDot } from '../ui/OnlineDot'

const APP_ICONS = {
  BookOpen, Library, BookMarked, BookText, Feather, PenLine,
}

function AppIcon({ name, size = 18, className }) {
  const Icon = APP_ICONS[name] || BookOpen
  return <Icon size={size} className={className} />
}

function ThemeIcon({ theme }) {
  if (theme === 'dark') return <Moon size={18} />
  if (theme === 'colorful') return <Palette size={18} />
  return <Sun size={18} />
}

export function Header() {
  const { t } = useTranslation()
  const { user, theme, setTheme, locale, setLocale, logout, isAuthenticated, isModerator, appName, appIcon } = useAppStore()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const searchRef = useRef(null)
  const userMenuRef = useRef(null)
  const themeMenuRef = useRef(null)
  const searchTimer = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (!searchRef.current?.contains(e.target)) setShowSearch(false)
      if (!userMenuRef.current?.contains(e.target)) setShowUserMenu(false)
      if (!themeMenuRef.current?.contains(e.target)) setShowThemeMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [showMobileMenu])

  const handleSearch = (query) => {
    setSearchQuery(query)
    clearTimeout(searchTimer.current)
    if (query.length < 2) { setSearchResults([]); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await booksApi.list({ search: query, page_size: 5 })
        setSearchResults(data.items || [])
        setShowSearch(true)
      } catch {}
    }, 300)
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/library?search=${encodeURIComponent(searchQuery)}`)
      setShowSearch(false)
      setShowMobileMenu(false)
    }
  }

  const themes = [
    { value: 'light',    label: t('themeLight'),    icon: <Sun size={15} /> },
    { value: 'dark',     label: t('themeDark'),     icon: <Moon size={15} /> },
    { value: 'colorful', label: t('themeColorful'), icon: <Palette size={15} /> },
  ]

  const navLinks = [
    { to: '/',        label: t('home'),    end: true },
    { to: '/library', label: t('library') },
    { to: '/authors', label: t('authors') },
    { to: '/series',  label: t('series')  },
  ]

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b transition-all duration-300 ${scrolled ? 'header-glass' : ''}`}
        style={{
          background: scrolled ? undefined : 'var(--bg)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
              style={{ background: 'var(--accent)' }}
            >
              <AppIcon name={appIcon} size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg hidden sm:block" style={{ color: 'var(--text-primary)' }}>
              {appName}
            </span>
          </Link>

          {/* Nav links (desktop) */}
          <nav className="hidden md:flex items-center gap-0.5 ml-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `nav-link px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'active'
                      : 'hover:bg-[var(--bg-hover)]'
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Search */}
          <div className="flex-1 max-w-md relative" ref={searchRef}>
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowSearch(true)}
                  placeholder={t('search')}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none transition-all"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocusCapture={(e) => {
                    e.target.style.borderColor = 'var(--accent)'
                    e.target.style.boxShadow = '0 0 0 3px var(--accent-muted)'
                    if (searchResults.length > 0) setShowSearch(true)
                  }}
                  onBlurCapture={(e) => {
                    e.target.style.borderColor = 'var(--border)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            </form>

            {showSearch && searchResults.length > 0 && (
              <div
                className="absolute top-full mt-1.5 left-0 right-0 rounded-xl shadow-lg border z-50 overflow-hidden animate-slide-down"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
              >
                {searchResults.map((book) => (
                  <Link
                    key={book.id}
                    to={`/books/${book.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    onClick={() => setShowSearch(false)}
                  >
                    <div className="w-8 h-12 flex-shrink-0 rounded overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                      {book.cover_path && (
                        <img src={book.cover_path} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{book.title}</p>
                      <p className="text-xs line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                        {book.authors?.map((a) => a.name).join(', ')}
                      </p>
                    </div>
                  </Link>
                ))}
                <button
                  onClick={handleSearchSubmit}
                  className="w-full text-left px-4 py-2.5 text-sm border-t font-medium transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Все результаты для «{searchQuery}»
                </button>
              </div>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">

            {/* Theme toggle */}
            <div className="relative hidden sm:block" ref={themeMenuRef}>
              <button
                onClick={() => { setShowThemeMenu(!showThemeMenu); setShowUserMenu(false) }}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <ThemeIcon theme={theme} />
              </button>
              {showThemeMenu && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-42 rounded-xl border z-50 py-1 overflow-hidden dropdown-enter"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)', minWidth: '10rem' }}
                >
                  {themes.map((th) => (
                    <button
                      key={th.value}
                      onClick={() => { setTheme(th.value); setShowThemeMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                      style={{
                        color: theme === th.value ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: theme === th.value ? '600' : '400',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {th.icon} {th.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Locale toggle */}
            <button
              onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')}
              className="px-2 py-1.5 rounded-lg text-xs font-bold transition-colors hidden sm:block"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              {locale === 'ru' ? 'EN' : 'RU'}
            </button>

            {isAuthenticated() ? (
              <>
                <Link
                  to="/upload"
                  className="hidden md:flex items-center gap-1.5 btn-primary text-sm py-2"
                >
                  <Upload size={14} />
                  {t('uploadBook')}
                </Link>

                <div className="relative hidden sm:block" ref={userMenuRef}>
                  <button
                    onClick={() => { setShowUserMenu(!showUserMenu); setShowThemeMenu(false) }}
                    className="flex items-center gap-1.5 p-1.5 rounded-xl transition-colors"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="relative w-8 h-8">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden"
                        style={{ background: 'var(--accent-muted)' }}>
                        {user?.avatar ? (
                          <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                            {user?.username?.[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      {user?.show_online_status !== false && <OnlineDot status="online" />}
                    </div>
                    <ChevronDown
                      size={13}
                      style={{ color: 'var(--text-muted)', transition: 'transform 0.2s ease', transform: showUserMenu ? 'rotate(180deg)' : 'none' }}
                    />
                  </button>

                  {showUserMenu && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border z-50 py-1 overflow-hidden dropdown-enter"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
                    >
                      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{user?.username}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                        <span
                          className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: 'var(--accent-muted)',
                            color: 'var(--accent)',
                          }}
                        >
                          {t(`role${user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}`)}
                        </span>
                      </div>

                      {[
                        { to: `/users/${user?.id}`, icon: <User size={15} />, label: t('profile') },
                        { to: '/shelves', icon: <BookOpen size={15} />, label: t('myBooks') },
                        { to: '/chat', icon: <MessageCircle size={15} />, label: t('chatTitle') },
                      ].map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                          style={{ color: 'var(--text-secondary)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                        >
                          {item.icon} {item.label}
                        </Link>
                      ))}
                      {isModerator() && (
                        <a
                          href="/admin"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                          style={{ color: 'var(--text-secondary)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                        >
                          <Shield size={15} /> {t('admin')}
                        </a>
                      )}

                      <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
                      <button
                        onClick={() => { logout(); navigate('/login') }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                        style={{ color: '#ef4444' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <LogOut size={15} /> {t('logout')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/login" className="btn-ghost text-sm">{t('login')}</Link>
                <Link to="/register" className="btn-primary text-sm">{t('register')}</Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="sm:hidden p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              {showMobileMenu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {showMobileMenu && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-72 z-50 sm:hidden flex flex-col transition-transform duration-300 ${
          showMobileMenu ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{appName}</span>
          <button onClick={() => setShowMobileMenu(false)} className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {/* Nav links */}
          <div className="px-3 mb-3">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setShowMobileMenu(false)}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-xl text-sm font-medium mb-1 transition-colors ${
                    isActive ? 'bg-[var(--accent-muted)]' : 'hover:bg-[var(--bg-hover)]'
                  }`
                }
                style={({ isActive }) => ({
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="border-t mx-4 mb-3" style={{ borderColor: 'var(--border)' }} />

          {/* Theme picker */}
          <div className="px-3 mb-3">
            <p className="px-4 text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{t('theme')}</p>
            {themes.map((th) => (
              <button
                key={th.value}
                onClick={() => { setTheme(th.value) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm mb-1 transition-colors"
                style={{
                  background: theme === th.value ? 'var(--accent-muted)' : 'transparent',
                  color: theme === th.value ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: theme === th.value ? '600' : '400',
                }}
              >
                {th.icon} {th.label}
              </button>
            ))}
          </div>

          <div className="border-t mx-4 mb-3" style={{ borderColor: 'var(--border)' }} />

          {/* Locale */}
          <div className="px-3 mb-3">
            <button
              onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span>{locale === 'ru' ? 'Русский' : 'English'}</span>
              <span className="font-bold text-xs px-2 py-0.5 rounded-lg" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                {locale === 'ru' ? 'EN' : 'RU'}
              </span>
            </button>
          </div>

          <div className="border-t mx-4 mb-3" style={{ borderColor: 'var(--border)' }} />

          {/* Auth section */}
          {isAuthenticated() ? (
            <div className="px-3">
              <div className="px-4 py-3 rounded-xl mb-2" style={{ background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ background: 'var(--accent-muted)' }}>
                    {user?.avatar ? (
                      <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-base font-semibold" style={{ color: 'var(--accent)' }}>
                        {user?.username?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{user?.username}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                  </div>
                </div>
              </div>

              {[
                { to: `/users/${user?.id}`, icon: <User size={16} />, label: t('profile') },
                { to: '/shelves', icon: <BookOpen size={16} />, label: t('myBooks') },
                { to: '/chat', icon: <MessageCircle size={16} />, label: t('chatTitle') },
                { to: '/upload', icon: <Upload size={16} />, label: t('uploadBook') },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm mb-1 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {item.icon} {item.label}
                </Link>
              ))}
              {isModerator() && (
                <a
                  href="/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm mb-1 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Shield size={16} /> {t('admin')}
                </a>
              )}

              <button
                onClick={() => { logout(); navigate('/login'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm mt-2"
                style={{ color: '#ef4444' }}
              >
                <LogOut size={16} /> {t('logout')}
              </button>
            </div>
          ) : (
            <div className="px-3 flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setShowMobileMenu(false)}
                className="btn-ghost text-sm text-center py-3"
              >
                {t('login')}
              </Link>
              <Link
                to="/register"
                onClick={() => setShowMobileMenu(false)}
                className="btn-primary text-sm text-center"
              >
                {t('register')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
