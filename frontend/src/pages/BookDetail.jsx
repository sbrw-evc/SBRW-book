import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { booksApi, seriesApi } from '../api/books'
import { shelvesApi } from '../api/auth'
import { useAppStore } from '../store/appStore'
import { useTranslation } from '../hooks/useTranslation'
import { StarRating } from '../components/ui/StarRating'
import { PageSpinner } from '../components/ui/Spinner'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { BookCard } from '../components/book/BookCard'
import { EmojiButton } from '../components/ui/EmojiButton'
import { OnlineDot } from '../components/ui/OnlineDot'
import { MediaGallery } from '../components/ui/ImageViewer'
import {
  Download, BookOpen, Plus, Edit, Trash2, Star, Calendar, Globe, Hash, BookMarked, User, Library, X, RefreshCw,
  MessageCircle, Send, Reply, ChevronDown, ChevronUp, ImageIcon, Pencil, AlertCircle, Film,
  Sparkles, RefreshCcw, Headphones, Mic, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

function FormatBadge({ format, size }) {
  const colors = {
    epub: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    pdf: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    mobi: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    fb2: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    djvu: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    txt: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${colors[format] || 'bg-gray-100 text-gray-700'}`}>
      {format}
      {size && <span className="ml-1 font-normal opacity-70">{(size / 1024 / 1024).toFixed(1)}MB</span>}
    </span>
  )
}

function AddToShelfModal({ bookId, onClose }) {
  const { t } = useTranslation()
  const { data: shelves, isLoading } = useQuery({
    queryKey: ['shelves'],
    queryFn: () => shelvesApi.list().then((r) => r.data),
  })
  const [newShelfName, setNewShelfName] = useState('')

  const addMutation = useMutation({
    mutationFn: (shelfId) => shelvesApi.addBook(shelfId, bookId),
    onSuccess: () => { toast.success(t('addedToShelf')); onClose() },
    onError: () => toast.error(t('error')),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await shelvesApi.create({ name: newShelfName })
      await shelvesApi.addBook(data.id, bookId)
    },
    onSuccess: () => { toast.success(t('addedToShelf')); onClose() },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>{t('addToShelf')}</h3>
          <button onClick={onClose}><X size={20} style={{ color: 'var(--text-muted)' }} /></button>
        </div>
        {isLoading ? <PageSpinner /> : (
          <div className="space-y-2">
            {shelves?.map((shelf) => (
              <button
                key={shelf.id}
                onClick={() => addMutation.mutate(shelf.id)}
                disabled={addMutation.isPending}
                className="w-full text-left px-4 py-3 rounded-xl border hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors"
                style={{ borderColor: 'var(--border)' }}
              >
                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{shelf.name}</p>
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              <input
                value={newShelfName}
                onChange={(e) => setNewShelfName(e.target.value)}
                placeholder={t('shelfName')}
                className="input py-2 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && newShelfName && createMutation.mutate()}
              />
              <button
                onClick={() => newShelfName && createMutation.mutate()}
                disabled={!newShelfName || createMutation.isPending}
                className="btn-primary px-3 py-2"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CommentAvatar({ username, avatar, userId, onlineStatus }) {
  return (
    <Link to={`/users/${userId}`} className="flex-shrink-0">
      <div className="relative w-8 h-8">
        <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden"
          style={{ background: 'var(--accent-muted)' }}>
          {avatar ? (
            <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              {username?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        <OnlineDot status={onlineStatus} />
      </div>
    </Link>
  )
}

const MAX_MEDIA = 10
const MAX_MEDIA_SIZE = 20 * 1024 * 1024

function MediaThumbStrip({ urls, onRemove }) {
  if (!urls.length) return null
  return (
    <div className="flex flex-wrap gap-1 mb-1">
      {urls.map((url, i) => (
        <div key={i} className="relative flex-shrink-0">
          {url.match(/\.(mp4|webm|ogg)$/i) ? (
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
            >
              <Film size={16} />
            </div>
          ) : (
            <img src={url} alt="" className="h-10 w-10 object-cover rounded-lg" />
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs leading-none"
          >×</button>
        </div>
      ))}
    </div>
  )
}

function MediaUploadButton({ onUpload, disabled, currentCount = 0 }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const atLimit = currentCount >= MAX_MEDIA

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    const remaining = MAX_MEDIA - currentCount
    if (remaining <= 0) { toast.error(`Максимум ${MAX_MEDIA} файлов на сообщение`); return }
    const toUpload = []
    for (const file of files.slice(0, remaining)) {
      if (file.size > MAX_MEDIA_SIZE) { toast.error(`«${file.name}» превышает 20 МБ`); continue }
      toUpload.push(file)
    }
    if (files.length > remaining) toast.error(`Можно добавить ещё ${remaining} файл(ов)`)
    if (!toUpload.length) return
    setUploading(true)
    try {
      for (const file of toUpload) {
        const fd = new FormData()
        fd.append('file', file)
        const { data } = await booksApi.uploadMedia(fd)
        onUpload(data.url)
      }
    } catch { toast.error('Ошибка загрузки файла') }
    finally { setUploading(false) }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" multiple className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || uploading || atLimit}
        className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
        style={{ color: 'var(--text-muted)' }}
        title={atLimit ? `Максимум ${MAX_MEDIA} файлов` : 'Прикрепить медиа'}
      >
        {uploading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
        ) : (
          <ImageIcon size={16} />
        )}
      </button>
    </>
  )
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

function BookReviews({ bookId }) {
  const { t } = useTranslation()
  const { isAuthenticated, isAdmin, isModerator, user } = useAppStore()
  const qc = useQueryClient()

  const [userRating, setUserRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: ratings = [] } = useQuery({
    queryKey: ['book', bookId, 'ratings'],
    queryFn: () => booksApi.getRatings(bookId).then((r) => r.data),
  })

  const { data: progress } = useQuery({
    queryKey: ['book', bookId, 'progress'],
    queryFn: () => booksApi.getProgress(bookId).then((r) => r.data).catch(() => null),
    enabled: isAuthenticated(),
  })

  const { data: myRating } = useQuery({
    queryKey: ['book', bookId, 'my-rating'],
    queryFn: () => booksApi.getMyRating(bookId).then((r) => r.data).catch((e) => e.response?.status === 404 ? null : Promise.reject(e)),
    enabled: isAuthenticated(),
  })

  const hasRead = progress && progress.percentage > 0

  const startEdit = () => {
    if (!myRating) return
    setUserRating(myRating.rating)
    setReviewText(myRating.review || '')
    setEditMode(true)
  }

  const cancelEdit = () => { setEditMode(false); setUserRating(0); setReviewText('') }

  const rateMutation = useMutation({
    mutationFn: () => booksApi.rate(bookId, { rating: userRating, review: reviewText }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['book', bookId] })
      qc.invalidateQueries({ queryKey: ['book', bookId, 'ratings'] })
      qc.invalidateQueries({ queryKey: ['book', bookId, 'my-rating'] })
      setEditMode(false); setUserRating(0); setReviewText('')
      toast.success(t('success'))
    },
  })

  const deleteMyRatingMutation = useMutation({
    mutationFn: () => booksApi.deleteMyRating(bookId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['book', bookId] })
      qc.invalidateQueries({ queryKey: ['book', bookId, 'ratings'] })
      qc.invalidateQueries({ queryKey: ['book', bookId, 'my-rating'] })
      setDeleteTarget(null); toast.success(t('success'))
    },
  })

  const deleteRatingByIdMutation = useMutation({
    mutationFn: (ratingId) => booksApi.deleteRatingById(bookId, ratingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['book', bookId] })
      qc.invalidateQueries({ queryKey: ['book', bookId, 'ratings'] })
      qc.invalidateQueries({ queryKey: ['book', bookId, 'my-rating'] })
      setDeleteTarget(null); toast.success(t('success'))
    },
  })

  const myRatingFromList = ratings.find((r) => r.user_id === user?.id)
  const otherRatings = ratings.filter((r) => r.user_id !== user?.id)
  const canAdminDelete = isAdmin() || isModerator()

  const renderReviewCard = (r, isOwn = false) => (
    <div
      key={r.id}
      className="card p-4"
      style={isOwn ? { borderColor: 'var(--accent)', borderWidth: '1.5px', borderStyle: 'solid', background: 'var(--accent-muted)' } : {}}
    >
      <div className="flex items-center gap-3 mb-2">
        <CommentAvatar username={r.username} avatar={r.avatar} userId={r.user_id} onlineStatus={r.online_status} />
        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/users/${r.user_id}`} className="text-sm font-semibold hover:underline" style={{ color: isOwn ? 'var(--accent)' : 'var(--text-primary)' }}>
              {r.username}
            </Link>
            <StarRating value={r.rating} size={14} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {isOwn && !editMode && (
            <button onClick={startEdit} className="p-1.5 rounded-lg" title={t('editComment')} style={{ color: 'var(--text-muted)' }}>
              <Pencil size={14} />
            </button>
          )}
          {(isOwn || canAdminDelete) && (
            <button onClick={() => setDeleteTarget(isOwn ? 'own' : r.id)} className="p-1.5 rounded-lg text-red-500" title={t('deleteBook')}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {r.review && <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{r.review}</p>}
    </div>
  )

  return (
    <div>
      {myRatingFromList && !editMode && renderReviewCard(myRatingFromList, true)}

      {editMode && (
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <StarRating value={userRating} size={26} interactive onChange={setUserRating} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{userRating > 0 ? `${userRating}/5` : 'Выберите оценку'}</span>
          </div>
          <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Текст отзыва..." className="input resize-none mb-1" rows={3} />
          <div className="flex justify-end mb-1"><EmojiButton onSelect={(emoji) => setReviewText((v) => v + emoji)} /></div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => userRating && rateMutation.mutate()} disabled={!userRating || rateMutation.isPending} className="btn-primary text-sm">{t('save')}</button>
            <button onClick={cancelEdit} className="btn-ghost text-sm">{t('cancel') || 'Отмена'}</button>
          </div>
        </div>
      )}

      {isAuthenticated() && !myRatingFromList && !editMode && (
        !hasRead ? (
          <div className="card p-4 mb-4 flex items-center gap-3">
            <AlertCircle size={18} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Отзыв можно оставить только после начала чтения книги</p>
          </div>
        ) : (
          <div className="card p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <StarRating value={userRating} size={26} interactive onChange={setUserRating} />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{userRating > 0 ? `${userRating}/5` : 'Выберите оценку'}</span>
            </div>
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Напишите отзыв..." className="input resize-none mb-1" rows={3} />
            <div className="flex justify-end mb-1"><EmojiButton onSelect={(emoji) => setReviewText((v) => v + emoji)} /></div>
            <button onClick={() => userRating && rateMutation.mutate()} disabled={!userRating || rateMutation.isPending} className="btn-primary text-sm mt-1">{t('save')}</button>
          </div>
        )
      )}

      {!isAuthenticated() && (
        <div className="card p-4 mb-4 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            <Link to="/login" className="text-primary-600 hover:underline">{t('login')}</Link>
            {' '}чтобы оставить отзыв
          </p>
        </div>
      )}

      {otherRatings.length > 0 && <div className="space-y-4">{otherRatings.map((r) => renderReviewCard(r, false))}</div>}
      {ratings.length === 0 && <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>Отзывов пока нет</p>}

      {deleteTarget && (
        <ConfirmModal
          title="Удалить отзыв?"
          onConfirm={() => {
            if (deleteTarget === 'own') deleteMyRatingMutation.mutate()
            else deleteRatingByIdMutation.mutate(deleteTarget)
          }}
          onClose={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  )
}

// ─── Discussions ──────────────────────────────────────────────────────────────

function BookDiscussions({ bookId }) {
  const { t } = useTranslation()
  const { isAuthenticated, isAdmin, isModerator, user } = useAppStore()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [mediaUrls, setMediaUrls] = useState([])
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replyMediaUrls, setReplyMediaUrls] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [expandedReplies, setExpandedReplies] = useState({})

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', bookId],
    queryFn: () => booksApi.getComments(bookId).then((r) => r.data),
  })

  useEffect(() => {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${scheme}://${window.location.host}/ws/books/${bookId}/discussions/`)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_comment') {
          qc.setQueryData(['comments', bookId], (old = []) => {
            if (data.parent_id) return old.map((c) => c.id === data.parent_id ? { ...c, replies: [...(c.replies || []), data] } : c)
            if (old.some((c) => c.id === data.id)) return old
            return [...old, data]
          })
        }
        if (data.type === 'deleted') {
          qc.setQueryData(['comments', bookId], (old = []) =>
            old.filter((c) => c.id !== data.id).map((c) => ({ ...c, replies: (c.replies || []).filter((r) => r.id !== data.id) }))
          )
        }
      } catch {}
    }
    return () => ws.close()
  }, [bookId, qc])

  const createMutation = useMutation({
    mutationFn: (payload) => booksApi.createComment(bookId, payload),
    onSuccess: () => {
      setText(''); setMediaUrls([])
      setReplyTo(null); setReplyText(''); setReplyMediaUrls([])
    },
    onError: () => toast.error(t('error')),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId) => booksApi.deleteComment(bookId, commentId),
    onSuccess: () => { setDeleteTarget(null); toast.success(t('success')) },
    onError: () => toast.error(t('error')),
  })

  const canDelete = (comment) => {
    if (!user) return false
    return comment.user_id === user.id || isAdmin() || isModerator()
  }

  if (isLoading) return <PageSpinner />

  return (
    <div>
      {isAuthenticated() && (
        <div className="card p-4 mb-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('commentPlaceholder')}
            className="input resize-none mb-2"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <EmojiButton onSelect={(emoji) => setText((v) => v + emoji)} />
              <MediaUploadButton onUpload={(url) => setMediaUrls((v) => [...v, url])} currentCount={mediaUrls.length} />
            </div>
            <button
              onClick={() => (text.trim() || mediaUrls.length) && createMutation.mutate({ text, media_urls: mediaUrls })}
              disabled={(!text.trim() && !mediaUrls.length) || createMutation.isPending}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Send size={14} /> {t('postComment')}
            </button>
          </div>
          <MediaThumbStrip urls={mediaUrls} onRemove={(i) => setMediaUrls((v) => v.filter((_, j) => j !== i))} />
        </div>
      )}

      {comments.length === 0 && (
        <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>{t('noDiscussions')}</p>
      )}

      {comments.length > 0 && (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="card p-4">
              <div className="flex gap-3">
                <CommentAvatar username={comment.username} avatar={comment.avatar} userId={comment.user_id} onlineStatus={comment.online_status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link to={`/users/${comment.user_id}`} className="font-semibold text-sm hover:underline" style={{ color: 'var(--text-primary)' }}>
                      {comment.username}
                    </Link>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(comment.created_at).toLocaleDateString()}</span>
                    <div className="ml-auto flex gap-1">
                      {isAuthenticated() && (
                        <button onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)} className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <Reply size={12} /> {t('reply')}
                        </button>
                      )}
                      {canDelete(comment) && (
                        <button onClick={() => setDeleteTarget(comment.id)} className="text-xs" style={{ color: '#ef4444' }}>{t('deleteComment')}</button>
                      )}
                    </div>
                  </div>
                  {comment.text && <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{comment.text}</p>}
                  <MediaGallery urls={comment.media_urls} />

                  {comment.replies?.length > 0 && (
                    <button
                      onClick={() => setExpandedReplies((v) => ({ ...v, [comment.id]: !v[comment.id] }))}
                      className="mt-2 text-xs flex items-center gap-1"
                      style={{ color: 'var(--accent)' }}
                    >
                      {expandedReplies[comment.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {comment.replies.length} {t('reply')}
                    </button>
                  )}

                  {replyTo === comment.id && (
                    <div className="mt-3 ml-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={t('replyPlaceholder')}
                        className="input resize-none text-sm mb-1"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-1 mb-1">
                        <EmojiButton onSelect={(emoji) => setReplyText((v) => v + emoji)} />
                        <MediaUploadButton onUpload={(url) => setReplyMediaUrls((v) => [...v, url])} currentCount={replyMediaUrls.length} />
                      </div>
                      <MediaThumbStrip urls={replyMediaUrls} onRemove={(i) => setReplyMediaUrls((v) => v.filter((_, j) => j !== i))} />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => (replyText.trim() || replyMediaUrls.length > 0) && createMutation.mutate({ text: replyText, parent_id: comment.id, media_urls: replyMediaUrls })}
                          disabled={(!replyText.trim() && !replyMediaUrls.length) || createMutation.isPending}
                          className="btn-primary px-3 py-1.5 text-sm flex items-center gap-1"
                        >
                          <Send size={13} /> Отправить
                        </button>
                        <button onClick={() => { setReplyTo(null); setReplyText(''); setReplyMediaUrls([]) }} className="btn-ghost px-3 py-1.5 text-sm">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {expandedReplies[comment.id] && comment.replies?.length > 0 && (
                <div className="mt-3 ml-11 space-y-3 pl-3 border-l-2" style={{ borderColor: 'var(--border)' }}>
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-3">
                      <CommentAvatar username={reply.username} avatar={reply.avatar} userId={reply.user_id} onlineStatus={reply.online_status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Link to={`/users/${reply.user_id}`} className="font-semibold text-sm hover:underline" style={{ color: 'var(--text-primary)' }}>{reply.username}</Link>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(reply.created_at).toLocaleDateString()}</span>
                          {canDelete(reply) && (
                            <button onClick={() => setDeleteTarget(reply.id)} className="text-xs ml-auto" style={{ color: '#ef4444' }}>{t('deleteComment')}</button>
                          )}
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{reply.text}</p>
                        <MediaGallery urls={reply.media_urls} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title={`${t('deleteComment')}?`}
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  )
}

// ─── Main BookDetail ──────────────────────────────────────────────────────────

function formatDuration(totalSeconds) {
  if (!totalSeconds) return null
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h > 0) return `${h} ч ${m} мин`
  return `${m} мин`
}

const TABS = ['about', 'reviews', 'discussions', 'shelves']

export function BookDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { isAuthenticated, isAdmin, isModerator, user } = useAppStore()
  const qc = useQueryClient()

  const [showShelfModal, setShowShelfModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState('about')
  const [versionTab, setVersionTab] = useState('text') // 'text' | 'audio'

  const { audioPlayer, openAudioPlayer } = useAppStore()

  const { data: book, isLoading } = useQuery({
    queryKey: ['book', id],
    queryFn: () => booksApi.get(id).then((r) => r.data),
  })

  const { data: myProgress } = useQuery({
    queryKey: ['book', id, 'progress'],
    queryFn: () => booksApi.getProgress(id).then((r) => r.data).catch(() => null),
    enabled: isAuthenticated(),
  })

  const { data: audioChapters = [] } = useQuery({
    queryKey: ['book', id, 'audio'],
    queryFn: () => booksApi.getAudioChapters(id).then((r) => r.data),
  })

  const { data: audioProgress } = useQuery({
    queryKey: ['book', id, 'audio-progress'],
    queryFn: () => booksApi.getAudioProgress(id).then((r) => r.data).catch(() => null),
    enabled: isAuthenticated() && audioChapters.length > 0,
  })

  // chapters dict: { chapter_id: position_seconds }
  const audioChapterProgress = audioProgress?.chapters || {}

  const { data: bookTOC } = useQuery({
    queryKey: ['book', id, 'toc'],
    queryFn: () => booksApi.getBookTOC(id).then((r) => r.data.chapters || []),
    enabled: !!id,
    staleTime: Infinity,
  })

  const deleteMutation = useMutation({
    mutationFn: () => booksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] })
      toast.success(t('bookDeleted'))
      navigate('/library')
    },
  })

  const [convertingTo, setConvertingTo] = useState(null)
  const convertMutation = useMutation({
    mutationFn: (fmt) => booksApi.convert(id, fmt),
    onSuccess: (res) => { qc.setQueryData(['book', id], res.data); toast.success(t('conversionDone')); setConvertingTo(null) },
    onError: (err) => { toast.error(err.response?.data?.detail || t('conversionFailed')); setConvertingTo(null) },
  })

  // Refetch audio progress bars when the player for this book closes
  const playerOpenForBookRef = useRef(false)
  const isPlayerOpenForBook = !!(audioPlayer?.book?.id && audioPlayer.book.id === id)
  useEffect(() => {
    if (playerOpenForBookRef.current && !isPlayerOpenForBook) {
      qc.invalidateQueries({ queryKey: ['book', id, 'audio-progress'] })
    }
    playerOpenForBookRef.current = isPlayerOpenForBook
  }, [isPlayerOpenForBook, id, qc])

  if (isLoading) return <PageSpinner />
  if (!book) return <div className="text-center py-20" style={{ color: 'var(--text-secondary)' }}>{t('notFound')}</div>

  const canEdit = isAdmin() || isModerator() || book.uploaded_by_id === user?.id
  const hasAudio = audioChapters.length > 0

  const READ_PRIORITY = ['epub', 'fb2', 'pdf', 'djvu']
  const readableFormats = book.files
    ?.filter((f) => READ_PRIORITY.includes(f.format))
    .sort((a, b) => READ_PRIORITY.indexOf(a.format) - READ_PRIORITY.indexOf(b.format))

  const totalAudioSeconds = audioChapters.reduce((sum, ch) => sum + (ch.duration_seconds || 0), 0)

  const playerOpen = audioPlayer?.book?.id === book?.id

  const startListening = (chapterIdx = 0, seekToSeconds = 0) => {
    openAudioPlayer(book, audioChapters, chapterIdx, seekToSeconds)
    setVersionTab('audio')
  }

  const tabLabels = {
    about: t('tabAbout') || 'О книге',
    reviews: t('tabReviews') || 'Отзывы',
    discussions: t('tabDiscussions') || 'Обсуждения',
    shelves: 'На полках',
  }

  return (
    <div className="animate-fade-in pb-24">
      {/* Version toggle — shown only if book has audio chapters */}
      {hasAudio && (
        <div className="flex justify-center mb-6">
          <div className="flex rounded-full p-1 gap-1" style={{ background: 'var(--bg-secondary)' }}>
            {[
              { key: 'text', label: t('textVersion') || 'Текст', icon: <BookOpen size={14} /> },
              { key: 'audio', label: t('audioVersion') || 'Аудио', icon: <Headphones size={14} /> },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setVersionTab(key)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: versionTab === key ? 'var(--bg-card)' : 'transparent',
                  color: versionTab === key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: versionTab === key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main layout: cover + content */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr_220px] gap-8 mb-8">

        {/* Left: Cover */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="w-44 md:w-full max-w-[260px]">
            {book.cover_path ? (
              <img src={book.cover_path} alt={book.title} className="w-full aspect-[2/3] object-cover rounded-2xl shadow-lg" />
            ) : (
              <div className="w-full aspect-[2/3] rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <BookOpen size={56} className="text-white/60" />
              </div>
            )}
          </div>
        </div>

        {/* Center: Book info + tabs */}
        <div className="min-w-0">
          {/* Tags */}
          {book.tags?.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {book.tags.map((tag) => (
                <Link
                  key={tag.id}
                  to={`/library?tag_id=${tag.id}`}
                  className="px-2.5 py-1 rounded-full text-xs border hover:border-primary-400 transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold mb-2 leading-tight" style={{ color: 'var(--text-primary)' }}>
            {book.title}
          </h1>

          {/* Authors */}
          {book.authors?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {book.authors.map((a) => (
                <Link key={a.id} to={`/authors/${a.id}`} className="flex items-center gap-1.5 font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                  <User size={13} />
                  {a.name}
                </Link>
              ))}
            </div>
          )}

          {/* Rating row */}
          <div className="flex items-center gap-3 mb-5">
            <StarRating value={book.avg_rating} size={18} />
            <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {book.avg_rating > 0 ? book.avg_rating.toFixed(1) : '—'}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {book.rating_count} {t('reviews')}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            {readableFormats?.length > 0 && isAuthenticated() && (!hasAudio || versionTab === 'text') && (
              <button
                onClick={() => navigate(`/read/${id}?fmt=${readableFormats[0].format}`)}
                className="btn-primary flex items-center gap-2"
              >
                <BookOpen size={16} />
                {myProgress?.percentage > 0 ? 'Продолжить чтение' : t('read')}
              </button>
            )}

            {hasAudio && (!readableFormats?.length || versionTab === 'audio') && (
              <button
                onClick={() => {
                  const resumeId = audioProgress?.resume_chapter_id
                  const resumePos = audioProgress?.resume_position_seconds || 0
                  const resumeIdx = resumeId ? audioChapters.findIndex(ch => ch.id === resumeId) : -1
                  startListening(resumeIdx >= 0 ? resumeIdx : 0, resumeIdx >= 0 ? resumePos : 0)
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors text-sm"
                style={{
                  background: playerOpen ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: playerOpen ? '#fff' : 'var(--text-primary)',
                  border: '1.5px solid var(--border)',
                }}
              >
                <Headphones size={16} />
                {t('listen') || 'Слушать'}
              </button>
            )}

            {isAuthenticated() && (
              <button
                onClick={() => setShowShelfModal(true)}
                className="btn-ghost flex items-center gap-2 text-sm border"
                style={{ borderColor: 'var(--border)' }}
              >
                <Plus size={15} />
                {t('addToShelf')}
              </button>
            )}

            {book.files?.length > 0 && isAuthenticated() && (!hasAudio || versionTab === 'text') && (
              <div className="flex flex-wrap gap-1.5">
                {book.files.map((f) => (
                  <a
                    key={f.id}
                    href={booksApi.downloadUrl(id, f.format)}
                    download
                    className="btn-secondary flex items-center gap-1.5 text-sm"
                  >
                    <Download size={14} />
                    {f.format.toUpperCase()}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Reading progress bar */}
          {myProgress?.percentage > 0 && (
            <div className="mb-5 max-w-xs">
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <span>Прочитано</span>
                <span className="tabular-nums font-medium">{Math.round(myProgress.percentage)}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(myProgress.percentage, 100)}%`, background: 'var(--accent)' }} />
              </div>
            </div>
          )}

          {/* Tabs navigation */}
          <div className="flex gap-0 border-b mb-6 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative flex-shrink-0"
                style={{ color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                {tabLabels[tab]}
                {activeTab === tab && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              {/* Series */}
              {book.series?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {book.series.map((s) => (
                    <Link key={s.id} to={`/series/${s.id}`} className="inline-flex items-center gap-1.5 text-sm hover:underline" style={{ color: 'var(--text-secondary)' }}>
                      <Library size={13} />
                      {s.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Description */}
              {book.description && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {book.description}
                </p>
              )}

              {/* AI review */}
              {(book.ai_review || book.ai_review_status === 'pending') && (
                <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--accent-muted)', border: '1px solid var(--accent)20' }}>
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>ИИ-рецензия</span>
                    {book.ai_review_status === 'pending' && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        анализирует…
                      </span>
                    )}
                  </div>
                  {book.ai_review && <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{book.ai_review}</p>}
                </div>
              )}

              {/* Metadata grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                {book.published_year && (
                  <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <Calendar size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Год:</span>
                    <span>{book.published_year}</span>
                  </div>
                )}
                {book.publisher && (
                  <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <Hash size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('publisher')}:</span>
                    <span>{book.publisher}</span>
                  </div>
                )}
                {book.language && (
                  <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <Globe size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('language')}:</span>
                    <span>{book.language.toUpperCase()}</span>
                  </div>
                )}
                {book.page_count && (
                  <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <BookMarked size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Страниц:</span>
                    <span>{book.page_count}</span>
                  </div>
                )}
                {book.narrator && (
                  <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <Mic size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('narrator')}:</span>
                    <span>{book.narrator}</span>
                  </div>
                )}
                {totalAudioSeconds > 0 && (
                  <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <Clock size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('audioDuration')}:</span>
                    <span>{formatDuration(totalAudioSeconds)}</span>
                  </div>
                )}
                {book.isbn && (
                  <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <Hash size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>ISBN:</span>
                    <span className="font-mono text-xs">{book.isbn}</span>
                  </div>
                )}
              </div>

              {/* Formats + conversion */}
              {book.files?.length > 0 && (!hasAudio || versionTab === 'text') && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{t('formats')}</p>
                  <div className="flex gap-2 flex-wrap">
                    {book.files.map((f) => <FormatBadge key={f.id} format={f.format} size={f.file_size} />)}
                  </div>
                </div>
              )}

              {isAuthenticated() && book.convertible_to?.length > 0 && (!hasAudio || versionTab === 'text') && (
                <div>
                  <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <RefreshCw size={12} /> {t('convertTo')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {book.convertible_to.map((fmt) => (
                      <button
                        key={fmt}
                        disabled={convertMutation.isPending}
                        onClick={() => { setConvertingTo(fmt); convertMutation.mutate(fmt) }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase border transition-colors disabled:opacity-50"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                      >
                        {convertingTo === fmt && convertMutation.isPending ? (
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            {fmt}
                          </span>
                        ) : fmt}
                      </button>
                    ))}
                  </div>
                  {convertMutation.isPending && (
                    <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{t('converting')}</p>
                  )}
                </div>
              )}

              {/* Audio chapter list (read-only) — visible only in audio tab */}
              {hasAudio && versionTab === 'audio' && (
                <div>
                  <p className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Headphones size={12} /> {t('audioChapters') || 'Главы'} ({audioChapters.length})
                  </p>
                  <div className="space-y-1.5">
                    {audioChapters.map((ch, idx) => {
                      const savedPos = audioChapterProgress[ch.id]
                      let listenPct = null
                      if (savedPos != null && ch.duration_seconds > 0) {
                        listenPct = Math.min(100, Math.round((savedPos / ch.duration_seconds) * 100))
                      }
                      return (
                        <button
                          key={ch.id}
                          onClick={() => startListening(idx)}
                          className="w-full flex flex-col gap-0 px-3 pt-2.5 pb-2 rounded-xl text-left transition-colors hover:bg-[var(--bg-secondary)] relative overflow-hidden"
                        >
                          <div className="flex items-center gap-3 w-full">
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: listenPct === 100 ? 'var(--accent)' : 'var(--accent-muted)', color: listenPct === 100 ? '#fff' : 'var(--accent)' }}
                            >
                              {ch.chapter_number}
                            </span>
                            <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{ch.title}</span>
                            {ch.duration_seconds && (
                              <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                {Math.floor(ch.duration_seconds / 60)}:{String(ch.duration_seconds % 60).padStart(2, '0')}
                              </span>
                            )}
                          </div>
                          {listenPct !== null && (
                            <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${listenPct}%`, background: 'var(--accent)', opacity: 0.6 }}
                              />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Text chapter list with reading progress — visible in text tab */}
              {(!hasAudio || versionTab === 'text') && bookTOC?.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <BookOpen size={12} /> Главы ({bookTOC.length})
                  </p>
                  <div className="space-y-0.5">
                    {bookTOC.map((ch, idx) => {
                      // Distribute overall reading % proportionally across chapters
                      const pct = myProgress?.percentage || 0
                      const chapterPct = ((idx + 1) / bookTOC.length) * 100
                      const prevChapterPct = (idx / bookTOC.length) * 100
                      let readPct = null
                      if (pct >= chapterPct) {
                        readPct = 100
                      } else if (pct > prevChapterPct) {
                        readPct = Math.round(((pct - prevChapterPct) / (chapterPct - prevChapterPct)) * 100)
                      }
                      return (
                        <div
                          key={idx}
                          className="flex flex-col gap-0 px-3 pt-2 pb-1.5 rounded-xl relative overflow-hidden"
                          style={{ paddingLeft: ch.depth > 0 ? `${0.75 + ch.depth * 0.75}rem` : '0.75rem' }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                              style={{
                                background: readPct === 100 ? 'var(--accent)' : 'var(--accent-muted)',
                                color: readPct === 100 ? '#fff' : 'var(--accent)',
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span
                              className="text-sm truncate"
                              style={{ color: readPct === 100 ? 'var(--text-secondary)' : 'var(--text-primary)' }}
                            >
                              {ch.title}
                            </span>
                          </div>
                          {readPct !== null && (
                            <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${readPct}%`, background: 'var(--accent)', opacity: 0.5 }}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Admin: upload audio version link — only on audio tab */}
              {canEdit && versionTab === 'audio' && (
                <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <Link
                    to="/upload"
                    className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl transition-colors"
                    style={{ color: 'var(--accent)', background: 'var(--accent-muted)' }}
                  >
                    <Headphones size={14} /> Добавить аудиоверсию
                  </Link>
                </div>
              )}

              {/* Admin edit/delete */}
              {canEdit && (
                <div className="flex gap-2 pt-2">
                  <Link to={`/books/${id}/edit`} className="btn-secondary flex items-center gap-2 text-sm">
                    <Edit size={14} /> {t('edit')}
                  </Link>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-600 border border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950 text-sm transition-colors"
                  >
                    <Trash2 size={14} /> {t('deleteBook')}
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => booksApi.triggerAIAnalyze(id).then(() => toast.success('Анализ запущен')).catch(() => toast.error(t('error')))}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-colors"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    >
                      <Sparkles size={14} /> ИИ-анализ
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && <BookReviews bookId={id} />}
          {activeTab === 'discussions' && <BookDiscussions bookId={id} />}
          {activeTab === 'shelves' && (
            <div className="text-center py-10">
              {isAuthenticated() ? (
                <button onClick={() => setShowShelfModal(true)} className="btn-primary flex items-center gap-2 mx-auto">
                  <Plus size={16} /> {t('addToShelf')}
                </button>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  <Link to="/login" className="text-primary-600 hover:underline">{t('login')}</Link>
                  {' '}чтобы добавить на полку
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar: rating summary (desktop) */}
        <div className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="card p-4 space-y-3">
              <div className="text-center">
                <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {book.avg_rating > 0 ? book.avg_rating.toFixed(1) : '—'}
                </span>
                <div className="flex justify-center mt-1">
                  <StarRating value={book.avg_rating} size={16} />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{book.rating_count} {t('reviews')}</p>
              </div>
              <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>📥 Скачиваний</span>
                  <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{book.download_count}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>👁 Просмотров</span>
                  <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{book.view_count}</span>
                </div>
                {totalAudioSeconds > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>🎧 Аудио</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDuration(totalAudioSeconds)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Series in sidebar */}
            {book.series?.length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Серия</p>
                {book.series.map((s) => (
                  <Link key={s.id} to={`/series/${s.id}`} className="flex items-center gap-2 text-sm hover:underline" style={{ color: 'var(--accent)' }}>
                    <Library size={13} /> {s.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showShelfModal && <AddToShelfModal bookId={id} onClose={() => setShowShelfModal(false)} />}
      {showDeleteConfirm && (
        <ConfirmModal
          title={`${t('deleteBook')}?`}
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setShowDeleteConfirm(false)}
          danger
        />
      )}
    </div>
  )
}
