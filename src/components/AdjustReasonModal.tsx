'use client'
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface AdjustReasonModalProps {
  open: boolean
  /** Tóm tắt thay đổi hiện phía trên ô nhập lý do, vd "Keo dán A: 12 → 8 kg". */
  summary: string
  busy?: boolean
  /** Lỗi từ action (vd BE từ chối vì tồn đã đổi) - hiện inline, modal vẫn mở để thử lại. */
  error?: string | null
  onConfirm: (reason: string) => void
  onCancel: () => void
}

/**
 * Vấn đề #25 audit 26/08/2026 - trước đây "Sửa nhanh tồn kho" (MfgWarehousesPage.tsx,
 * MaterialsPage.tsx) gửi thẳng 1 câu note cố định giống hệt nhau cho mọi lần sửa
 * ("Điều chỉnh tồn kho (trang Kho)"...) thay vì lý do thật - field BE optional nên không bắt được.
 * Modal này chặn xác nhận cho tới khi gõ lý do thật, để sổ kho tra lại sau này còn dùng được.
 */
export default function AdjustReasonModal({
  open,
  summary,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: AdjustReasonModalProps) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  if (!open) return null

  const trimmed = reason.trim()
  const invalid = touched && !trimmed

  const submit = () => {
    setTouched(true)
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div
      onClick={busy ? undefined : onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          <AlertTriangle size={20} color="#4527a0" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Xác nhận sửa tồn kho</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>{summary}</p>
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', margin: '4px 0 4px' }}>Lý do điều chỉnh *</label>
        <input
          autoFocus
          value={reason}
          disabled={busy}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="VD: kiểm kê phát hiện lệch, nhập nhầm lần trước..."
          style={{ width: '100%', padding: '8px 10px', border: `1px solid ${invalid ? '#c62828' : 'var(--border)'}`, borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
        />
        {invalid && <div style={{ color: '#c62828', fontSize: 12, marginTop: 4 }}>Vui lòng nhập lý do</div>}

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(198, 40, 40, 0.08)', border: '1px solid rgba(198, 40, 40, 0.3)',
            borderRadius: 8, padding: '8px 12px', marginTop: 10,
            color: '#c62828', fontSize: 12.5, fontWeight: 500,
          }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{ padding: '8px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
          >
            Hủy
          </button>
          <button
            onClick={submit}
            disabled={busy}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff',
              background: '#4527a0',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Đang lưu...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}
