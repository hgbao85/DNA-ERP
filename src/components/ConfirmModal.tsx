import { AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  /** Lỗi từ action (vd BE từ chối xóa) — hiện inline, modal vẫn mở để người dùng thấy và Hủy/thử lại. */
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title = 'Xác nhận',
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger = false,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null
  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
          <AlertTriangle size={20} color={danger ? '#c62828' : '#4527a0'} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{message}</p>
          </div>
        </div>
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(198, 40, 40, 0.08)', border: '1px solid rgba(198, 40, 40, 0.3)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 14,
            color: '#c62828', fontSize: 12.5, fontWeight: 500,
          }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{ padding: '8px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff',
              background: danger ? '#c62828' : '#4527a0',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
