'use client'

/**
 * Màn hình KCS — Vật tư thành phẩm KHÔNG gắn piece (MaterialYieldStepBundle, vd chân nhôm,
 * 2026-10-01). KHÁC KcsSatSection (file cùng thư mục, KcsPhoiPage.tsx): không có "cỡ đoạn" để bóc
 * (flat qty/failedQty, mirror QcReviewModal ở KcsPhoiPage.tsx nhưng bỏ bảng theo segment) và không
 * cần nhóm theo PI trước (số lượng bundle của nhóm này nhỏ, 1 bảng phẳng là đủ - khác Sắt có rất
 * nhiều PI/cỡ đoạn cần 2 tầng).
 *
 * P1 (18/11/2026): nhóm ĐANG MỞ (tài khoản thống kê đã Lưu, chưa Gửi KCS) lấy từ GET /floor/review (materialYieldGroups); bấm
 * "Chấm" thì chốt nhóm (POST /floor/kcs/material-yield-groups/close) rồi mở hộp chấm giữ đúng đợt vừa chốt. Nhóm đã chốt lấy từ
 * danh sách đợt có sẵn. Dòng của lệnh dừng (đợt mở: blockedReason; đợt đã chốt: stoppedPis) xám + khoá Chấm.
 * Hộp chấm: Đã báo / Thực có (≤ Đã báo) / Không đạt; thiếu ghi riêng. Pat / chân nhôm không phát 'floor' nên màn nghe thêm
 * 'production-batches'.
 */

import { focusAttr } from '../../../utils/notificationLink'
import { useMemo, useState } from 'react'
import { ClipboardCheck, Check, Clock, X, Plus, Upload, AlertTriangle } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { closeMaterialYieldGroup, getKcsFloorReview, isKcsFloorForbidden } from '../../../services/kcs-floor-api'
import type {
  BeMaterialYieldStepBundle, BeMaterialYieldStepBundleQcReview,
} from '../../../services/material-yield-recipe-production-api'
import type { BeDefectReason } from '../../../services/defect-reasons-api'
import type { ProcessStep } from '../../../types/sku'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import MobileListCards from '../../../components/MobileListCards'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { pageSubtitle } from '../../../styles/typography'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import LenhCode from '../../../components/LenhCode'
import {
  MSG_ACTUAL_CLAMPED, MSG_FORBIDDEN, buildFlatPayload, calcRow, clampActual, isPiStopped, pickRowState, sumRows, totalsText,
} from './kcsReviewModel'

const ACCENT = 'var(--fg-e65100)'
const GREEN = 'var(--fg-16a34a)'
const RED = 'var(--fg-c62828)'
const AMBER = 'var(--fg-d97706)'
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }

const REALTIME_TOPICS = ['qc-reviews', 'production-batches', 'production-orders', 'floor']

/** 1 dòng của màn: nhóm đang mở (chưa chốt) HOẶC đợt đã chốt / đã chấm. */
interface ChanRow {
  key: string
  open: boolean
  status: 'OPEN' | 'AWAITING_QC' | 'QC_PASSED'
  productionInvoiceId: string
  recipeId: string
  piCode: string
  materialName: string
  step: ProcessStep
  qty: number
  /** "Báo lúc" (mở) / "Chốt lúc" (đã chốt, đã chấm). */
  timeLabel: string
  at: string
  blockedMessage: string | null
  bundleId: string | null
}

