import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTranslation } from '../../hooks/useTranslation'

export function ConfirmModal({ title, message, onConfirm, onClose, danger = false }) {
  const { t } = useTranslation()
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9000] p-4"
      onClick={onClose}
    >
      <div
        className="card p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-base pr-4" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <button onClick={onClose} className="flex-shrink-0">
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
        {message && (
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </p>
        )}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">
            {t('cancel')}
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className={`flex-1 text-sm px-4 py-2.5 rounded-xl font-medium transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'btn-primary'
            }`}
          >
            {danger ? t('delete') : t('confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
