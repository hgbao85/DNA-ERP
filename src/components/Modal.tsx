import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose?: () => void
  maxWidth?: number
  zIndex?: number
  children: ReactNode
}

/**
 * Lớp overlay + thẻ nội dung dùng chung cho mọi modal trong app (xác nhận, nhập lý do, form...).
 * Bấm ra ngoài vùng nội dung sẽ đóng modal nếu có truyền onClose.
 */
export default function Modal({ open, onClose, maxWidth = 440, zIndex = 1000, children }: ModalProps) {
  if (!open) return null
  return (
    <div
      onClick={e => { if (onClose && e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        {children}
      </div>
    </div>
  )
}
