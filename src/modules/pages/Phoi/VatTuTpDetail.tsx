'use client'

/**
 * Chi tiết 1 mảnh Vật tư thành phẩm (PieceMaterialYield, vd Pat/chân nhôm) trong 1 lệnh sản xuất -
 * gộp vào màn "Lệnh sản xuất — Công đoạn Phôi" (2026-09-04), trước đây là tab sidebar riêng
 * "Vật tư thành phẩm" (LenhSanXuatVatTuThanhPham.tsx, đã xoá - dùng TwoTierScreen/ProductionBatch,
 * không phân biệt công đoạn, tách biệt hoàn toàn khỏi tab Sắt).
 *
 * 2 chế độ tuỳ `item.processSteps` (PieceMaterialYield.processSteps, thêm 2026-09-04):
 * - RỖNG (mảnh chưa khai công đoạn phôi, đa số hiện nay): giữ NGUYÊN luồng cũ - chỉ 1 ô nhập số
 *   mảnh + nút "Ghi nhận" gọi thẳng reportProductionBatch() (tương thích ngược tuyệt đối, y hệt
 *   trải nghiệm cũ ở TwoTierScreen/VatTuDetailBoard).
 * - CÓ khai: dải tab theo từng bước (Cắt/Uốn/...) + panel "Cần/Đã.../Còn lại" (mirror
 *   StepBatchPanel bên Sắt ở LenhSanXuatPhoi.tsx, nhưng 1 dòng vì không có "cỡ đoạn" để bóc -
 *   PieceMaterialYield chỉ ứng đúng 1 material/piece), cộng 1 tab "Chốt & gửi KCS" cuối cùng để
 *   tạo ProductionBatch thật (nguồn KCS duyệt + chuyển kho). KHÔNG chặn chốt khi chưa báo đủ bước
 *   (quyết định nghiệp vụ 2026-09-04, cùng triết lý "không chặn oan công nhân, KCS mới là bước
 *   kiểm soát" đã lặp lại nhiều lần ở BE) - chỉ CẢNH BÁO.
 */

import { useState } from 'react'
import { ChevronLeft, Check, Clock, Plus, Send } from 'lucide-react'
import * as api from '../../../services/api'
import { useFetch } from '../../../hooks/useFetch'
import type { ProcessStep } from '../../../types/sku'
import type { BePieceStepProgress } from '../../../services/production-batches-api'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { errMsg } from '../../../utils/errors'
import {
  ACCENT, GREEN, RED, AMBER, th, thR, td, tdR, card, smallBtn, inp, subFilterBtn,
} from './phoiStyles'

export interface VatTuTpItem {
  orderId: string
  /** salesOrderCode (hiển thị) - cần để phân biệt khi 2 SKU khác nhau trong cùng PI dùng chung 1
   *  tên mảnh (vd cùng "Pat"), vì vật tư thành phẩm gắn theo TỪNG SKU, khác Sắt gộp cả PI. */
  poNumber: string
  productName: string
  pieceId: string
  pieceCode: string
  pieceName: string
  plannedQty: number
  awaitingQcQty: number
  passedQty: number
  rawMaterialOnHand: number | null
  /** Đã chuẩn hoá thứ tự nghiệp vụ ở BE - rỗng = mảnh chưa khai công đoạn, giữ nguyên luồng cũ. */
  processSteps: ProcessStep[]
  stepProgress: BePieceStepProgress[]
  qtyPerPiece: number | null
}

