'use client'

/**
 * Màn hình KCS — Vật tư thành phẩm KHÔNG gắn piece (MaterialYieldStepBundle, vd chân nhôm,
 * 2026-10-01). KHÁC KcsSatSection (file cùng thư mục, KcsPhoiPage.tsx): không có "cỡ đoạn" để bóc
 * (flat qty/failedQty, mirror QcReviewModal ở KcsPhoiPage.tsx nhưng bỏ bảng theo segment) và không
 * cần nhóm theo PI trước (số lượng bundle của nhóm này nhỏ, 1 bảng phẳng là đủ - khác Sắt có rất
 * nhiều PI/cỡ đoạn cần 2 tầng).
 */

import { useMemo, useState } from 'react'
import { ClipboardCheck, Check, Clock, X, Plus, Upload } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type {
  BeMaterialYieldStepBundle, BeMaterialYieldStepBundleQcReview,
} from '../../../services/material-yield-recipe-production-api'
import type { BeDefectReason } from '../../../services/defect-reasons-api'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import MobileListCards from '../../../components/MobileListCards'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { pageSubtitle } from '../../../styles/typography'

const ACCENT = 'var(--fg-e65100)'
const GREEN = 'var(--fg-16a34a)'
const RED = 'var(--fg-c62828)'
const AMBER = 'var(--fg-d97706)'
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }

export default function KcsChanNhomSection() {
  const { data: bundles, isLoading, error, refetch } = useFetch<BeMaterialYieldStepBundle[]>(
    () => api.getMaterialYieldStepBundles(), [],
  )
  const { data: reviews, refetch: refetchReviews } = useFetch<BeMaterialYieldStepBundleQcReview[]>(
    () => api.getQcReviewsForMaterialYieldStepBundles(), [],
  )
  const [target, setTarget] = useState<BeMaterialYieldStepBundle | null>(null)
  const isMobile = useIsMobile()

  const reviewByBundle = useMemo(() => {
    const m = new Map<string, BeMaterialYieldStepBundleQcReview>()
    for (const r of reviews ?? []) if (r.materialYieldStepBundleId) m.set(r.materialYieldStepBundleId, r)
    return m
  }, [reviews])

  if (isLoading) return <LoadingState />
  if (error || !bundles) return <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />

  const rank = (b: BeMaterialYieldStepBundle) => b.status === 'AWAITING_QC' ? 0 : 1
  const rows = [...bundles].sort((a, b) => {
    const r = rank(a) - rank(b)
    return r !== 0 ? r : b.submittedAt.localeCompare(a.submittedAt)
  })

  const statusBadge = (b: BeMaterialYieldStepBundle, failed: number) => b.status === 'AWAITING_QC' ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ kiểm</span>
  ) : failed > 0 ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
      <Check size={12} color={GREEN} /> <span style={{ color: GREEN }}>đạt</span>
      <span style={{ color: RED, fontWeight: 600 }}>(lỗi {failed})</span>
    </span>
  ) : (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đạt</span>
  )
  const reviewBtn = (b: BeMaterialYieldStepBundle) => (
    <button onClick={() => setTarget(b)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: 'pointer' }}>
      <ClipboardCheck size={13} /> Tiến hành duyệt
    </button>
  )

  return (
    <div>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Kiểm tra chất lượng vật tư thành phẩm không gắn mảnh (vd chân nhôm) theo từng đợt gửi.
      </div>

      {isMobile ? (
        <MobileListCards emptyText="Không có đợt nào" items={rows.map(b => {
          const failed = reviewByBundle.get(b.id)?.failedQty ?? 0
          return {
            key: b.id,
            title: <b>{b.outputMaterialName}</b>,
            badge: statusBadge(b, failed),
            meta: [
              { label: 'PI', value: b.piCode },
              { label: 'Công đoạn', value: PROCESS_STEP_LABELS[b.step] },
              { label: 'Số lượng', value: String(b.qty) },
              { label: 'Gửi KCS lúc', value: new Date(b.submittedAt).toLocaleString('vi-VN') },
            ],
            footer: b.status === 'AWAITING_QC' ? reviewBtn(b) : undefined,
          }
        })} />
      ) : (
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PI</th>
              <th style={th}>Vật tư</th>
              <th style={th}>Công đoạn</th>
              <th style={thR}>Số lượng</th>
              <th style={th}>Gửi KCS lúc</th>
              <th style={{ ...th, textAlign: 'center' }}>Trạng thái</th>
              <th style={{ ...th, width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(b => {
              const failed = reviewByBundle.get(b.id)?.failedQty ?? 0
              return (
                <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text3)' }}>{b.piCode}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{b.outputMaterialName}</td>
                  <td style={td}>{PROCESS_STEP_LABELS[b.step]}</td>
                  <td style={tdR}>{b.qty}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{new Date(b.submittedAt).toLocaleString('vi-VN')}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{statusBadge(b, failed)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{b.status === 'AWAITING_QC' && reviewBtn(b)}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Chưa có đợt nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {target && (
        <QcReviewModal
          bundle={target}
          onClose={() => setTarget(null)}
          onDone={() => { setTarget(null); refetch(); refetchReviews() }}
        />
      )}
    </div>
  )
}

// ── Modal duyệt flat (không có cỡ đoạn) - mirror QcReviewModal ở KcsPhoiPage.tsx, bỏ bảng segment. ─
function QcReviewModal({ bundle, onClose, onDone }: {
  bundle: BeMaterialYieldStepBundle; onClose: () => void; onDone: () => void
}) {
  const { data: reasons, refetch: refetchReasons } = useFetch<BeDefectReason[]>(() => api.getDefectReasons('PHOI'), [])

  const [failedStr, setFailedStr] = useState('')
  const [reasonId, setReasonId] = useState('')
  const [note, setNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const list = reasons ?? []
  const failed = Math.max(0, Math.min(bundle.qty, Math.floor(Number(failedStr) || 0)))
  const passed = bundle.qty - failed

  const addReason = async () => {
    if (!newLabel.trim()) return
    setAdding(true); setErr('')
    try {
      const created = await api.createDefectReason({ label: newLabel.trim(), stageType: 'PHOI' })
      setNewLabel('')
      await refetchReasons()
      setReasonId(String(created.id))
    } catch { setErr('Không thêm được loại lỗi') }
    finally { setAdding(false) }
  }

  const onPickPhoto = async (file?: File) => {
    if (!file) return
    setUploading(true); setErr('')
    try { setPhotoUrl(await api.uploadImage(file)) }
    catch { setErr('Tải ảnh thất bại') }
    finally { setUploading(false) }
  }

  const submit = async () => {
    if (failed > 0 && !reasonId) { setErr('Có số lượng không đạt → phải chọn nguyên nhân'); return }
    setBusy(true); setErr('')
    try {
      await api.reviewMaterialYieldStepQc(bundle.id, {
        failedQty: failed,
        defectReasonId: failed > 0 ? reasonId : undefined,
        reason: note || undefined,
        photoUrl: photoUrl || undefined,
      })
      onDone()
    } catch (e) { setErr(errMsg(e, 'Không duyệt được')) }
    finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 14, padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tiến hành duyệt — {bundle.outputMaterialName}</h3>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{bundle.piCode} · {PROCESS_STEP_LABELS[bundle.step]}</div>
          </div>
          <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 13 }}>Đã gửi: <b>{bundle.qty}</b></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            Không đạt:
            <input type="number" min={0} max={bundle.qty} placeholder="0" value={failedStr} onChange={e => setFailedStr(e.target.value)}
              style={{ width: 70, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
          </label>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Đạt: <b style={{ color: GREEN }}>{passed}</b> · Không đạt: <b style={{ color: failed > 0 ? RED : 'var(--text3)' }}>{failed}</b>
        </div>

        {failed > 0 && <>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', margin: '12px 0 4px', fontWeight: 600 }}>Nguyên nhân không đạt *</label>
          <select value={reasonId} onChange={(e) => setReasonId(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}>
            <option value="">— chọn nguyên nhân —</option>
            {list.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addReason() }}
              placeholder="+ Thêm loại lỗi mới…"
              style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
            <button onClick={addReason} disabled={adding || !newLabel.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
              <Plus size={14} /> Thêm
            </button>
          </div>

          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', margin: '12px 0 4px', fontWeight: 600 }}>Ghi chú</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', resize: 'vertical' }} />

          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', margin: '12px 0 4px', fontWeight: 600 }}>Hình ảnh</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
              <Upload size={14} /> {uploading ? 'Đang tải…' : 'Chọn ảnh'}
              <input type="file" accept="image/*" hidden onChange={(e) => onPickPhoto(e.target.files?.[0])} />
            </label>
            {photoUrl && <img src={photoUrl} alt="lỗi" style={{ height: 40, borderRadius: 4, border: '1px solid var(--border)' }} />}
          </div>
        </>}

        {err && <div style={{ color: RED, fontSize: 13, marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Hủy</button>
          <button onClick={submit} disabled={busy || uploading}
            style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? '...' : 'Xác nhận duyệt'}
          </button>
        </div>
      </div>
    </div>
  )
}
