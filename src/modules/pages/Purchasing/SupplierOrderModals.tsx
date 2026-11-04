import { useState } from 'react'
import { ClipboardList, X } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { getSuppliers } from '../../../services/api'

/**
 * Popup dùng chung cho đơn đặt hàng NCC (2026-11-04, bản v8 mục 4.10) ở màn "Lệnh mua vật tư":
 * tạo đơn (bắt buộc chọn NCC, hệ thống cấp số đơn) và huỷ đơn chưa duyệt (bắt buộc lý do).
 */

function ModalShell({ title, onClose, children, footer }: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
    >
      <div
        role="dialog"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <ClipboardList size={17} color="var(--fg-2563eb)" />
          <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Đóng" style={{ display: 'flex', padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X size={17} />
          </button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          {footer}
        </div>
      </div>
    </div>
  )
}

const secondaryBtn: React.CSSProperties = { padding: '7px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }
const primaryBtn = (disabled: boolean, danger = false): React.CSSProperties => ({
  padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, color: '#fff',
  background: disabled ? 'var(--bg-93c5fd)' : danger ? 'var(--fg-dc2626)' : 'var(--bg-2563eb)',
  cursor: disabled ? 'default' : 'pointer',
})
const errBox: React.CSSProperties = { marginTop: 12, padding: '8px 10px', fontSize: 12, color: 'var(--fg-991b1b)', background: 'var(--bg-fee2e2)', border: '1px solid var(--fg-fca5a5)', borderRadius: 8 }
const fieldStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }

export function CreateSupplierOrderModal({ itemNames, onClose, onConfirm }: {
  itemNames: string[]
  onClose: () => void
  onConfirm: (supplierId: string) => Promise<void>
}) {
  const { data: suppliers, isLoading } = useFetch(getSuppliers)
  const [supplierId, setSupplierId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const active = (suppliers ?? []).filter(s => s.isActive).sort((a, b) => a.name.localeCompare(b.name, 'vi'))

  const confirm = async () => {
    if (!supplierId || busy) return
    setBusy(true)
    setErr('')
    try {
      await onConfirm(supplierId)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Tạo đơn đặt hàng"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} disabled={busy} style={secondaryBtn}>Huỷ</button>
        <button onClick={() => void confirm()} disabled={!supplierId || busy} style={primaryBtn(!supplierId || busy)}>
          {busy ? 'Đang tạo…' : 'Tạo đơn, cấp số'}
        </button>
      </>}
    >
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
        {itemNames.length} vật tư: <strong>{itemNames.join(', ')}</strong>. Hệ thống cấp ngay số đơn đặt hàng tiếp theo của nhà cung cấp này (vd 53/2026) — số in trên phiếu đề xuất và phiếu nhập kho.
      </div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }} htmlFor="so-supplier">
        Nhà cung cấp <span style={{ color: 'var(--fg-dc2626)' }}>*</span>
      </label>
      <select id="so-supplier" value={supplierId} disabled={busy || isLoading} onChange={e => setSupplierId(e.target.value)} style={fieldStyle}>
        <option value="">{isLoading ? 'Đang tải…' : '— Chọn nhà cung cấp —'}</option>
        {active.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
      </select>
      {!isLoading && active.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>Chưa có nhà cung cấp nào đang hợp tác — nhờ Admin thêm ở Danh mục &gt; Nhà cung cấp.</div>
      )}
      {err && <div style={errBox}>{err}</div>}
    </ModalShell>
  )
}

export function CancelSupplierOrderModal({ orderLabel, onClose, onConfirm }: {
  orderLabel: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const confirm = async () => {
    if (!reason.trim() || busy) return
    setBusy(true)
    setErr('')
    try {
      await onConfirm(reason.trim())
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Huỷ đơn đặt hàng"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} disabled={busy} style={secondaryBtn}>Không huỷ</button>
        <button onClick={() => void confirm()} disabled={!reason.trim() || busy} style={primaryBtn(!reason.trim() || busy, true)}>
          {busy ? 'Đang huỷ…' : 'Huỷ đơn'}
        </button>
      </>}
    >
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
        Huỷ <strong>{orderLabel}</strong>: các vật tư quay về &quot;Chưa vào đơn đặt hàng&quot;. Số đơn này giữ nguyên, không cấp lại cho đơn khác.
      </div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }} htmlFor="so-cancel-reason">
        Lý do <span style={{ color: 'var(--fg-dc2626)' }}>*</span>
      </label>
      <textarea id="so-cancel-reason" rows={3} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} style={{ ...fieldStyle, resize: 'vertical' }} />
      {err && <div style={errBox}>{err}</div>}
    </ModalShell>
  )
}
