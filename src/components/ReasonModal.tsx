import Modal from './Modal'
import { btnSecondary } from '../styles/buttons'

interface ReasonModalProps {
  open: boolean
  title: string
  description?: string
  reason: string
  onReasonChange: (value: string) => void
  placeholder?: string
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  confirmColor?: string
  busy?: boolean
}

/**
 * Modal nhập lý do (vd: từ chối lệnh mua, từ chối vật tư) — gồm tiêu đề, mô tả tuỳ chọn,
 * textarea lý do và 2 nút Hủy/Xác nhận. Dùng chung cho mọi luồng "từ chối kèm lý do" trong app.
 */
export default function ReasonModal({
  open,
  title,
  description,
  reason,
  onReasonChange,
  placeholder = 'Nhập lý do (không bắt buộc)...',
  onCancel,
  onConfirm,
  confirmLabel = 'Xác nhận từ chối',
  confirmColor = '#c62828',
  busy = false,
}: ReasonModalProps) {
  return (
    <Modal open={open} onClose={busy ? undefined : onCancel} maxWidth={420} zIndex={2000}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>{title}</h3>
      {description && <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text3)' }}>{description}</p>}
      <textarea
        value={reason}
        onChange={e => onReasonChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        autoFocus
        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onCancel} disabled={busy} style={btnSecondary}>Hủy</button>
        <button
          onClick={onConfirm}
          disabled={busy}
          style={{ padding: '8px 18px', background: confirmColor, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
        >
          {busy ? 'Đang xử lý...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
