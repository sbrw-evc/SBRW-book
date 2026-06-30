import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatApi, usersApi } from '../../api/auth'
import { booksApi } from '../../api/books'
import { useAppStore } from '../../store/appStore'
import { useTranslation } from '../../hooks/useTranslation'
import { EmojiButton } from '../ui/EmojiButton'
import { MediaGallery } from '../ui/ImageViewer'
import {
  MessageCircle, X, ArrowLeft, Send, Users, Plus, Search, ImageIcon, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const ANIM = 220

function RoomAvatar({ room, members, myId, size = 9 }) {
  const others = members?.filter((m) => m.id !== myId)
  const cls = `w-${size} h-${size} rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center`
  if (room?.is_group) {
    return (
      <div className={cls} style={{ background: 'var(--accent-muted)' }}>
        <Users size={16} style={{ color: 'var(--accent)' }} />
      </div>
    )
  }
  const other = others?.[0]
  return (
    <div className={cls} style={{ background: 'var(--accent-muted)' }}>
      {other?.avatar
        ? <img src={other.avatar} alt="" className="w-full h-full object-cover" />
        : <span className="font-semibold text-xs" style={{ color: 'var(--accent)' }}>{other?.username?.[0]?.toUpperCase() || '?'}</span>}
    </div>
  )
}

function roomDisplayName(room, myId, chatDefault, chatGroup) {
  if (!room) return chatDefault
  if (room.is_group) return room.name || `${chatGroup} (${room.members?.length})`
  const other = room.members?.find((m) => m.id !== myId)
  return other?.username || chatDefault
}

// ─── New Chat Panel inside the widget ────────────────────────────────────────

function NewChatPanel({ onBack, onCreate }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [groupName, setGroupName] = useState('')

  const { data: users = [] } = useQuery({
    queryKey: ['users-search-widget', search],
    queryFn: () =>
      search.length > 1
        ? usersApi.list({ search, page_size: 20 }).then((r) => r.data)
        : Promise.resolve([]),
    enabled: search.length > 1,
  })

  const isGroup = selected.length > 1

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('chatSearch')}
            className="input pl-8 py-2 text-sm w-full"
            autoFocus
          />
        </div>
        {isGroup && (
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t('chatGroupNameShort')}
            className="input py-2 text-sm w-full mt-2"
          />
        )}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {selected.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                onClick={() => setSelected((v) => v.filter((x) => x.id !== u.id))}
              >
                {u.username} <X size={10} />
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {users.map?.((u) => {
          const isSel = selected.some((s) => s.id === u.id)
          return (
            <button
              key={u.id}
              onClick={() => setSelected((v) => isSel ? v.filter((x) => x.id !== u.id) : [...v, u])}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left"
              style={{
                background: isSel ? 'var(--accent-muted)' : 'transparent',
                color: 'var(--text-primary)',
              }}
            >
              <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
                {u.avatar
                  ? <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                  : <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{u.username?.[0]?.toUpperCase()}</span>}
              </div>
              <span className="truncate">{u.username}</span>
              {isSel && <span className="ml-auto text-xs" style={{ color: 'var(--accent)' }}>✓</span>}
            </button>
          )
        })}
      </div>

      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => selected.length && onCreate({ member_ids: selected.map((u) => u.id), is_group: isGroup, name: groupName })}
          disabled={!selected.length}
          className="btn-primary w-full text-sm py-2"
        >
          {isGroup ? t('chatCreateGroup') : t('chatStart')}
        </button>
      </div>
    </div>
  )
}

// ─── Room list view ───────────────────────────────────────────────────────────

