// Phần A – Đợt 10a (YC5): hộp nhập lý do huỷ booking (bắt buộc). Huỷ xong BE trả lại số đã xếp cho các dòng đơn.
import { useState } from 'react'
import ReasonModal from '../../../../components/ReasonModal'
import { cancelBooking } from '../../../../services/bookings-api'
import type { Booking } from '../../../../types/booking'
import { errText } from './bookingShared'

interface Props {
  booking: Booking | null
  onClose: () => void
  onCancelled: (b: Booking) => void
}

export default function CancelBookingDialog({ booking, onClose, onCancelled }: Props) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => { if (!busy) { setReason(''); setError(null); onClose() } }
  const confirm = async () => {
    if (!booking || busy || !reason.trim()) return
    setBusy(true)
    setError(null)
    try {
      const done = await cancelBooking(booking.id, reason.trim())
      setReason('')
      onCancelled(done)
    } catch (e) {
      setError(errText(e, 'Không huỷ được booking'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ReasonModal
      open={!!booking}
      title={`Huỷ booking ${booking?.bookingNo ?? ''}`}
      description="Số bộ đã xếp trong booking này được trả lại để xếp vào booking khác. Booking đã huỷ không sửa lại được."
      reason={reason}
      onReasonChange={setReason}
      placeholder="Lý do huỷ (bắt buộc)..."
      onCancel={close}
      onConfirm={confirm}
      confirmLabel="Huỷ booking"
      cancelLabel="Không huỷ"
      busy={busy}
      confirmDisabled={!reason.trim()}
      error={error}
    />
  )
}
