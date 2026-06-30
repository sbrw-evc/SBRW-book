import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../api/auth'
import { useAppStore } from '../store/appStore'
import { useTranslation } from '../hooks/useTranslation'
import { PageSpinner } from '../components/ui/Spinner'
import { StarRating } from '../components/ui/StarRating'
import { BookCard } from '../components/book/BookCard'
import { OnlineDot } from '../components/ui/OnlineDot'
import { User, BookOpen, MessageCircle, Star, BookMarked, Calendar, Settings } from 'lucide-react'

function formatLastSeen(isoDate, locale) {
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000
  if (locale === 'ru') {
    if (diff < 60) return 'только что'
    if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн. назад`
    return new Date(isoDate).toLocaleDateString('ru-RU')
  }
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min. ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h. ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d. ago`
  return new Date(isoDate).toLocaleDateString('en-US')
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="mb-8">
      <h3 className="section-title flex items-center gap-2">
        <Icon size={18} style={{ color: 'var(--accent)' }} />
        {title}
      </h3>
      {children}
    </div>
  )
}

function ReadingEntry({ entry, type, finishedLabel }) {
  const book = entry.book
  return (
    <div className="flex gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <div className="w-10 h-14 flex-shrink-0 rounded-lg overflow-hidden">
        {book.cover_path ? (
          <img src={book.cover_path} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
            <BookOpen size={16} className="text-white/60" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          to={`/books/${book.id}`}
          className="font-medium text-sm hover:underline line-clamp-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {book.title}
        </Link>
        {book.authors?.length > 0 && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {book.authors.map((a) => a.name).join(', ')}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {type === 'reading' ? (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                <div className="h-full rounded-full" style={{ width: `${entry.percentage}%`, background: 'var(--accent)' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{Math.round(entry.percentage)}%</span>
            </div>
          ) : (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
              {finishedLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function UserProfile() {
  const { userId } = useParams()
  const { user: currentUser, locale } = useAppStore()
  const { t } = useTranslation()

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => usersApi.getPublicProfile(userId).then((r) => r.data),
  })

  if (isLoading) return <PageSpinner />
  if (isError || !profile) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{t('userNotFound')}</p>
      </div>
    )
  }

  const isOwnProfile = currentUser?.id === userId
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'en-US'

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="card p-6 mb-6 flex gap-5 items-start">
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden" style={{ background: 'var(--accent-muted)' }}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                  {profile.username?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>
          <OnlineDot status={profile.online_status} size="lg" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {profile.username}
            </h1>
            {profile.online_status === 'online' && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#16a34a' }}>
                {t('onlineStatus')}
              </span>
            )}
            {profile.online_status === 'away' && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#fef3c7', color: '#b45309' }}>
                {t('awayStatus')}
              </span>
            )}
          </div>
          {profile.full_name && (
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{profile.full_name}</p>
          )}
          {profile.about && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{profile.about}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Calendar size={11} />
              {t('memberSince')} {new Date(profile.created_at).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })}
            </p>
            {!profile.online_status && profile.last_seen && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('lastSeenLabel')} {formatLastSeen(profile.last_seen, locale)}
              </p>
            )}
          </div>
        </div>
        {isOwnProfile && (
          <Link to="/profile" className="btn-ghost text-sm flex-shrink-0 flex items-center gap-1.5">
            <Settings size={14} /> {t('profileSettingsBtn')}
          </Link>
        )}
      </div>

      {/* Reading activity */}
      {profile.reading_now !== null && (
        <>
          {profile.reading_now?.length > 0 && (
            <Section icon={BookOpen} title={t('readingNow')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.reading_now.map((entry, i) => (
                  <ReadingEntry key={i} entry={entry} type="reading" finishedLabel={t('bookFinished')} />
                ))}
              </div>
            </Section>
          )}
          {profile.finished?.length > 0 && (
            <Section icon={BookMarked} title={t('finishedReading')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.finished.map((entry, i) => (
                  <ReadingEntry key={i} entry={entry} type="finished" finishedLabel={t('bookFinished')} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {/* Reviews */}
      {profile.reviews?.length > 0 && (
        <Section icon={Star} title={t('reviews')}>
          <div className="space-y-3">
            {profile.reviews.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-10 h-14 flex-shrink-0 rounded-lg overflow-hidden">
                    {r.book.cover_path ? (
                      <img src={r.book.cover_path} alt={r.book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                        <BookOpen size={14} className="text-white/60" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/books/${r.book.id}`}
                      className="font-medium text-sm hover:underline line-clamp-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {r.book.title}
                    </Link>
                    <StarRating value={r.rating} size={13} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(r.created_at).toLocaleDateString(dateLocale)}
                    </span>
                  </div>
                </div>
                {r.review && (
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {r.review}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Discussions */}
      {profile.discussions?.length > 0 && (
        <Section icon={MessageCircle} title={t('discussions')}>
          <div className="space-y-3">
            {profile.discussions.map((d) => (
              <div key={d.id} className="card p-4">
                <Link
                  to={`/books/${d.book.id}#discussions`}
                  className="text-xs font-medium hover:underline block mb-1"
                  style={{ color: 'var(--accent)' }}
                >
                  {d.book.title}
                </Link>
                <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                  {d.text}
                </p>
                <span className="text-xs mt-1 block" style={{ color: 'var(--text-muted)' }}>
                  {new Date(d.created_at).toLocaleDateString(dateLocale)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {profile.reviews?.length === 0 && profile.discussions?.length === 0 && profile.reading_now?.length === 0 && profile.finished?.length === 0 && (
        <div className="text-center py-12">
          <User size={48} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noActivity')}</p>
        </div>
      )}
    </div>
  )
}
