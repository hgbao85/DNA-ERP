import { useEffect, useState } from 'react'
import { Factory, X, Loader2 } from 'lucide-react'
import { changePiWorkshop } from '../services/production-invoices-api'
import { getWorkshops } from '../services/workshops-api'
import type { Workshop, WorkshopRef } from '../types/workshop'
import { errMsg } from '../utils/errors'
import { useIsMobile } from '../hooks/useMediaQuery'
import LenhCodeText from './LenhCodeText'
import { getPendingWorkshopMoves, type PendingWorkshopMove } from '../services/warehouse-transfers-api'
import { buildPendingMovesWarning } from './changeWorkshopRules'

/**
 * Phần A – Đợt 2 (YC12 12.3/12.5), sửa 16/11/2026: KHSX (và Admin) đổi xưởng cơ khí cho CẢ lệnh (mọi SKU) đang chờ QLSX / chờ Sếp /
 * đã duyệt; QLSX không đổi. BE chỉ cho đổi khi lệnh chưa xuất sắt/vật tư (409 kèm lý do - hiện ngay trong hộp) và báo Sếp, KHSX, QLSX.
 * Lý do bắt buộc. Lệnh còn phiếu chuyển hàng chưa nhận thì hiện cảnh báo (không chặn nút Đổi xưởng).
 */
export interface ChangeWorkshopDialogProps {
  pi: { id: string | number; code: string; displayCode?: string; items?: { workshop?: WorkshopRef | null }[] }
  onClose: () => void
  /** Sau khi BE đổi xong (trang tải lại danh sách). */
  onDone: () => void
  /** Lệnh đang chờ QLSX - khung vàng thêm câu "QLSX xưởng mới nhận lệnh để xử lý" (BE phát lại tin chờ QLSX cho xưởng mới). */
  waitingQlsx?: boolean
}

