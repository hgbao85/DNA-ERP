'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import Modal from '../../../components/Modal'
import DatePicker from '../../../components/DatePicker'
import LoadErrorState from '../../../components/LoadErrorState'
import LoadingState from '../../../components/LoadingState'
import { useFetch } from '../../../hooks/useFetch'
import {
  createWeavingFollowUp,
  getWeavingFollowUps,
  type WeavingBoardRow,
} from '../../../services/weaving-coordination-api'
import { btnSecondary } from '../../../styles/buttons'
import {
  EMPTY_FOLLOW_UP_FORM,
  type FollowUpForm,
  PROMISE_STATUS_LABEL,
  STATUS_META,
  fmtDay,
  followUpPayload,
  lenhLabel,
  validateFollowUpForm,
} from './dieuPhoiDanModel'

const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box',
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/**
 * Đ2 - Ghi chú làm việc của 1 dòng (điểm đan × lệnh × mảnh): form (nội dung bắt buộc, số hẹn + ngày hẹn tuỳ chọn, số hẹn ≤ còn
 * giữ) + lịch sử (dòng này hoặc cả điểm đan). Lời hẹn mới thay lời hẹn cũ còn mở; tới ngày hẹn mà hàng chưa về đủ thì hệ thống nhắc.
 */
export default function FollowUpModal({
  row,
  today,
  canWrite,
  onClose,
  onSaved,
}: {
  row: WeavingBoardRow
  today: string
  canWrite: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [scope, setScope] = useState<'row' | 'point'>('row')
  const [form, setForm] = useState<FollowUpForm>(EMPTY_FOLLOW_UP_FORM)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const history = useFetch(
    () =>
      getWeavingFollowUps(
        scope === 'row'
          ? { weavingPointId: row.weavingPointId, productionOrderId: row.productionOrderId, pieceId: row.pieceId }
          : { weavingPointId: row.weavingPointId },
      ),
    [scope, row.key],
  )
  const meta = STATUS_META[row.status]

  const submit = async () => {
    const err = validateFollowUpForm(form, row.held, today)
    setError(err)
    if (err) return
    setSaving(true)
    try {
      await createWeavingFollowUp(followUpPayload(row, form))
      setForm(EMPTY_FOLLOW_UP_FORM)
      history.refetch()
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được ghi chú')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} maxWidth={640}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{row.weavingPointName}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
            {lenhLabel(row)} · {row.salesOrderCode ?? row.poNumber} · {row.pieceName} ({row.pieceCode})
          </div>
        </div>
        <button onClick={onClose} aria-label="Đóng" style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex' }}>
          <X size={18} color="var(--text3)" />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
        <span>Đã gửi <strong>{row.sent}</strong></span>
        <span>Đã trả <strong style={{ color: 'var(--green)' }}>{row.returned}</strong></span>
        <span>Còn giữ <strong style={{ color: 'var(--fg-e65100)' }}>{row.held}</strong></span>
        <span>Hạn trả <strong>{fmtDay(row.dueDate)}</strong></span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: meta.bg, color: meta.color }}>{meta.label}</span>
      </div>

      {canWrite && (
        <div style={{ marginBottom: 18 }}>
          <label style={label} htmlFor="dpd-content">Nội dung trao đổi *</label>
          <textarea
            id="dpd-content"
            rows={3}
            value={form.content}
            maxLength={2000}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Vd: Gọi chị Lan, đang đan dở 6 mảnh, hẹn thứ 6 giao"
            style={{ ...input, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, alignItems: 'flex-end' }}>
            <div style={{ width: 150 }}>
              <label style={label} htmlFor="dpd-qty">Số mảnh hẹn trả</label>
              <input
                id="dpd-qty"
                type="number"
                min={1}
                max={row.held}
                inputMode="numeric"
                value={form.promisedQty}
                onChange={(e) => setForm({ ...form, promisedQty: e.target.value })}
                placeholder={row.held > 0 ? `≤ ${row.held}` : 'đã trả đủ'}
                disabled={row.held <= 0}
                style={input}
              />
            </div>
            <div style={{ width: 170 }}>
              <span style={label}>Ngày hẹn trả</span>
              <DatePicker value={form.promisedDate} onChange={(v) => setForm({ ...form, promisedDate: v })} clearable />
            </div>
            <button
              onClick={() => void submit()}
              disabled={saving}
              style={{ padding: '9px 18px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Đang lưu...' : 'Lưu ghi chú'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            Hẹn trả không bắt buộc. Có hẹn thì hệ thống nhắc bạn khi tới ngày hẹn mà hàng về chưa đủ; lời hẹn mới thay lời hẹn cũ.
          </div>
          {error && <div role="alert" style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</div>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Lịch sử ghi chú</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['row', 'point'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 20, cursor: 'pointer', border: scope === s ? 'none' : '1px solid var(--border)', background: scope === s ? 'var(--bg-1f2937)' : 'var(--surface)', color: scope === s ? '#fff' : 'var(--text2)' }}
            >
              {s === 'row' ? 'Dòng này' : 'Cả điểm đan'}
            </button>
          ))}
        </div>
      </div>
      {history.isLoading ? <LoadingState /> : history.error || !history.data ? (
        <LoadErrorState error={history.error ?? 'Không rõ nguyên nhân'} onRetry={history.refetch} />
      ) : history.data.items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>Chưa có ghi chú nào.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {history.data.items.map((f) => (
            <div key={f.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: 'var(--text3)' }}>
                <span>{fmtTime(f.createdAt)} · {f.createdByName}</span>
                {scope === 'point' && <span>{f.poNumber} · {f.pieceName}</span>}
              </div>
              <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{f.content}</div>
              {f.promisedQty != null && (
                <div style={{ fontSize: 12, marginTop: 4, color: f.promiseStatus === 'REMINDED' ? 'var(--red)' : f.promiseStatus === 'KEPT' ? 'var(--green)' : 'var(--text2)' }}>
                  Hẹn {f.promisedQty} mảnh · {fmtDay(f.promisedDate)} · {PROMISE_STATUS_LABEL[f.promiseStatus]} (lúc hẹn đang giữ {f.heldAtCreate})
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} style={btnSecondary}>Đóng</button>
      </div>
    </Modal>
  )
}
