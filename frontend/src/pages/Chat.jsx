import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatApi, usersApi } from '../api/auth'
import { booksApi } from '../api/books'
import { useAppStore } from '../store/appStore'
import { useTranslation } from '../hooks/useTranslation'
import { PageSpinner } from '../components/ui/Spinner'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { EmojiButton } from '../components/ui/EmojiButton'
import { MediaGallery } from '../components/ui/ImageViewer'
import {
  MessageCircle, Plus, Send, Trash2, ArrowLeft, Users, X, Search, ImageIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'

function UserAvatar({ username, avatar, size = 8 }) {
  const cls = `w-${size} h-${size}`
  return (
    <div
      className={`${cls} rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center`}
      style={{ background: 'var(--accent-muted)' }}
    >
      {avatar ? (
        <img src={avatar} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="font-semibold text-xs" style={{ color: 'var(--accent)' }}>
          {username?.[0]?.toUpperCase() || '?'}
        </span>
      )}
    </div>
  )
}

// ─── New Chat Modal ───────────────────────────────────────────────────────────

function NewChatModal({ onClose, onCreate }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [groupName, setGroupName] = useState('')

  const { data: users = [] } = useQuery({
    queryKey: ['users-search', search],
    queryFn: () =>
      search.length > 1
        ? usersApi.list({ search, page_size: 20 }).then((r) => r.data)
        : Promise.resolve([]),
    enabled: search.length > 1,
  })

  const isGroup = selected.length > 1

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('chatNew')}</h3>
          <button onClick={onClose}><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-3" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('chatSearch')}
            className="input pl-8 text-sm"
          />
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selected.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              >
                {u.username}
                <button onClick={() => setSelected((v) => v.filter((x) => x.id !== u.id))}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {isGroup && (
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t('chatGroupName')}
            className="input text-sm mb-3"
          />
        )}

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {users.map?.((u) => {
            const isSelected = selected.some((s) => s.id === u.id)
            return (
              <button
                key={u.id}
                onClick={() => setSelected((v) => isSelected ? v.filter((x) => x.id !== u.id) : [...v, u])}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: isSelected ? 'var(--accent-muted)' : 'transparent',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isSelected ? 'var(--accent-muted)' : 'transparent' }}
              >
                <UserAvatar username={u.username} avatar={u.avatar} size={7} />
                <span>{u.username}</span>
                {isSelected && <span className="ml-auto text-xs" style={{ color: 'var(--accent)' }}>✓</span>}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => selected.length && onCreate({ member_ids: selected.map((u) => u.id), is_group: isGroup, name: groupName })}
          disabled={!selected.length}
          className="btn-primary w-full mt-4 text-sm"
        >
          {isGroup ? t('chatCreateGroup') : t('chatStart')}
        </button>
      </div>
    </div>
  )
}

// ─── Chat Room List ───────────────────────────────────────────────────────────