export default function VatTuTpDetail({ item, readOnly, onBack, onRefetch }: {
  item: VatTuTpItem; readOnly: boolean; onBack: () => void; onRefetch: () => void
}) {
  const [subFilter, setSubFilter] = useState<string>(item.processSteps.length > 0 ? item.processSteps[0] : 'chot')

  const miengSuffix = item.qtyPerPiece != null && item.qtyPerPiece > 1 ? ` (= ${item.plannedQty * item.qtyPerPiece} miếng)` : ''

  const stepItems = item.processSteps.map(step => {
    const p = item.stepProgress.find(sp => sp.step === step)
      ?? { step, requiredQty: item.plannedQty, doneQty: 0, submittedQty: 0, passedQty: 0 }
    return { key: step as string, label: PROCESS_STEP_LABELS[step], done: p.doneQty >= p.requiredQty, progress: p }
  })
  const chotDone = item.passedQty + item.awaitingQcQty >= item.plannedQty
  const tabItems = [
    ...stepItems,
    { key: 'chot', label: 'Chốt & gửi KCS', done: chotDone },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{item.pieceName}</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {item.poNumber} · Cần {item.plannedQty} mảnh{miengSuffix}
            {item.rawMaterialOnHand != null && (
              <span style={{ marginLeft: 8 }}>· tồn nguyên liệu thô: {item.rawMaterialOnHand.toLocaleString('vi-VN')}</span>
            )}
          </div>
        </div>
      </div>

      {item.processSteps.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {tabItems.map(it => (
            <button key={it.key} onClick={() => setSubFilter(it.key)} style={subFilterBtn(subFilter === it.key)}>
              {it.done && <Check size={12} style={{ marginRight: 4, verticalAlign: -1 }} />}
              {it.label}
            </button>
          ))}
        </div>
      )}

      {subFilter === 'chot' || item.processSteps.length === 0 ? (
        <ChotPanel item={item} readOnly={readOnly} onRefetch={onRefetch} />
      ) : (
        <StepPanel
          item={item} step={subFilter as ProcessStep}
          progress={stepItems.find(s => s.key === subFilter)?.progress ?? null}
          readOnly={readOnly} onRefetch={onRefetch}
        />
      )}
    </div>
  )
}

// ── Panel 1 bước (Cắt/Uốn/...) - mirror StepBatchPanel bên Sắt (LenhSanXuatPhoi.tsx) nhưng 1 dòng
// thay vì bảng theo cỡ đoạn (PieceMaterialYield không có SegmentSpec để bóc theo cỡ). Từ 2026-09-07
// mỗi công đoạn tự gửi KCS riêng (nút "Gửi KCS", KHÔNG chờ công đoạn khác) - xem PieceStepBundle
// doc comment BE tại sao KHÔNG ràng buộc thứ tự nữa. ──────────────────────────────────────────
function StepPanel({ item, step, progress, readOnly, onRefetch }: {
  item: VatTuTpItem; step: ProcessStep; progress: BePieceStepProgress | null
  readOnly: boolean; onRefetch: () => void
}) {
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const stepLabel = PROCESS_STEP_LABELS[step]
  const required = progress?.requiredQty ?? item.plannedQty
  const done = progress?.doneQty ?? 0
  const submitted = progress?.submittedQty ?? 0
  const passed = progress?.passedQty ?? 0
  const remaining = Math.max(required - done, 0)
  // Chưa gửi KCS = đã báo (doneQty) nhưng chưa gom vào bundle nào (submittedQty).
  const readyToSend = Math.max(done - submitted, 0)
  const awaitingQc = Math.max(submitted - passed, 0)

  const submit = async () => {
    const q = Math.floor(Number(qty) || 0)
    if (q <= 0) { setErr(`Nhập số mảnh đã ${stepLabel.toLowerCase()}`); return }
    setBusy(true); setErr('')
    try {
      await api.recordPieceStepBatch(item.orderId, { stage: 'PHOI', pieceId: item.pieceId, step, qty: q })
      setQty(''); onRefetch()
    } catch (e) { setErr(errMsg(e, 'Không lưu được đợt - kiểm lại số liệu')) }
    finally { setBusy(false) }
  }

  const sendToKcs = async () => {
    setSendBusy(true); setSendErr('')
    try {
      await api.submitPieceStep(item.orderId, { pieceId: item.pieceId, step })
      onRefetch()
    } catch (e) { setSendErr(errMsg(e, 'Không gửi được')) }
    finally { setSendBusy(false) }
  }

  return (
    <div>
      <StepBuDuPanel item={item} step={step} readOnly={readOnly} onRefetch={onRefetch} />
      <div style={{ ...card, marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={th}>Mảnh</th>
              <th style={thR}>Cần</th>
              <th style={thR}>Đã {stepLabel.toLowerCase()}</th>
              <th style={thR}>Còn lại</th>
              {!readOnly && <th style={{ ...thR, width: 100 }}>Nhập đợt này</th>}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: '1px solid var(--border)' }}>
              <td style={td}>{item.pieceName}</td>
              <td style={tdR}>{required}</td>
              <td style={tdR}>{done}</td>
              <td style={{ ...tdR, color: remaining > 0 ? ACCENT : GREEN, fontWeight: 700 }}>{remaining}</td>
              {!readOnly && (
                <td style={{ ...td, textAlign: 'right' }}>
                  <input type="number" min={0} placeholder="0" value={qty} onChange={e => setQty(e.target.value)} style={inp} />
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button onClick={submit} disabled={busy}
          style={{ ...smallBtn, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy ? 'not-allowed' : 'pointer' }}>
          <Plus size={13} /> {busy ? '...' : 'Lưu đợt'}
        </button>
      )}
      {err && <div style={{ marginTop: 8, fontSize: 12, color: RED }}>{err}</div>}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, marginBottom: 10 }}>
          <div><span style={{ color: 'var(--text3)' }}>Chưa gửi KCS</span> <b style={{ color: readyToSend > 0 ? ACCENT : 'var(--text3)' }}>{readyToSend}</b></div>
          <div><span style={{ color: 'var(--text3)' }}>Chờ KCS duyệt</span> <b style={{ color: AMBER }}>{awaitingQc}</b></div>
          <div><span style={{ color: 'var(--text3)' }}>Đã duyệt</span> <b style={{ color: GREEN }}>{passed}</b></div>
        </div>
        {!readOnly && readyToSend > 0 && (
          <button onClick={sendToKcs} disabled={sendBusy}
            style={{ ...smallBtn, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: sendBusy ? 'not-allowed' : 'pointer' }}>
            <Send size={13} /> {sendBusy ? '...' : `Gửi KCS ${readyToSend} mảnh`}
          </button>
        )}
        {sendErr && <div style={{ marginTop: 8, fontSize: 12, color: RED }}>{sendErr}</div>}
      </div>
    </div>
  )
}