function RoomListView({ rooms, myId, onSelect }) {
  const { t, locale } = useTranslation()
  const timeLocale = locale === 'ru' ? 'ru-RU' : 'en-US'

  if (!rooms.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <MessageCircle size={40} className="opacity-20" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('chatNoRooms')}</p>
      </div>
    )
  }
  return (
    <div className="overflow-y-auto h-full">
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => onSelect(room)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
          style={{ color: 'var(--text-primary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <RoomAvatar room={room} members={room.members} myId={myId} size={9} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{roomDisplayName(room, myId, t('chatDefault'), t('chatGroup'))}</p>
            {room.last_message && (
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {room.last_message.text || t('chatMedia')}
              </p>
            )}
          </div>
          {room.last_message && (
            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              {new Date(room.last_message.created_at).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Room messages view ───────────────────────────────────────────────────────

function RoomMessagesView({ room, myId, accessToken }) {
  const { t, locale } = useTranslation()
  const timeLocale = locale === 'ru' ? 'ru-RU' : 'en-US'
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [mediaUrls, setMediaUrls] = useState([])
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const wsRef = useRef(null)

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', room.id],
    queryFn: () => chatApi.getMessages(room.id).then((r) => r.data),
    enabled: !!room.id,
    staleTime: 0,
  })

  useEffect(() => {
    if (!accessToken) return
    let unmounted = false
    let reconnectTimer = null
    const delay = { current: 1_000 }

    const connect = () => {
      if (unmounted) return
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${scheme}://${window.location.host}/ws/chat/${room.id}/?token=${accessToken}`)
      wsRef.current = ws

      ws.onopen = () => { if (!unmounted) delay.current = 1_000 }
      ws.onerror = () => ws.close()
      ws.onclose = () => {
        if (unmounted) return
        reconnectTimer = setTimeout(connect, delay.current)
        delay.current = Math.min(delay.current * 2, 30_000)
      }
      ws.onmessage = (e) => {
        if (unmounted) return
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'new_message') {
            qc.setQueryData(['chat-messages', room.id], (old = []) => {
              if (old.some((m) => m.id === data.id)) return old
              return [...old, data]
            })
            qc.invalidateQueries({ queryKey: ['chat-rooms'] })
          }
          if (data.type === 'deleted') {
            qc.setQueryData(['chat-messages', room.id], (old = []) =>
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
  }, [room.id, accessToken, qc])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const sendMutation = useMutation({
    mutationFn: (d) => chatApi.sendMessage(room.id, d),
    onSuccess: () => { setText(''); setMediaUrls([]) },
    onError: () => toast.error(t('chatSendError')),
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {messages.map((msg) => {
          const isOwn = msg.user_id === myId
          return (
            <div key={msg.id} className={`flex gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className="max-w-[78%]">
                {!isOwn && (
                  <p className="text-[10px] px-1 mb-0.5" style={{ color: 'var(--text-muted)' }}>{msg.username}</p>
                )}
                <div
                  className="px-2.5 py-1.5 text-xs leading-relaxed"
                  style={{
                    background: isOwn ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: isOwn ? 'white' : 'var(--text-primary)',
                    borderRadius: isOwn ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    border: isOwn ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                  <MediaGallery urls={msg.media_urls} compact />
                  <p className="text-[9px] mt-0.5 opacity-60 text-right">
                    {new Date(msg.created_at).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {mediaUrls.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-1">
          {mediaUrls.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="h-10 w-10 object-cover rounded-lg" />
              <button
                onClick={() => setMediaUrls((v) => v.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs leading-none"
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div className="p-2 border-t flex items-end gap-1.5" style={{ borderColor: 'var(--border)' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder={t('chatMessagePlaceholder')}
          className="input resize-none text-xs flex-1"
          rows={1}
          style={{ minHeight: '32px', maxHeight: '80px', padding: '6px 10px' }}
        />
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <EmojiButton onSelect={(emoji) => setText((v) => v + emoji)} />
          <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" multiple className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || mediaUrls.length >= 10}
            className="p-1.5 rounded-lg disabled:opacity-40 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {uploading
              ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin block" />
              : <ImageIcon size={14} />}
          </button>
          <button
            onClick={handleSend}
            disabled={(!text.trim() && !mediaUrls.length) || sendMutation.isPending}
            className="p-1.5 rounded-lg disabled:opacity-40 transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export function ChatWidget() {
  const { t } = useTranslation()
  const { isAuthenticated, user, accessToken, readerUiHidden, audioPlayer } = useAppStore()
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)
  const [view, setView] = useState('rooms')
  const [slideState, setSlideState] = useState('idle')
  const [activeRoom, setActiveRoom] = useState(null)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => requestAnimationFrame(() => setPanelVisible(true)))
    } else {
      setPanelVisible(false)
    }
  }, [open])

  const { data: rooms = [] } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: () => chatApi.listRooms().then((r) => r.data),
    enabled: open && isAuthenticated(),
    staleTime: 0,
  })

  const createMutation = useMutation({
    mutationFn: (data) => chatApi.createRoom(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['chat-rooms'] })
      navigateTo('room', res.data)
    },
    onError: () => toast.error(t('chatCreateError')),
  })

  const navigateTo = useCallback((nextView, roomData = null) => {
    setSlideState('out')
    setTimeout(() => {
      setActiveRoom(roomData)
      setView(nextView)
      setSlideState('in')
      requestAnimationFrame(() => requestAnimationFrame(() => setSlideState('idle')))
    }, 180)
  }, [])

  const handleSelectRoom = (room) => navigateTo('room', room)
  const handleBack = () => navigateTo('rooms')
  const handleNewChat = () => navigateTo('new')

  if (!isAuthenticated() || readerUiHidden) return null

  const headerTitle = view === 'rooms'
    ? t('chatTitle')
    : view === 'new'
      ? t('chatNew')
      : roomDisplayName(activeRoom, user?.id, t('chatDefault'), t('chatGroup'))

  const slideStyle = {
    opacity: slideState === 'idle' ? 1 : 0,
    transform: slideState === 'idle' ? 'translateX(0)' : slideState === 'out' ? 'translateX(-16px)' : 'translateX(16px)',
    transition: 'opacity 0.18s ease, transform 0.18s ease',
  }

  return createPortal(
    <>
      {open && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 799 }}
          onClick={() => setOpen(false)}
        />
      )}
      <div
        className="fixed right-6 z-[800] flex flex-col items-end gap-3 transition-all duration-300"
        style={{ bottom: audioPlayer ? '9rem' : '1.5rem' }}
        style={{ pointerEvents: 'none' }}
      >
        {/* Panel */}
        <div
          className="rounded-2xl overflow-hidden flex flex-col shadow-2xl"
          style={{
            width: '340px',
            height: '500px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            opacity: panelVisible ? 1 : 0,
            transform: panelVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.96)',
            pointerEvents: open ? 'auto' : 'none',
            transition: `opacity ${ANIM}ms ease, transform ${ANIM}ms ease`,
            transformOrigin: 'bottom right',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
            style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
          >
            {(view === 'room' || view === 'new') && (
              <button
                onClick={handleBack}
                className="p-1 rounded-lg transition-colors flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <ArrowLeft size={15} />
              </button>
            )}

            <span className="font-semibold text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
              {headerTitle}
            </span>

            {view === 'rooms' && (
              <button
                onClick={handleNewChat}
                className="p-1 rounded-lg transition-colors flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
                title={t('chatNew')}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <Plus size={15} />
              </button>
            )}

            {view === 'room' && (
              <Link
                to={`/chat/${activeRoom?.id}`}
                className="p-1 rounded-lg transition-colors flex-shrink-0 text-[10px]"
                style={{ color: 'var(--text-muted)' }}
                title={t('chatOpenFullscreen')}
              >
                ⤢
              </Link>
            )}

            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg transition-colors flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <X size={15} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0" style={slideStyle}>
            {view === 'rooms' && (
              <RoomListView rooms={rooms} myId={user?.id} onSelect={handleSelectRoom} />
            )}
            {view === 'new' && (
              <NewChatPanel
                onBack={handleBack}
                onCreate={(data) => createMutation.mutate(data)}
              />
            )}
            {view === 'room' && activeRoom && (
              <RoomMessagesView room={activeRoom} myId={user?.id} accessToken={accessToken} />
            )}
          </div>
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95"
          style={{ background: 'var(--accent)', color: 'white', pointerEvents: 'auto' }}
          title={t('chatTitle')}
        >
          <div style={{
            transform: open ? 'rotate(90deg) scale(0.85)' : 'rotate(0deg) scale(1)',
            transition: 'transform 0.22s ease',
          }}>
            {open ? <X size={22} /> : <MessageCircle size={22} />}
          </div>
        </button>
      </div>
    </>,
    document.body,
  )
}
