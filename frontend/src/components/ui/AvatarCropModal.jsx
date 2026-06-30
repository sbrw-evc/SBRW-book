import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import { X, RotateCcw, RotateCw, Check, ZoomIn, ZoomOut } from 'lucide-react'
import { useTranslation } from '../../hooks/useTranslation'

function toRad(deg) { return (deg * Math.PI) / 180 }

async function getCroppedBlob(src, pixelCrop, rotation) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

  const maxDim   = Math.max(image.width, image.height)
  const safeArea = Math.ceil(2 * ((maxDim / 2) * Math.sqrt(2)))

  
  const canvas = document.createElement('canvas')
  canvas.width  = safeArea
  canvas.height = safeArea
  const ctx = canvas.getContext('2d')
  ctx.translate(safeArea / 2, safeArea / 2)
  ctx.rotate(toRad(rotation))
  ctx.translate(-safeArea / 2, -safeArea / 2)
  ctx.drawImage(image, safeArea / 2 - image.width / 2, safeArea / 2 - image.height / 2)

  
  const allData = ctx.getImageData(0, 0, safeArea, safeArea)

  
  
  canvas.width  = pixelCrop.width
  canvas.height = pixelCrop.height
  ctx.putImageData(
    allData,
    Math.round(0 - safeArea / 2 + image.width  / 2 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height / 2 - pixelCrop.y),
  )

  
  const out = document.createElement('canvas')
  out.width  = 512
  out.height = 512
  out.getContext('2d').drawImage(canvas, 0, 0, 512, 512)

  return new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.92))
}

export function AvatarCropModal({ src, onClose, onSave }) {
  const { t } = useTranslation()
  const [crop,              setCrop             ] = useState({ x: 0, y: 0 })
  const [zoom,              setZoom             ] = useState(1)
  const [rotation,          setRotation         ] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [saving,            setSaving           ] = useState(false)

  const onCropComplete = useCallback((_, cap) => setCroppedAreaPixels(cap), [])

  const rotate = (deg) =>
    setRotation((r) => {
      const next = (r + deg) % 360
      return next < -180 ? next + 360 : next > 180 ? next - 360 : next
    })

  const handleSave = async () => {
    if (!croppedAreaPixels) return
    setSaving(true)
    try {
      const blob = await getCroppedBlob(src, croppedAreaPixels, rotation)
      onSave(blob)
    } finally {
      setSaving(false)
    }
  }

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '8px', transition: 'background 0.15s',
    cursor: 'pointer', border: 'none',
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            {t('avatarCropTitle')}
          </h3>
          <button
            onClick={onClose}
            style={{ ...btnBase, padding: '6px', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative" style={{ height: '300px', background: '#0a0a0a' }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: '2px solid var(--accent)' },
            }}
          />
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
              style={{ ...btnBase, padding: '4px', color: 'var(--text-muted)' }}
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="range" min={1} max={3} step={0.02}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              style={{ ...btnBase, padding: '4px', color: 'var(--text-muted)' }}
            >
              <ZoomIn size={16} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => rotate(-90)}
              title="Повернуть влево"
              style={{ ...btnBase, padding: '6px', color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <RotateCcw size={16} />
            </button>
            <input
              type="range" min={-180} max={180} step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="flex-1"
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <button
              onClick={() => rotate(90)}
              title="Повернуть вправо"
              style={{ ...btnBase, padding: '6px', color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <RotateCw size={16} />
            </button>
          </div>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            {t('avatarCropHint')}
          </p>
        </div>

        <div
          className="flex gap-3 px-5 pb-5 pt-1"
        >
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            style={{ textAlign: 'center' }}
          >
            {t('avatarCropCancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Check size={15} />}
            {t('avatarCropSave')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
