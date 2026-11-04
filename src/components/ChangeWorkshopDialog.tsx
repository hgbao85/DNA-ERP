import { useEffect, useState } from 'react'
import { Factory, X, Loader2 } from 'lucide-react'
import { changePiWorkshop } from '../services/production-invoices-api'
import { getWorkshops } from '../services/workshops-api'
import type { Workshop, WorkshopRef } from '../types/workshop'
import { errMsg } from '../utils/errors'
import { useIsMobile } from '../hooks/useMediaQuery'
import LenhCodeText from './LenhCodeText'

/**
 * Phần A – Đợt 2 (YC12 12.3/12.5): QLSX đổi xưởng cơ khí cho CẢ lệnh (mọi SKU) đã gửi Sếp / đã duyệt. BE chỉ cho đổi khi lệnh
 * chưa xuất sắt/vật tư (409 kèm lý do - hiện ngay trong hộp) và báo Sếp + KHSX. Lý do bắt buộc (Sếp đọc trong thông báo).
 */
export interface ChangeWorkshopDialogProps {
  pi: { id: string | number; code: string; displayCode?: string; items?: { workshop?: WorkshopRef | null }[] }
  onClose: () => void
  /** Sau khi BE đổi xong (trang tải lại danh sách). */
  onDone: () => void
}

export default function ChangeWorkshopDialog({ pi, onClose, onDone }: ChangeWorkshopDialogProps) {
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
            {label !== pi.code && <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text3)' }}>{pi.code}</div>}
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
          Lý do (Sếp và KHSX sẽ đọc)
        </label>
        <textarea id="change-workshop-reason" value={reason} onChange={(e) => { setReason(e.target.value); setError(null) }} disabled={saving}
          rows={3} maxLength={500} placeholder="Vd: Phú An đang quá tải tuần này"
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', marginBottom: 12 }} />

        <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg-fffbeb)', border: '1px solid var(--fg-fcd34d)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          Đổi cho <b>{items.length > 1 ? `cả ${items.length} SKU` : 'SKU'}</b> của lệnh. Chỉ đổi được khi lệnh <b>chưa xuất sắt</b>. Sếp và KHSX sẽ nhận thông báo.
        </div>

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
