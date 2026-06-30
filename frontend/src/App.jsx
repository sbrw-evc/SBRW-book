import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAppStore } from './store/appStore'
import { authApi } from './api/auth'
import { Layout, ReaderLayout } from './components/layout/Layout'
import { PageSpinner } from './components/ui/Spinner'
import { Setup } from './pages/Setup'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { BookDetail } from './pages/BookDetail'
import { BookEdit } from './pages/BookEdit'
import { ForgotPassword, ResetPassword, VerifyEmail } from './pages/PasswordReset'
import { Reader } from './pages/Reader'
import { Upload } from './pages/Upload'
import { Authors, AuthorDetail } from './pages/Authors'
import { SeriesList, SeriesDetail } from './pages/Series'
import { Shelves, ShelfDetail } from './pages/Shelves'
import { Profile } from './pages/Profile'
import { UserProfile } from './pages/UserProfile'
import { Chat, ChatRoom } from './pages/Chat'
import { ChatWidget } from './components/chat/ChatWidget'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 * 5 },
  },
})

function RequireAuth({ children }) {
  const { isAuthenticated } = useAppStore()
  const location = useLocation()
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

function RequireAuthGuard({ children }) {
  const { isAuthenticated, requireAuth } = useAppStore()
  const location = useLocation()
  if (requireAuth && !isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

function SetupGuard({ children }) {
  const location = useLocation()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => authApi.setupStatus().then((r) => r.data),
    retry: 2,
    retryDelay: 1500,
    staleTime: Infinity,
  })
  if (isLoading) return <PageSpinner />
  
  if (isError || (data && !data.completed)) {
    if (location.pathname !== '/setup') return <Navigate to="/setup" replace />
  }
  return children
}

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeInit />
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/login" element={<SetupGuard><Login /></SetupGuard>} />
          <Route path="/register" element={<SetupGuard><Register /></SetupGuard>} />
          <Route path="/forgot-password" element={<SetupGuard><ForgotPassword /></SetupGuard>} />
          <Route path="/reset-password" element={<SetupGuard><ResetPassword /></SetupGuard>} />
          <Route path="/verify-email" element={<SetupGuard><VerifyEmail /></SetupGuard>} />
          <Route
            path="/read/:id"
            element={
              <RequireAuth>
                <SetupGuard>
                  <ReaderLayout>
                    <Reader />
                  </ReaderLayout>
                </SetupGuard>
              </RequireAuth>
            }
          />
          <Route
            path="*"
            element={
              <SetupGuard>
                <RequireAuthGuard>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/library" element={<Library />} />
                      <Route path="/books/:id" element={<BookDetail />} />
                      <Route path="/books/:id/edit" element={<RequireAuth><BookEdit /></RequireAuth>} />
                      <Route path="/authors" element={<Authors />} />
                      <Route path="/authors/:id" element={<AuthorDetail />} />
                      <Route path="/series" element={<SeriesList />} />
                      <Route path="/series/:id" element={<SeriesDetail />} />
                      <Route path="/upload" element={<RequireAuth><Upload /></RequireAuth>} />
                      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                      <Route path="/users/:userId" element={<UserProfile />} />
                      <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
                      <Route path="/chat/:roomId" element={<RequireAuth><ChatRoom /></RequireAuth>} />
                      <Route path="/shelves" element={<RequireAuth><Shelves /></RequireAuth>} />
                      <Route path="/shelves/:id" element={<RequireAuth><ShelfDetail /></RequireAuth>} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </RequireAuthGuard>
              </SetupGuard>
            }
          />
        </Routes>
        <ChatWidget />
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