export function Chat() {
  const { t, locale } = useTranslation()
  const { user } = useAppStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showNewChat, setShowNewChat] = useState(false)
  const timeLocale = locale === 'ru' ? 'ru-RU' : 'en-US'

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: () => chatApi.listRooms().then((r) => r.data),
    staleTime: 0,
  })

  const createMutation = useMutation({
    mutationFn: (data) => chatApi.createRoom(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['chat-rooms'] })
      setShowNewChat(false)
      navigate(`/chat/${res.data.id}`)
    },
    onError: () => toast.error(t('chatCreateError')),
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <MessageCircle size={24} style={{ color: 'var(--accent)' }} />
          {t('chatTitle')}
        </h1>
        <button onClick={() => setShowNewChat(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          {t('chatNew')}
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageCircle size={48} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('chatNoRooms')}</p>
          <button onClick={() => setShowNewChat(true)} className="btn-primary mt-4 text-sm">{t('chatStartConversation')}</button>
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.map((room) => {
            const others = room.members?.filter((m) => m.id !== user?.id)
            const displayName = room.is_group
              ? (room.name || `${t('chatGroup')} (${room.members?.length})`)
              : others?.[0]?.username || t('chatDefault')
            return (
              <Link
                key={room.id}
                to={`/chat/${room.id}`}
                className="card p-4 flex items-center gap-3 hover:border-primary-400 transition-colors block"
                style={{ borderColor: 'var(--border)' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ background: 'var(--accent-muted)' }}
                >
                  {room.is_group ? (
                    <Users size={18} style={{ color: 'var(--accent)' }} />
                  ) : others?.[0]?.avatar ? (
                    <img src={others[0].avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-semibold text-sm" style={{ color: 'var(--accent)' }}>
                      {others?.[0]?.username?.[0]?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                  {room.last_message && (
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {room.last_message.username}: {room.last_message.text || t('chatMedia')}
                    </p>
                  )}
                </div>
                {room.last_message && (
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {new Date(room.last_message.created_at).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onCreate={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  )
}

// ─── Chat Room ────────────────────────────────────────────────────────────────

export function ChatRoom() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const { user, accessToken } = useAppStore()
  const qc = useQueryClient()
  const timeLocale = locale === 'ru' ? 'ru-RU' : 'en-US'

  const [text, setText] = useState('')
  const [mediaUrls, setMediaUrls] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [wsStatus, setWsStatus] = useState('connecting')
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const wsRef = useRef(null)

  const { data: room } = useQuery({
    queryKey: ['chat-room', roomId],
    queryFn: () => chatApi.getRoom(roomId).then((r) => r.data),
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', roomId],
    queryFn: () => chatApi.getMessages(roomId).then((r) => r.data),
    staleTime: 0,
  })

  useEffect(() => {
    if (!accessToken || !roomId) return
    let unmounted = false
    let reconnectTimer = null
    const delay = { current: 1_000 }

    const connect = () => {
      if (unmounted) return
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${scheme}://${window.location.host}/ws/chat/${roomId}/?token=${accessToken}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (unmounted) return
        setWsStatus('open')
        delay.current = 1_000
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => {
        if (unmounted) return
        setWsStatus('closed')
        reconnectTimer = setTimeout(connect, delay.current)
        delay.current = Math.min(delay.current * 2, 30_000)
      }
      ws.onmessage = (event) => {
        if (unmounted) return
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'new_message') {
            qc.setQueryData(['chat-messages', roomId], (old = []) => {
              if (old.some((m) => m.id === data.id)) return old
              return [...old, data]
            })
            qc.invalidateQueries({ queryKey: ['chat-rooms'] })
          }
          if (data.type === 'deleted') {
            qc.setQueryData(['chat-messages', roomId], (old = []) =>
              old.filter((m) => m.id !== data.id),
            )
          }
        } catch {}
      }
    }

    connect()
    return () => {
      unmounted = true
      clearTimeout(reconnectTimer)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [roomId, accessToken, qc])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const sendMutation = useMutation({
    mutationFn: (data) => chatApi.sendMessage(roomId, data),
    onSuccess: () => { setText(''); setMediaUrls([]) },
    onError: () => toast.error(t('chatSendError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (msgId) => chatApi.deleteMessage(roomId, msgId),
    onSuccess: () => setDeleteTarget(null),
  })

  const handleSend = () => {
    if (!text.trim() && !mediaUrls.length) return
    sendMutation.mutate({ text, media_urls: mediaUrls })
  }

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return

    const MAX_FILES = 10
    const MAX_SIZE = 20 * 1024 * 1024
    const remaining = MAX_FILES - mediaUrls.length
    if (remaining <= 0) { toast.error(t('chatTooManyFiles')); return }

    const toUpload = []
    for (const file of files.slice(0, remaining)) {
      if (file.size > MAX_SIZE) { toast.error(`«${file.name}» ${t('chatFileTooBig')}`); continue }
      toUpload.push(file)
    }
    if (files.length > remaining) toast.error(`${t('chatCanAddMore')} ${remaining} ${t('chatMoreFiles')}`)
    if (!toUpload.length) return

    setUploading(true)
    for (const file of toUpload) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        const { data } = await booksApi.uploadMedia(fd)
        setMediaUrls((v) => [...v, data.url])
      } catch {
        toast.error(`${t('chatUploadFailed')} «${file.name}»`)
      }
    }
    setUploading(false)
  }

  const others = room?.members?.filter((m) => m.id !== user?.id)
  const roomName = room?.is_group
    ? (room.name || `${t('chatGroup')} (${room?.members?.length})`)
    : others?.[0]?.username || t('chatDefault')

  return (
    <div className="max-w-3xl mx-auto animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="card p-3 mb-3 flex items-center gap-3">
        <button onClick={() => navigate('/chat')} className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </button>
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
          style={{ background: 'var(--accent-muted)' }}
        >
          {room?.is_group ? (
            <Users size={16} style={{ color: 'var(--accent)' }} />
          ) : others?.[0]?.avatar ? (
            <img src={others[0].avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-semibold text-sm" style={{ color: 'var(--accent)' }}>
              {others?.[0]?.username?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{roomName}</p>
          {room?.is_group && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {room.members?.map((m) => m.username).join(', ')}
            </p>
          )}
        </div>
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          title={wsStatus === 'open' ? t('chatConnected') : t('chatReconnecting')}
          style={{ background: wsStatus === 'open' ? '#22c55e' : '#f59e0b' }}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 px-1 pb-2">
        {messages.map((msg) => {
          const isOwn = msg.user_id === user?.id
          const canDel = isOwn || user?.role === 'admin' || user?.role === 'moderator'
          return (
            <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
              {!isOwn && (
                <Link to={`/users/${msg.user_id}`} className="flex-shrink-0 self-end">
                  <UserAvatar username={msg.username} avatar={msg.avatar} size={8} />
                </Link>
              )}
              <div className="max-w-[72%] group relative">
                {!isOwn && (
                  <p className="text-xs mb-0.5 px-1" style={{ color: 'var(--text-muted)' }}>{msg.username}</p>
                )}
                <div
                  className="px-3 py-2 text-sm"
                  style={{
                    background: isOwn ? 'var(--accent)' : 'var(--bg-card)',
                    color: isOwn ? 'white' : 'var(--text-primary)',
                    borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    border: isOwn ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {msg.text && (
                    <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                  )}
                  <MediaGallery urls={msg.media_urls} compact />
                  <p className="text-[10px] mt-1 opacity-60 text-right">
                    {new Date(msg.created_at).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {canDel && (
                  <button
                    onClick={() => setDeleteTarget(msg.id)}
                    className="absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                    style={{ [isOwn ? 'left' : 'right']: '-28px', color: '#ef4444' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="card p-3 mt-2">
        {mediaUrls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {mediaUrls.map((url, i) => {
              const isVideo = url.match(/\.(mp4|webm|ogg)$/i)
              return (
                <div key={i} className="relative">
                  {isVideo ? (
                    <video src={url} className="h-16 rounded-lg" />
                  ) : (
                    <img src={url} alt="" className="h-16 w-16 object-cover rounded-lg" />
                  )}
                  <button
                    onClick={() => setMediaUrls((v) => v.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs leading-none"
                  >×</button>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder={t('chatWriteMessage')}
            className="input resize-none text-sm flex-1"
            rows={1}
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <EmojiButton onSelect={(emoji) => setText((v) => v + emoji)} />
            <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" multiple className="hidden" onChange={handleFile} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || mediaUrls.length >= 10}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              {uploading
                ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                : <ImageIcon size={18} />}
            </button>
            <button
              onClick={handleSend}
              disabled={(!text.trim() && !mediaUrls.length) || sendMutation.isPending}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ color: 'var(--accent)' }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title={t('chatDeleteMessage')}
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  )
}
