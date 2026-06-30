import { useRef, useEffect, useState } from 'react'
import EmojiPicker from 'emoji-picker-react'
import { Smile } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

function pickerVars(theme) {
  const dark = theme === 'dark'
  return {
    '--epr-bg-color': dark ? '#1e1e2e' : '#ffffff',
    '--epr-category-label-bg-color': dark ? '#1e1e2e' : '#f8f8fc',
    '--epr-text-color': dark ? '#cdd6f4' : '#1e1b4b',
    '--epr-search-border-color': dark ? '#45475a' : '#e2e8f0',
    '--epr-search-placeholder-color': dark ? '#6c7086' : '#94a3b8',
    '--epr-header-overlay-color': dark ? '#1e1e2e' : '#ffffff',
    '--epr-hover-bg-color': dark ? '#313244' : '#ede9fe',
    '--epr-focus-bg-color': dark ? '#45475a' : '#ddd6fe',
    '--epr-highlight-color': dark ? '#cba6f7' : '#7c3aed',
    '--epr-skin-tone-picker-menu-bg-color': dark ? '#313244' : '#f8f8fc',
    '--epr-category-icon-active-color': dark ? '#cba6f7' : '#7c3aed',
  }
}

const ANIM_MS = 200

export function EmojiButton({ onSelect, disabled }) {
  const { theme } = useAppStore()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)   
  const [visible, setVisible] = useState(false)    
  const containerRef = useRef(null)
  const unmountTimer = useRef(null)

  
  const openPicker = () => {
    clearTimeout(unmountTimer.current)
    setMounted(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    setOpen(true)
  }

  
  const closePicker = () => {
    setVisible(false)
    setOpen(false)
    unmountTimer.current = setTimeout(() => setMounted(false), ANIM_MS)
  }

  useEffect(() => () => clearTimeout(unmountTimer.current), [])

  
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) closePicker()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? closePicker() : openPicker())}
        disabled={disabled}
        className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
        style={{ color: open ? 'var(--accent)' : 'var(--text-muted)' }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.color = 'var(--accent)' }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.color = open ? 'var(--accent)' : 'var(--text-muted)' }}
        title="Эмодзи"
      >
        <Smile
          size={16}
          style={{
            transform: open ? 'rotate(20deg) scale(1.15)' : 'rotate(0deg) scale(1)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {mounted && (
        <div
          style={{
            position: 'absolute',
            bottom: '36px',
            right: 0,
            zIndex: 9999,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
            transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`,
            transformOrigin: 'bottom right',
            ...pickerVars(theme),
          }}
        >
          <EmojiPicker
            onEmojiClick={(emoji) => { onSelect(emoji.emoji); closePicker() }}
            theme={theme === 'dark' ? 'dark' : 'light'}
            width={300}
            height={380}
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
            lazyLoadEmojis
          />
        </div>
      )}
    </div>
  )
}