export default function KcsChanNhomSection() {
  const { data: bundles, isLoading, error, refetch } = useFetch<BeMaterialYieldStepBundle[]>(
    () => api.getMaterialYieldStepBundles(), [],
  )
  const { data: reviews, refetch: refetchReviews } = useFetch<BeMaterialYieldStepBundleQcReview[]>(
    () => api.getQcReviewsForMaterialYieldStepBundles(), [],
  )
  // P1: nhóm ĐANG MỞ + stoppedPis. 403 trả { forbidden } (không ném, không console.error).
  const { data: floorReview, error: floorReviewError, refetch: refetchFloorReview } = useFetch(() => getKcsFloorReview('PHOI'), [])
  const refetchAll = () => { void refetch(); void refetchReviews(); void refetchFloorReview() }
  useRealtimeRefetch(REALTIME_TOPICS, refetchAll, { debounceMs: 3000 })

  // Hộp chấm giữ ĐÚNG đợt vừa chốt (id + Đã báo do lệnh chốt trả về), không đọc lại dòng trong danh sách đang tự tải lại.
  const [target, setTarget] = useState<{ row: ChanRow; bundleId: string; reportedQty: number } | null>(null)
  const [closingKey, setClosingKey] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState('')
  const isMobile = useIsMobile()

  const forbidden = floorReview != null && isKcsFloorForbidden(floorReview)
  const review = floorReview != null && !isKcsFloorForbidden(floorReview) ? floorReview : null

  const reviewByBundle = useMemo(() => {
    const m = new Map<string, BeMaterialYieldStepBundleQcReview>()
    for (const r of reviews ?? []) if (r.materialYieldStepBundleId) m.set(r.materialYieldStepBundleId, r)
    return m
  }, [reviews])

  const rows = useMemo<ChanRow[]>(() => {
    const out: ChanRow[] = []
    for (const g of review?.materialYieldGroups ?? []) {
      out.push({
        key: `open:${g.productionInvoiceId}:${g.recipeId}:${g.step}`, open: true, status: 'OPEN',
        productionInvoiceId: g.productionInvoiceId, recipeId: g.recipeId, piCode: g.pi?.code ?? '—',
        materialName: g.material.name, step: g.step as ProcessStep, qty: g.qty,
        timeLabel: 'Báo lúc', at: g.waitingSince,
        blockedMessage: pickRowState({ phase: 'OPEN', blockedReason: g.blockedReason }).message,
        bundleId: null,
      })
    }
    for (const b of bundles ?? []) {
      const awaiting = b.status === 'AWAITING_QC'
      out.push({
        key: `bundle:${b.id}`, open: false, status: b.status,
        productionInvoiceId: b.productionInvoiceId, recipeId: b.recipeId, piCode: b.piCode,
        materialName: b.outputMaterialName, step: b.step, qty: b.qty,
        timeLabel: 'Chốt lúc', at: b.submittedAt,
        // Đợt đã chốt xám theo stoppedPis (so theo id PI, sau đó theo mã PI).
        blockedMessage: awaiting
          ? pickRowState({ phase: 'AWAITING_QC', piStopped: isPiStopped(review?.stoppedPis, { productionInvoiceId: b.productionInvoiceId, code: b.piCode }) }).message
          : null,
        bundleId: b.id,
      })
    }
    const rank = (r: ChanRow) => r.status === 'QC_PASSED' ? 1 : 0
    return out.sort((a, b) => {
      const d = rank(a) - rank(b)
      return d !== 0 ? d : b.at.localeCompare(a.at)
    })
  }, [review, bundles])

  if (isLoading) return <LoadingState />
  if (error || !bundles) return <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />

  // Bấm "Chấm": nhóm đang mở thì chốt trước (lỗi 409 / 400 -> hiện đúng câu BE, tải lại danh sách, KHÔNG mở hộp).
  const startReview = async (r: ChanRow) => {
    if (r.blockedMessage || closingKey !== null) return
    setActionErr('')
    if (!r.open && r.bundleId) { setTarget({ row: r, bundleId: r.bundleId, reportedQty: r.qty }); return }
    setClosingKey(r.key)
    try {
      const b = await closeMaterialYieldGroup({ productionInvoiceId: r.productionInvoiceId, recipeId: r.recipeId, step: r.step })
      setTarget({ row: r, bundleId: b.id, reportedQty: b.qty })
      refetchAll()
    } catch (e) {
      setActionErr(errMsg(e, 'Không chốt được để chấm - tải lại trang'))
      refetchAll()
    } finally { setClosingKey(null) }
  }

  const statusBadge = (r: ChanRow) => {
    if (r.status !== 'QC_PASSED') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> {r.open ? 'đang mở' : 'đã chốt'}</span>
    }
    const rv = r.bundleId ? reviewByBundle.get(r.bundleId) : undefined
    const failed = rv?.failedQty ?? 0
    const short = rv?.shortQty ?? 0
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 12, fontWeight: 700 }}>
        <Check size={12} color={GREEN} /> <span style={{ color: GREEN }}>đạt</span>
        {failed > 0 && <span style={{ color: RED, fontWeight: 600 }}>(lỗi {failed})</span>}
        {short > 0 && <span style={{ color: 'var(--text3)', fontWeight: 600 }}>(thiếu {short})</span>}
      </span>
    )
  }
  const reviewBtn = (r: ChanRow) => {
    const locked = !!r.blockedMessage
    return (
      <button onClick={() => startReview(r)} disabled={locked || closingKey !== null} title={r.blockedMessage ?? undefined}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.5 : 1 }}>
        <ClipboardCheck size={13} /> {closingKey === r.key ? 'Đang chốt…' : 'Chấm'}
      </button>
    )
  }
  const blockedLine = (r: ChanRow) => r.blockedMessage
    ? <div style={{ fontSize: 11, color: RED, marginTop: 2 }}>{r.blockedMessage}</div>
    : null
  const timeText = (r: ChanRow) => `${r.timeLabel} ${new Date(r.at).toLocaleString('vi-VN')}`

  const notice = forbidden ? MSG_FORBIDDEN : floorReviewError ? `Không tải được các đợt đang mở - ${floorReviewError}` : ''

  return (
    <div>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Kiểm tra chất lượng vật tư thành phẩm không gắn mảnh (vd chân nhôm) theo từng đợt - bấm Chấm để chốt và chấm.
      </div>

      {notice && (
        <div role="status" style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius)', background: 'var(--surface2)', color: AMBER, fontSize: 13, wordBreak: 'break-word' }}>{notice}</div>
      )}
      {actionErr && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} /> <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{actionErr}</span>
        </div>
      )}

      {isMobile ? (
        <MobileListCards emptyText="Không có đợt nào" items={rows.map(r => ({
          key: r.key,
          title: <span style={{ opacity: r.blockedMessage ? 0.55 : 1 }}><b>{r.materialName}</b>{blockedLine(r)}</span>,
          badge: statusBadge(r),
          meta: [
            { label: 'Lệnh', value: <LenhCode piCode={r.piCode} /> },
            { label: 'Công đoạn', value: PROCESS_STEP_LABELS[r.step] },
            { label: 'Số lượng', value: String(r.qty) },
            { label: r.timeLabel, value: new Date(r.at).toLocaleString('vi-VN') },
          ],
          footer: r.status !== 'QC_PASSED' ? reviewBtn(r) : undefined,
        }))} />
      ) : (
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Lệnh</th>
              <th style={th}>Vật tư</th>
              <th style={th}>Công đoạn</th>
              <th style={thR}>Đã báo</th>
              <th style={th}>Thời điểm</th>
              <th style={{ ...th, textAlign: 'center' }}>Trạng thái</th>
              <th style={{ ...th, width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} {...(r.bundleId ? focusAttr('MATERIAL_YIELD_STEP_BUNDLE', r.bundleId) : {})}
                style={{ borderTop: '1px solid var(--border)', opacity: r.blockedMessage ? 0.55 : 1 }}>
                <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text3)' }}><LenhCode piCode={r.piCode} /></td>
                <td style={{ ...td, fontWeight: 600 }}>{r.materialName}{blockedLine(r)}</td>
                <td style={td}>{PROCESS_STEP_LABELS[r.step]}</td>
                <td style={tdR}>{r.qty}</td>
                <td style={{ ...td, color: 'var(--text3)' }}>{timeText(r)}</td>
                <td style={{ ...td, textAlign: 'center' }}>{statusBadge(r)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.status !== 'QC_PASSED' && reviewBtn(r)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Chưa có đợt nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {target && (
        <QcReviewModal
          row={target.row} bundleId={target.bundleId} reportedQty={target.reportedQty}
          onClose={() => setTarget(null)}
          onDone={() => { setTarget(null); refetchAll() }}
        />
      )}
    </div>
  )
}

// ── Modal chấm flat (không có cỡ đoạn) - mirror QcReviewModal ở KcsPhoiPage.tsx, bỏ bảng segment. ─
function QcReviewModal({ row, bundleId, reportedQty, onClose, onDone }: {
  row: ChanRow; bundleId: string; reportedQty: number; onClose: () => void; onDone: () => void
}) {
  const { data: reasons, refetch: refetchReasons } = useFetch<BeDefectReason[]>(() => api.getDefectReasons('PHOI'), [])

  const [actual, setActual] = useState('')
  const [clamped, setClamped] = useState(false)
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
  // Không kẹp im lặng: số sai thì báo đỏ + khoá nút. Thực có > Đã báo thì tự về Đã báo kèm câu nhắc (S2).
  const calc = calcRow('FLAT', { reported: reportedQty, actual, failed: failedStr })
  const failed = calc.failed
  const quaSo = calc.error !== null

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
    if (quaSo) return
    if (failed > 0 && !reasonId) { setErr('Có số lượng không đạt → phải chọn nguyên nhân'); return }
    setBusy(true); setErr('')
    try {
      await api.reviewMaterialYieldStepQc(bundleId, {
        ...buildFlatPayload(calc),
        defectReasonId: failed > 0 ? reasonId : undefined,
        reason: note || undefined,
        photoUrl: photoUrl || undefined,
      })
      onDone()
    } catch (e) { setErr(errMsg(e, 'Không duyệt được')) }
    finally { setBusy(false) }
  }

  const numInp: React.CSSProperties = { width: 90, padding: '7px 9px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
  const fieldLbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4, fontWeight: 600 }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 14, padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, wordBreak: 'break-word' }}>Chấm — {row.materialName}</h3>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}><LenhCode piCode={row.piCode} /> · {PROCESS_STEP_LABELS[row.step]}</div>
          </div>
          <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '10px 16px', marginBottom: 6 }}>
          <div>
            <div style={fieldLbl}>Đã báo</div>
            <div style={{ fontSize: 15, fontWeight: 700, padding: '7px 0' }}>{reportedQty}</div>
          </div>
          <div>
            <label style={fieldLbl}>Thực có</label>
            <input type="number" min={0} max={reportedQty} inputMode="numeric" placeholder={String(reportedQty)} value={actual}
              onChange={e => { const c = clampActual(e.target.value, reportedQty); setActual(c.value); setClamped(c.clamped) }}
              style={numInp} />
          </div>
          <div>
            <label style={fieldLbl}>Không đạt</label>
            <input type="number" min={0} max={reportedQty} inputMode="numeric" placeholder="0" value={failedStr} onChange={e => setFailedStr(e.target.value)}
              style={{ ...numInp, borderColor: quaSo ? RED : 'var(--border)', color: quaSo ? RED : 'var(--text)' }} />
          </div>
        </div>
        {clamped && <div style={{ fontSize: 12, color: AMBER, marginBottom: 6 }}>{MSG_ACTUAL_CLAMPED}</div>}
        {quaSo && <div style={{ fontSize: 12, color: RED, marginBottom: 6 }}>{calc.error}</div>}

        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          {totalsText('FLAT', sumRows([calc]))}
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
              style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
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
          <button onClick={submit} disabled={busy || uploading || quaSo}
            style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy || quaSo ? 'not-allowed' : 'pointer', opacity: quaSo ? 0.5 : 1 }}>
            {busy ? '...' : 'Xác nhận chấm'}
          </button>
        </div>
      </div>
    </div>
  )
}