export default function ChangeWorkshopDialog({ pi, onClose, onDone, waitingQlsx = false }: ChangeWorkshopDialogProps) {
  const isMobile = useIsMobile()
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [workshopId, setWorkshopId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWorkshops().then(setWorkshops).catch((e) => setLoadError(errMsg(e, 'Không tải được danh sách xưởng')))
  }, [])

  // Phiếu chuyển hàng chưa nhận của lệnh: chỉ cảnh báo, không chặn đổi xưởng.
  const [pendingMoves, setPendingMoves] = useState<PendingWorkshopMove[]>([])
  const [pendingError, setPendingError] = useState(false)
  useEffect(() => {
    let alive = true
    getPendingWorkshopMoves(String(pi.id))
      .then((r) => { if (alive) setPendingMoves(Array.isArray(r) ? r : []) })
      .catch(() => { if (alive) setPendingError(true) })
    return () => { alive = false }
  }, [pi.id])
  const moveWarning = pendingMoves.length > 0 ? buildPendingMovesWarning(pendingMoves) : null

  const items = pi.items ?? []
  const current = items.find((it) => it.workshop)?.workshop ?? null
  const label = pi.displayCode || pi.code
  const canSave = !!workshopId && workshopId !== current?.id && reason.trim().length > 0 && !saving

  const submit = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await changePiWorkshop(pi.id, workshopId, reason.trim())
      onDone()
    } catch (e) {
      setError(errMsg(e, 'Không đổi được xưởng'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={() => { if (!saving) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="change-workshop-title"
        style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: isMobile ? 16 : 24, width: 440, maxWidth: '100%', maxHeight: '85dvh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 id="change-workshop-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Factory size={16} color="var(--fg-1d4ed8)" /> Đổi xưởng cơ khí
          </h3>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Đóng"
            style={{ padding: 4, background: 'transparent', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
            <X size={18} color="var(--text3)" />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140, background: 'var(--surface2)', borderRadius: 8, padding: '8px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>Lệnh</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}><LenhCodeText code={label} /></div>
          </div>
          <div style={{ flex: 1, minWidth: 140, background: 'var(--surface2)', borderRadius: 8, padding: '8px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>Xưởng hiện tại</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{current?.name ?? 'Chưa có'}</div>
          </div>
        </div>

        <label htmlFor="change-workshop-select" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          Xưởng mới
        </label>
        {loadError ? (
          <div role="alert" style={{ fontSize: 12, color: 'var(--fg-b91c1c)', marginBottom: 12 }}>{loadError}</div>
        ) : (
          <select id="change-workshop-select" value={workshopId} onChange={(e) => { setWorkshopId(e.target.value); setError(null) }} disabled={saving}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', marginBottom: 12 }}>
            <option value="" disabled>Chọn xưởng...</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id} disabled={w.id === current?.id}>
                {w.name}{w.id === current?.id ? ' (đang làm)' : ''}
              </option>
            ))}
          </select>
        )}

        <label htmlFor="change-workshop-reason" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          Lý do (Sếp, KHSX và QLSX sẽ đọc)
        </label>
        <textarea id="change-workshop-reason" value={reason} onChange={(e) => { setReason(e.target.value); setError(null) }} disabled={saving}
          rows={3} maxLength={500} placeholder="Vd: Phú An đang quá tải tuần này"
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', marginBottom: 12 }} />

        <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg-fffbeb)', border: '1px solid var(--fg-fcd34d)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          Đổi cho <b>{items.length > 1 ? `cả ${items.length} SKU` : 'SKU'}</b> của lệnh. Chỉ đổi được khi lệnh <b>chưa xuất sắt / vật tư</b>. Đổi xưởng xong, công nhân Hàn xưởng mới thấy lệnh khi đủ điều kiện làm; xưởng cũ không còn thấy. Tổ Sơn theo nơi sơn của xưởng (lệnh Phước An sơn ở Phú An).
          {waitingQlsx && <div style={{ marginTop: 4 }}>Lệnh đang chờ QLSX: QLSX xưởng mới nhận lệnh để xử lý.</div>}
        </div>

        {moveWarning && (
          <div role="alert" style={{ fontSize: 12.5, color: 'var(--fg-c2410c)', background: 'var(--bg-fff3e0)', border: '1px solid var(--fg-e65100)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{moveWarning.title}</div>
            <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>
              {moveWarning.rows.map((r) => (
                <li key={r.id} style={{ wordBreak: 'break-word' }}><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.code}</span>: {r.route}</li>
              ))}
              {moveWarning.moreText && <li style={{ listStyle: 'none', marginLeft: -18 }}>{moveWarning.moreText}</li>}
            </ul>
            <div>Đổi xưởng tiếp thì thủ kho của kho gửi xử lý từng phiếu theo hàng thật: hàng chưa rời kho → huỷ phiếu; hàng đang trên đường tới xưởng mới → đổi nơi nhận sang kho xưởng mới; hàng đã tới kho nhận → kho nhận nhận hàng rồi lập phiếu chuyển tiếp.</div>
          </div>
        )}
        {!moveWarning && pendingError && (
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 12 }}>Chưa kiểm được phiếu chuyển của lệnh</div>
        )}

        {error && <div role="alert" style={{ fontSize: 12.5, color: 'var(--fg-b91c1c)', background: 'var(--bg-fef2f2)', border: '1px solid var(--fg-fecaca)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={saving}
            style={{ padding: '9px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--text2)' }}>
            Hủy
          </button>
          <button type="button" onClick={() => void submit()} disabled={!canSave}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: canSave ? 'var(--fg-1d4ed8)' : 'var(--bg-e5e7eb)', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed', color: canSave ? '#fff' : 'var(--fg-9ca3af)' }}>
            {saving ? <Loader2 size={14} className="spin" /> : <Factory size={14} />} {saving ? 'Đang đổi...' : 'Đổi xưởng'}
          </button>
        </div>
      </div>
    </div>
  )
}
