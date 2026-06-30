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
      telegramConfigured: false,
      requireAuth: false,

      setAppSettings: ({ app_name, app_icon, telegram_configured, require_auth }) => {
        set({
          appName: app_name || 'SBRW Books',
          appIcon: app_icon || 'BookOpen',
          telegramConfigured: !!telegram_configured,
          requireAuth: !!require_auth,
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

      readerUiHidden: false,
      setReaderUiHidden: (v) => set({ readerUiHidden: v }),

      audioPlayer: null, // { book, chapters, chapterIdx, seekToSeconds }
      openAudioPlayer: (book, chapters, chapterIdx = 0, seekToSeconds = 0) =>
        set({ audioPlayer: { book, chapters, chapterIdx, seekToSeconds } }),
      closeAudioPlayer: () => set({ audioPlayer: null }),

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
        telegramConfigured: state.telegramConfigured,
        requireAuth: state.requireAuth,
        // audioPlayer is intentionally excluded — session-only
      }),
    }
  )
)
