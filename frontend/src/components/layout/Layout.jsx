import { useLocation } from 'react-router-dom'
import { Header } from './Header'
import { AudioPlayer } from '../audio/AudioPlayer'
import { useAppStore } from '../../store/appStore'

function PageTransition({ children }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-page-enter">
      {children}
    </div>
  )
}

export function Layout({ children }) {
  const audioPlayer = useAppStore((s) => s.audioPlayer)
  const closeAudioPlayer = useAppStore((s) => s.closeAudioPlayer)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header />
      <main
        className={`flex-1 w-full max-w-7xl mx-auto px-4 py-6${audioPlayer ? ' pb-36' : ''}`}
        style={audioPlayer ? { paddingBottom: 'calc(9rem + env(safe-area-inset-bottom, 0px))' } : undefined}
      >
        <PageTransition>{children}</PageTransition>
      </main>
      {!audioPlayer && (
        <footer
          className="border-t py-6 mt-8"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="max-w-7xl mx-auto px-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            SBRW Books — Self-hosted digital library
          </div>
        </footer>
      )}
      {audioPlayer && (
        <AudioPlayer
          key={`${audioPlayer.book.id}-${audioPlayer.chapterIdx}`}
          book={audioPlayer.book}
          chapters={audioPlayer.chapters}
          initialChapterIndex={audioPlayer.chapterIdx}
          initialSeekSeconds={audioPlayer.seekToSeconds || 0}
          onClose={closeAudioPlayer}
        />
      )}
    </div>
  )
}

export function ReaderLayout({ children }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {children}
    </div>
  )
}
