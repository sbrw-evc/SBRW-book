import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translations } from '../i18n/translations'

export const useAppStore = create(
  persist(
    (set, get) => ({
      locale: 'ru',
      theme: 'dark',
      user: null,
      accessToken: null,
      refreshToken: null,
      appName: 'SBRW Books',
      appIcon: 'BookOpen',

      setAppSettings: ({ app_name, app_icon }) => {
        set({
          appName: app_name || 'SBRW Books',
          appIcon: app_icon || 'BookOpen',
        })
      },

      setLocale: (locale) => {
        const root = document.documentElement
        root.classList.add('locale-transitioning')
        setTimeout(() => {
          set({ locale })
          setTimeout(() => root.classList.remove('locale-transitioning'), 300)
        }, 150)
      },

      setTheme: (theme) => {
        const root = document.documentElement
        root.classList.add('theme-transitioning')
        root.setAttribute('data-theme', theme)
        if (theme === 'dark') root.classList.add('dark')
        else root.classList.remove('dark')
        set({ theme })
        setTimeout(() => root.classList.remove('theme-transitioning'), 450)
      },

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      logout: () => set({ user: null, accessToken: null, refreshToken: null }),

      isAuthenticated: () => !!get().accessToken,

      isAdmin: () => get().user?.role === 'admin',

      isModerator: () => ['admin', 'moderator'].includes(get().user?.role),

      t: (key) => {
        const { locale } = get()
        return translations[locale]?.[key] ?? translations['en']?.[key] ?? key
      },
    }),
    {
      name: 'sbrw-books-store',
      partialize: (state) => ({
        locale: state.locale,
        theme: state.theme,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        appName: state.appName,
        appIcon: state.appIcon,
      }),
    }
  )
)
