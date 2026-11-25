'use client'
// Huỷ lệnh theo SKU - đợt 1 (23/11/2026, anh Nhân trả lời 7 câu): ở dòng SKU của màn Lệnh SX - KHSX bấm "Đề nghị huỷ" kèm lý do (Sếp
// duyệt mới huỷ), rút lại khi Sếp chưa quyết; dòng đã huỷ hiện nhãn "Đã huỷ". BE kiểm hết (đã giao hàng, đề nghị trùng...).
import { useState } from 'react'
import { Ban, Clock } from 'lucide-react'
import ConfirmModal from '../../../components/ConfirmModal'
import ReasonModal from '../../../components/ReasonModal'
import { requestOrderCancel, withdrawOrderCancel } from '../../../services/order-cancellations-api'
import { errMsg } from '../../../utils/errors'

interface CancelItem {
  productionOrderId?: string | null
  /** Câu 1 (24/11): lệnh đã Kết thúc thì không đề nghị huỷ được. */
  floorStage?: string | null
  cancelledAt?: string | null
  pendingCancelRequest?: { id: string; reason: string; requestedAt: string } | null
}

const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }

export default function OrderCancelControls({
  item,
  label,
  canRequest,
  onChanged,
}: {
  item: CancelItem
  /** Mã SKU / số lệnh để hiện trong hộp xác nhận. */
  label: string
  /** KHSX / Admin - người khác chỉ thấy nhãn. */
  canRequest: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState<'request' | 'withdraw' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (item.cancelledAt) {
    return <span style={{ ...chip, color: 'var(--fg-b91c1c)', background: 'var(--bg-fee2e2)' }}><Ban size={10} /> Đã huỷ</span>
  }
  const pending = item.pendingCancelRequest
  if (!pending && (!canRequest || !item.productionOrderId || item.floorStage === 'FINISHED')) return null

  const close = () => { setOpen(null); setReason(''); setError(null) }
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      close()
      onChanged()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {pending ? (
        <span title={`Lý do: ${pending.reason}`} style={{ ...chip, color: 'var(--fg-b91c1c)', background: 'var(--bg-fee2e2)' }}>
          <Clock size={10} /> Chờ Sếp duyệt huỷ
          {canRequest && (
            <button
              onClick={() => { setError(null); setOpen('withdraw') }}
              style={{ marginLeft: 4, padding: 0, border: 'none', background: 'none', color: 'inherit', textDecoration: 'underline', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >Rút lại</button>
          )}
        </span>
      ) : (
        <button
          onClick={() => { setError(null); setReason(''); setOpen('request') }}
          style={{ ...chip, fontWeight: 600, color: 'var(--fg-b91c1c)', background: 'var(--surface)', border: '1px solid var(--fg-fecaca)', cursor: 'pointer' }}
        ><Ban size={10} /> Đề nghị huỷ</button>
      )}

      <ReasonModal
        open={open === 'request'}
        title="Đề nghị huỷ SKU"
        description={`Huỷ ${label}. Sếp duyệt mới huỷ; huỷ rồi xưởng dừng làm SKU này, SKU về "chưa lên lệnh" để lên lệnh lại. Đã giao hàng thì không huỷ được.`}
        reason={reason}
        onReasonChange={setReason}
        placeholder="Lý do huỷ (bắt buộc)"
        confirmLabel="Gửi đề nghị"
        busy={busy}
        confirmDisabled={reason.trim().length === 0}
        error={error}
        onConfirm={() => item.productionOrderId && void run(() => requestOrderCancel(item.productionOrderId!, reason.trim()))}
        onCancel={close}
      />
      <ConfirmModal
        open={open === 'withdraw'}
        title="Rút lại đề nghị huỷ"
        message={`Rút lại đề nghị huỷ ${label}? Lệnh chạy tiếp như cũ.`}
        confirmLabel="Rút lại"
        busy={busy}
        error={error}
        onConfirm={() => pending && void run(() => withdrawOrderCancel(pending.id))}
        onCancel={close}
      />
    </>
  )
}
