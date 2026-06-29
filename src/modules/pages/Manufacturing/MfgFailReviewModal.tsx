import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { X, Plus, Upload, AlertTriangle } from 'lucide-react'

interface DefectReason { id: number; label: string; stageType?: string | null }

export interface FailPayload {
  status: 'FAILED'
  defectReasonId: number
  reviewNote?: string
  defectPhotoUrl?: string
  [key: string]: unknown
}

interface Props {
  stageType: string // PHOI | HAN | SON — lọc danh mục lỗi theo công đoạn
  title?: string
  onClose: () => void
  onSubmit: (payload: FailPayload) => Promise<void> | void
}

/** Modal QC nhập NGUYÊN NHÂN KHÔNG ĐẠT: chọn loại lỗi (lọc theo công đoạn) + ghi chú + ảnh. */
export default function MfgFailReviewModal({ stageType, title, onClose, onSubmit }: Props) {
  const { data: reasons, refetch } = useFetch<DefectReason[]>(() => api.getDefectReasons(stageType), [stageType])
  const list = Array.isArray(reasons) ? reasons : []

  const [reasonId, setReasonId] = useState<number | ''>('')
  const [reviewNote, setReviewNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const addReason = async () => {
    if (!newLabel.trim()) return
    setAdding(true); setErr('')
    try {
      const created = await api.createDefectReason({ label: newLabel.trim(), stageType }) as DefectReason
      setNewLabel('')
      await refetch()
      setReasonId(created.id)
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Không thêm được loại lỗi')
    } finally { setAdding(false) }
  }

  const onPickPhoto = async (file?: File) => {
    if (!file) return
    setUploading(true); setErr('')
    try { setPhotoUrl(await api.uploadContractFile(file)) }
    catch { setErr('Tải ảnh thất bại') }
    finally { setUploading(false) }
  }

  const submit = async () => {
    if (!reasonId) { setErr('Phải chọn nguyên nhân không đạt'); return }
    setBusy(true); setErr('')
    try {
      await onSubmit({ status: 'FAILED', defectReasonId: Number(reasonId), reviewNote: reviewNote || undefined, defectPhotoUrl: photoUrl || undefined })
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Lỗi duyệt')
      setBusy(false)
    }
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: '#c62828' }}>
            <AlertTriangle size={17} /> {title ?? 'Không đạt — nhập nguyên nhân'}
          </h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        <label style={lbl}>Nguyên nhân không đạt *</label>
        <select value={reasonId} onChange={e => setReasonId(e.target.value ? Number(e.target.value) : '')} style={inp} autoFocus>
          <option value="">— chọn nguyên nhân —</option>
          {list.map(r => <option key={r.id} value={r.id}>{r.label}{r.stageType ? '' : ' (chung)'}</option>)}
        </select>
        {list.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Chưa có loại lỗi nào — thêm bên dưới.</div>}

        {/* Inline thêm loại lỗi mới (QC tự nhập) */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addReason() }}
            placeholder="+ Thêm loại lỗi mới…" style={{ ...inp, marginTop: 0, flex: 1 }} />
          <button onClick={addReason} disabled={adding || !newLabel.trim()} style={btnGhost}><Plus size={14} /> Thêm</button>
        </div>

        <label style={lbl}>Ghi chú chi tiết</label>
        <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2}
          placeholder="Mô tả thêm để thợ biết cách khắc phục…" style={{ ...inp, resize: 'vertical' }} />

        <label style={lbl}>Ảnh lỗi (tuỳ chọn)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ ...btnGhost, cursor: 'pointer' }}>
            <Upload size={14} /> {uploading ? 'Đang tải…' : 'Chọn ảnh'}
            <input type="file" accept="image/*" hidden onChange={e => onPickPhoto(e.target.files?.[0])} />
          </label>
          {photoUrl && <img src={photoUrl} alt="lỗi" style={{ height: 40, borderRadius: 4, border: '1px solid var(--border)' }} />}
        </div>

        {err && <div style={{ color: '#c62828', fontSize: 13, marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnGhost}>Hủy</button>
          <button onClick={submit} disabled={busy || uploading || !reasonId} style={btnFail}>{busy ? '…' : 'Xác nhận không đạt'}</button>
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }
const card: React.CSSProperties = { width: 440, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.25)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text2)', margin: '12px 0 4px', fontWeight: 600 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
const iconBtn: React.CSSProperties = { padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }
const btnFail: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)', background: '#c62828', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