// ── "Bù đủ" cho đợt CÔNG ĐOẠN đã QC_PASSED nhưng KCS chấm còn lỗi (2026-09-07) - cùng khuôn
// BuDuPanel (cấp "Chốt & gửi KCS") nhưng lọc theo ĐÚNG (pieceId, step) thay vì cả order. ──────────
function StepBuDuPanel({ item, step, readOnly, onRefetch }: {
  item: VatTuTpItem; step: ProcessStep; readOnly: boolean; onRefetch: () => void
}) {
  const { data: bundles, refetch: refetchBundles } = useFetch(
    () => api.getPieceStepBundlesForOrder(item.orderId), [item.orderId],
  )
  const { data: reviews, refetch: refetchReviews } = useFetch(() => api.getQcReviewsForPieceStepBundles(), [])
  const [target, setTarget] = useState<{ bundleId: string; outstanding: number } | null>(null)
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const stepBundleIds = new Set(
    (bundles ?? []).filter(b => b.pieceId === item.pieceId && b.step === step).map(b => b.id),
  )
  const outstandingReviews = (reviews ?? [])
    .filter(r => r.pieceStepBundleId && stepBundleIds.has(r.pieceStepBundleId))
    .map(r => ({ ...r, outstanding: r.failedQty - (r.scrapQty ?? 0) - r.resolvedQty }))
    .filter(r => r.outstanding > 0)
    .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))

  if (outstandingReviews.length === 0) return null

  const submit = async () => {
    if (!target) return
    const q = Math.max(1, Math.min(target.outstanding, Math.floor(Number(qty) || 0)))
    setBusy(true); setErr('')
    try {
      await api.reportPieceStepDone(target.bundleId, q)
      setTarget(null); setQty('')
      refetchBundles(); refetchReviews(); onRefetch()
    } catch (e) { setErr(errMsg(e, 'Không báo được')) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ ...card, padding: '12px 16px', marginBottom: 12, border: `1.5px solid ${RED}` }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: RED, marginBottom: 8 }}>Có đợt bị lỗi — cần bù đủ</div>
      {outstandingReviews.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: 13, flexWrap: 'wrap' }}>
          <span>Lỗi <b style={{ color: RED }}>{r.outstanding}</b> mảnh{r.defectReasonLabel ? ` — ${r.defectReasonLabel}` : ''}</span>
          {r.phoiReportedAt ? (
            <span style={{ color: AMBER, fontSize: 12 }}>· đã báo, chờ KCS duyệt lại</span>
          ) : !readOnly ? (
            <button
              onClick={() => { setTarget({ bundleId: r.pieceStepBundleId!, outstanding: r.outstanding }); setQty(String(r.outstanding)); setErr('') }}
              style={{ ...smallBtn, background: ACCENT }}
            >
              Bù đủ
            </button>
          ) : null}
        </div>
      ))}
      {target && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <input type="number" min={1} max={target.outstanding} value={qty} onChange={e => setQty(e.target.value)} style={{ ...inp, width: 80 }} autoFocus />
          <button onClick={submit} disabled={busy} style={{ ...smallBtn, background: GREEN, cursor: busy ? 'not-allowed' : 'pointer' }}>{busy ? '...' : 'Xác nhận'}</button>
          <button onClick={() => setTarget(null)} style={{ ...smallBtn, background: 'var(--surface2)', color: 'var(--text)' }}>Hủy</button>
        </div>
      )}
      {err && <div style={{ marginTop: 6, fontSize: 12, color: RED }}>{err}</div>}
    </div>
  )
}

