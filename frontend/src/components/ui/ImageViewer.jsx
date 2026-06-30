import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

const ANIM_MS = 220

function Viewer({ images, initialIndex, onClose }) {
  const [idx, setIdx] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)
  const [visible, setVisible] = useState(false) 
  const [closing, setClosing] = useState(false)  
  const closeTimer = useRef(null)

  
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    return () => clearTimeout(closeTimer.current)
  }, [])

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIdx((i) => Math.min(images.length - 1, i + 1)), [images.length])

  useEffect(() => { setZoomed(false) }, [idx])

  
  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setVisible(false)
    closeTimer.current = setTimeout(onClose, ANIM_MS)
  }, [closing, onClose])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') handleClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [handleClose, prev, next])

  const hasPrev = idx > 0
  const hasNext = idx < images.length - 1

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: `rgba(0,0,0,${visible ? 0.92 : 0})`,
        transition: `background ${ANIM_MS}ms ease`,
      }}
      onClick={handleClose}
    >
      {/* Close */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full z-10 transition-colors"
        style={{
          background: 'rgba(255,255,255,0.12)',
          color: 'white',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.8)',
          transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`,
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
      >
        <X size={20} />
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-sm font-medium z-10"
          style={{
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            opacity: visible ? 1 : 0,
            transition: `opacity ${ANIM_MS}ms ease`,
          }}
        >
          {idx + 1} / {images.length}
        </div>
      )}

      {/* Prev arrow */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); prev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full z-10 transition-all"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Next arrow */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); next() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full z-10 transition-all"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Image */}
      <div
        className="flex items-center justify-center"
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.93)',
          transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[idx]}
          alt=""
          onClick={() => setZoomed((v) => !v)}
          className="rounded-lg select-none transition-transform duration-200"
          style={{
            maxWidth: zoomed ? '95vw' : '85vw',
            maxHeight: zoomed ? '95vh' : '85vh',
            objectFit: 'contain',
            cursor: zoomed ? 'zoom-out' : 'zoom-in',
            boxShadow: '0 8px 60px rgba(0,0,0,0.7)',
          }}
          draggable={false}
        />
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-2 rounded-2xl z-10"
          style={{
            background: 'rgba(0,0,0,0.5)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className="rounded-lg overflow-hidden flex-shrink-0 transition-all"
              style={{
                width: i === idx ? 40 : 32,
                height: i === idx ? 40 : 32,
                opacity: i === idx ? 1 : 0.55,
                outline: i === idx ? '2px solid white' : 'none',
                outlineOffset: '1px',
              }}
            >
              <img src={img} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}

/**
 * Renders a row of media (images + videos).
 * Images open in the Viewer modal; videos play inline.
 */
export function MediaGallery({ urls, compact = false }) {
  const [viewerIdx, setViewerIdx] = useState(null)
  if (!urls?.length) return null

  const imageUrls = urls.filter((u) => !u.match(/\.(mp4|webm|ogg)$/i))
  const videoUrls = urls.filter((u) => u.match(/\.(mp4|webm|ogg)$/i))

  const imgH = compact ? 'max-h-36' : 'max-h-48'
  const imgW = compact ? '120px' : '220px'

  return (
    <>
      {(imageUrls.length > 0 || videoUrls.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {imageUrls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setViewerIdx(i)}
              className={`${imgH} rounded-lg overflow-hidden flex-shrink-0 focus:outline-none`}
              style={{ maxWidth: imgW }}
            >
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover rounded-lg transition-opacity hover:opacity-85"
                draggable={false}
              />
            </button>
          ))}
          {videoUrls.map((url) => (
            <video
              key={url}
              src={url}
              controls
              className={`${imgH} rounded-lg`}
              style={{ maxWidth: '100%' }}
            />
          ))}
        </div>
      )}

      {viewerIdx !== null && (
        <Viewer
          images={imageUrls}
          initialIndex={viewerIdx}
          onClose={() => setViewerIdx(null)}
        />
      )}
    </>
  )
}
