import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAppStore } from './store/appStore'
import { authApi } from './api/auth'
import { AdminLayout } from './pages/admin/AdminLayout'
import { Login } from './pages/Login'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } },
})

function ThemeInit() {
  const { theme, setAppSettings } = useAppStore()
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [theme])
  useEffect(() => {
    authApi.publicSettings().then((r) => setAppSettings(r.data)).catch(() => {})
  }, [])
  return null
}

function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin } = useAppStore()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (!isAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Доступ запрещён</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Требуются права администратора.</p>
        </div>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/admin">
        <ThemeInit />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <RequireAdmin>
                <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg)' }}>
                  <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-5 overflow-hidden">
                    <AdminLayout />
                  </div>
                </div>
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontSize: '14px',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