// ── Panel "Chốt & gửi KCS" - tạo ProductionBatch thật (nguồn để KCS duyệt + chuyển kho). Cảnh báo
// (KHÔNG chặn) nếu còn công đoạn chưa báo đủ - quyết định nghiệp vụ 2026-09-04 (nhất quán triết lý
// "không cap theo BOM lúc báo, KCS mới là bước kiểm soát" đã áp dụng xuyên suốt module BE). ─────
function ChotPanel({ item, readOnly, onRefetch }: {
  item: VatTuTpItem; readOnly: boolean; onRefetch: () => void
}) {
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const remaining = Math.max(item.plannedQty - item.passedQty - item.awaitingQcQty, 0)
  const undoneSteps = item.processSteps.filter(step => {
    const p = item.stepProgress.find(sp => sp.step === step)
    return !p || p.doneQty < p.requiredQty
  })

  const submit = async () => {
    const q = Math.floor(Number(qty) || 0)
    if (q <= 0) { setErr('Nhập số mảnh đã hoàn thiện'); return }
    setBusy(true); setErr('')
    try {
      await api.reportProductionBatch(item.orderId, { stage: 'PHOI', pieceId: item.pieceId, reportedQty: q })
      setQty(''); onRefetch()
    } catch (e) { setErr(errMsg(e, 'Không ghi nhận được sản lượng')) }
    finally { setBusy(false) }
  }

  return (
    <div>
      <BuDuPanel item={item} readOnly={readOnly} onRefetch={onRefetch} />
      <div style={{ ...card, padding: '12px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
          <div><span style={{ color: 'var(--text3)' }}>Cần</span> <b>{item.plannedQty}</b> mảnh</div>
          <div><span style={{ color: 'var(--text3)' }}>Chờ KCS</span> <b style={{ color: AMBER }}>{item.awaitingQcQty}</b></div>
          <div><span style={{ color: 'var(--text3)' }}>Đã chốt</span> <b style={{ color: GREEN }}>{item.passedQty}</b></div>
          <div><span style={{ color: 'var(--text3)' }}>Còn lại</span> <b style={{ color: remaining > 0 ? ACCENT : GREEN }}>{remaining}</b></div>
        </div>
        {undoneSteps.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12, color: AMBER }}>
            <Clock size={13} />
            <span>Chưa báo đủ: {undoneSteps.map(s => PROCESS_STEP_LABELS[s]).join(', ')} - vẫn chốt được, chỉ là cảnh báo tham khảo.</span>
          </div>
        )}
      </div>

      {!readOnly && remaining > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <input type="number" min={1} max={remaining} placeholder="0" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inp, width: 84 }} />
          <button onClick={submit} disabled={busy}
            style={{ ...smallBtn, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy ? 'not-allowed' : 'pointer' }}>
            <Plus size={13} /> {busy ? '...' : 'Ghi nhận'}
          </button>
        </div>
      )}
      {!readOnly && remaining === 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: GREEN }}>
          <Check size={14} /> Đã báo đủ số lượng cần
        </div>
      )}
      {err && <div style={{ marginTop: 8, fontSize: 12, color: RED }}>{err}</div>}
    </div>
  )
}

// ── "Bù đủ" cho lô ĐÃ chốt (QC_DONE) nhưng KCS chấm còn lỗi (2026-09-07) - mirror BuDuPopup bên Sắt
// (LenhSanXuatPhoi.tsx) nhưng đơn giản hơn: 1 review = 1 đơn vị outstanding (không có "cỡ đoạn" để
// bóc). Ẩn hẳn khi không có lô nào lỗi - không chiếm chỗ màn hình lúc bình thường. ────────────────
function BuDuPanel({ item, readOnly, onRefetch }: {
  item: VatTuTpItem; readOnly: boolean; onRefetch: () => void
}) {
  const { data: batches, refetch: refetchBatches } = useFetch(
    () => api.getProductionBatchesForOrder(item.orderId, 'PHOI'), [item.orderId],
  )
  const { data: reviews, refetch: refetchReviews } = useFetch(() => api.getQcReviewsForProductionBatches(), [])
  const [target, setTarget] = useState<{ batchId: string; outstanding: number } | null>(null)
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const pieceBatchIds = new Set((batches ?? []).filter(b => b.pieceId === item.pieceId).map(b => b.id))
  const outstandingReviews = (reviews ?? [])
    .filter(r => r.productionBatchId && pieceBatchIds.has(r.productionBatchId))
    .map(r => ({ ...r, outstanding: r.failedQty - (r.scrapQty ?? 0) - r.resolvedQty }))
    .filter(r => r.outstanding > 0)
    .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))

  if (outstandingReviews.length === 0) return null

  const submit = async () => {
    if (!target) return
    const q = Math.max(1, Math.min(target.outstanding, Math.floor(Number(qty) || 0)))
    setBusy(true); setErr('')
    try {
      await api.reportProductionBatchDone(target.batchId, q)
      setTarget(null); setQty('')
      refetchBatches(); refetchReviews(); onRefetch()
    } catch (e) { setErr(errMsg(e, 'Không báo được')) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ ...card, padding: '12px 16px', marginBottom: 12, border: `1.5px solid ${RED}` }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: RED, marginBottom: 8 }}>Có lô bị lỗi — cần bù đủ</div>
      {outstandingReviews.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: 13, flexWrap: 'wrap' }}>
          <span>Lỗi <b style={{ color: RED }}>{r.outstanding}</b> mảnh{r.defectReasonLabel ? ` — ${r.defectReasonLabel}` : ''}</span>
          {r.phoiReportedAt ? (
            <span style={{ color: AMBER, fontSize: 12 }}>· đã báo, chờ KCS duyệt lại</span>
          ) : !readOnly ? (
            <button
              onClick={() => { setTarget({ batchId: r.productionBatchId!, outstanding: r.outstanding }); setQty(String(r.outstanding)); setErr('') }}
              style={{ ...smallBtn, background: ACCENT }}
            >
              Bù đủ
            </button>
          ) : null}
        </div>
      ))}
      {target && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <input type="number" min={1} max={target.outstanding} value={qty} onChange={e => setQty(e.target.value)} style={{ ...inp, width: 80 }} autoFocus />
          <button onClick={submit} disabled={busy} style={{ ...smallBtn, background: GREEN, cursor: busy ? 'not-allowed' : 'pointer' }}>{busy ? '...' : 'Xác nhận'}</button>
          <button onClick={() => setTarget(null)} style={{ ...smallBtn, background: 'var(--surface2)', color: 'var(--text)' }}>Hủy</button>
        </div>
      )}
      {err && <div style={{ marginTop: 6, fontSize: 12, color: RED }}>{err}</div>}
    </div>
  )
}
