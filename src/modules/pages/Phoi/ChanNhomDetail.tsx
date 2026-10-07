'use client'

/**
 * Chi tiết 1 "vật tư thành phẩm KHÔNG gắn piece" (MaterialYieldRecipe, vd chân nhôm) trong 1 PI -
 * mirror VatTuTpDetail.tsx/StepPanel NHƯNG khoá theo (productionInvoiceId, recipeId) thay vì
 * (productionOrderId, pieceId) - vật tư này không thuộc về 1 SKU/mảnh cụ thể nào, chỉ thuộc về cả
 * PI (xem MaterialYieldRecipesService.getProductionDemand() - cộng dồn nhu cầu từ MỌI piece dùng
 * vật tư này trong PI). "Cần" ở mỗi bước công đoạn vì vậy là `shortfallOutputQty` của PI (không
 * phải plannedQty theo 1 mảnh).
 *
 * Nhận nguyên liệu vào (Thanh nhôm): xác nhận NHẬN làm ở màn riêng "Xác nhận nhận sắt" (cùng pattern
 * SteelIssue/MaterialYieldIssue cũ) - màn này chỉ hiện trạng thái tham khảo + chặn báo công đoạn nếu
 * chưa nhận (khớp đúng guard sumReceived<=0 ở BE).
 */

import { useState } from 'react'
import { ChevronLeft, Check, Clock, Send } from 'lucide-react'
import * as api from '../../../services/api'
import { useFetch } from '../../../hooks/useFetch'
import type { ProcessStep } from '../../../types/sku'
import type {
  BeMaterialYieldStepBundle, BeMaterialYieldStepBundleQcReview,
} from '../../../services/material-yield-recipe-production-api'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { errMsg } from '../../../utils/errors'
import {
  ACCENT, GREEN, RED, AMBER, th, thR, td, tdR, card, smallBtn, inp, subFilterBtn,
} from './phoiStyles'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { useRealtimeChangeNotice } from '../../../realtime/hooks'
import RealtimeUpdateNotice from '../../../realtime/RealtimeUpdateNotice'
import { useRealtimeRefetch } from '../../../realtime/hooks'

export interface ChanNhomRecipeItem {
  productionInvoiceId: string
  piCode: string
  recipeId: string
  outputMaterialCode: string
  outputMaterialName: string
  inputMaterialCode: string
  inputMaterialName: string
  requiredOutputQty: number
  onHandOutputQty: number
  shortfallOutputQty: number
  requiredInputQty: number
  processSteps: ProcessStep[]
}

export default function ChanNhomDetail({ item, readOnly, onBack, onRefetch }: {
  item: ChanNhomRecipeItem; readOnly: boolean; onBack: () => void; onRefetch: () => void
}) {
  const [subFilter, setSubFilter] = useState<string>(item.processSteps[0] ?? '')

  const { data: issues, refetch: refetchTopIssues } = useFetch(
    () => api.getMaterialYieldRecipeIssuesForInvoice(item.productionInvoiceId), [item.productionInvoiceId],
  )
  useRealtimeRefetch(['material-yield-issues'], refetchTopIssues)
  const recipeIssues = (issues ?? []).filter(i => i.recipeId === item.recipeId)
  const issuedQty = recipeIssues.reduce((s, i) => s + i.issuedQty, 0)
  const receivedQty = recipeIssues.filter(i => i.status === 'RECEIVED').reduce((s, i) => s + (i.receivedQty ?? 0), 0)
  const hasPendingReceive = recipeIssues.some(i => i.status === 'ISSUED')
  const hasReceived = receivedQty > 0

  const tabItems = item.processSteps.map(step => ({ key: step as string, label: PROCESS_STEP_LABELS[step] }))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{item.outputMaterialName}</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {item.piCode} · Cần sản xuất thêm {item.shortfallOutputQty.toLocaleString('vi-VN')} (tồn sẵn {item.onHandOutputQty.toLocaleString('vi-VN')})
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
        Nguyên liệu vào: <b>{item.inputMaterialName}</b> ({item.inputMaterialCode}) - cần ~{item.requiredInputQty.toLocaleString('vi-VN')}, kho đã xuất {issuedQty.toLocaleString('vi-VN')}, đã nhận {receivedQty.toLocaleString('vi-VN')}.
        {hasPendingReceive && (
          <span style={{ marginLeft: 8, color: AMBER, fontWeight: 600 }}>Còn đợt chờ xác nhận nhận - xem <b>Xác nhận nhận sắt</b>.</span>
        )}
      </div>

      {!hasReceived ? (
        <div style={{ ...card, padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Chưa xác nhận nhận {item.inputMaterialName} nào - báo công đoạn được sau khi đã nhận (xem <b>Xác nhận nhận sắt</b>).
        </div>
      ) : item.processSteps.length === 0 ? (
        <div style={{ ...card, padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Định mức này chưa khai công đoạn nào - báo Admin bổ sung <b>Định mức vật tư thành phẩm</b>.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {tabItems.map(it => (
              <button key={it.key} onClick={() => setSubFilter(it.key)} style={subFilterBtn(subFilter === it.key)}>
                {it.label}
              </button>
            ))}
          </div>
          <StepPanel
            key={subFilter}
            item={item} step={subFilter as ProcessStep}
            readOnly={readOnly} onRefetch={onRefetch}
          />
        </>
      )}
    </div>
  )
}

function MobileQtyRow({ doneLabel, required, done, failed, remaining, readOnly, qty, setQty }: {
  doneLabel: string; required: number; done: number; failed: number; remaining: number
  readOnly: boolean; qty: string; setQty: (v: string) => void
}) {
  return (
    <div style={{ ...card, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>
          Còn lại <b style={{ color: remaining > 0 ? ACCENT : GREEN }}>{remaining}</b>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 10px', marginTop: 3, fontSize: 12, color: 'var(--text3)' }}>
          <span>Cần <b style={{ color: 'var(--text2)' }}>{required}</b></span>
          <span>{doneLabel} <b style={{ color: 'var(--text2)' }}>{done}</b></span>
          <span>Lỗi <b style={{ color: failed > 0 ? RED : 'var(--text3)' }}>{failed > 0 ? failed : '—'}</b></span>
          {!readOnly && failed > 0 && remaining > 0 && (
            <button onClick={() => setQty(String(Math.min(failed, remaining)))}
              style={{ ...smallBtn, padding: '2px 8px', fontSize: 11, background: ACCENT, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Bù đủ
            </button>
          )}
        </div>
      </div>
      {!readOnly && (
        <input type="number" min={0} placeholder="Nhập" aria-label="Nhập đợt này" value={qty} onChange={e => setQty(e.target.value)}
          style={{ ...inp, width: 84, flexShrink: 0 }} />
      )}
    </div>
  )
}

// ── Panel 1 bước (Cắt/Uốn/...) - mirror StepPanel (VatTuTpDetail.tsx) nhưng "Cần" = shortfallOutputQty
// của CẢ PI (không phải 1 mảnh), và "Đã làm"/"Lỗi"/"Còn lại" tự tính từ lịch sử bundle thay vì đọc
// BePieceStepProgress có sẵn (BE chưa có progress tổng hợp riêng cho recipe, chỉ có bundle list thô -
// xem ghi chú tại findBundlesForInvoice()). ─────────────────────────────────────────────────────
function StepPanel({ item, step, readOnly, onRefetch }: {
  item: ChanNhomRecipeItem; step: ProcessStep; readOnly: boolean; onRefetch: () => void
}) {
  const isMobile = useIsMobile()
  const { data: bundles, refetch: refetchBundles } = useFetch(
    () => api.getMaterialYieldStepBundlesForInvoice(item.productionInvoiceId), [item.productionInvoiceId],
  )
  const { data: bundleReviews, refetch: refetchBundleReviews } = useFetch(() => api.getQcReviewsForMaterialYieldStepBundles(), [])
  const qcChange = useRealtimeChangeNotice(['qc-reviews'])
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const stepLabel = PROCESS_STEP_LABELS[step]

  const recipeBundles = (bundles ?? []).filter(b => b.recipeId === item.recipeId && b.step === step)
  const reviewByBundleId = new Map((bundleReviews ?? []).map(r => [r.materialYieldStepBundleId, r]))

  const required = item.shortfallOutputQty
  const done = recipeBundles.reduce((s, b) => s + b.qty, 0)
  const passed = recipeBundles.filter(b => b.status === 'QC_PASSED').reduce((s, b) => s + b.qty, 0)
  const awaitingQc = recipeBundles.filter(b => b.status === 'AWAITING_QC').reduce((s, b) => s + b.qty, 0)
  const failed = recipeBundles.reduce((s, b) => s + (reviewByBundleId.get(b.id)?.failedQty ?? 0), 0)
  const remaining = Math.max(required - done + failed, 0)

  const refetchAll = () => { refetchBundles(); onRefetch() }

  const submit = async () => {
    const q = Math.floor(Number(qty) || 0)
    if (q <= 0) { setErr(`Nhập số lượng đã ${stepLabel.toLowerCase()}`); return }
    setBusy(true); setErr('')
    try {
      await api.recordMaterialYieldStepBatch(item.productionInvoiceId, { recipeId: item.recipeId, step, qty: q })
      setQty('')
      await api.submitMaterialYieldStep(item.productionInvoiceId, { recipeId: item.recipeId, step })
      refetchAll()
    } catch (e) { setErr(errMsg(e, 'Không lưu được đợt - kiểm lại số liệu')) }
    finally { setBusy(false) }
  }

  const bundlesSorted = [...recipeBundles].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const orderIndexByBundleId = new Map(
    [...recipeBundles].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).map((b, i) => [b.id, i + 1]),
  )

  return (
    <div>
      <RealtimeUpdateNotice visible={qcChange.changed} onReload={() => { qcChange.clear(); void refetchBundles(); void refetchBundleReviews() }} />
      {isMobile ? (
        <MobileQtyRow doneLabel={'Đã ' + stepLabel.toLowerCase()} required={required} done={done} failed={failed} remaining={remaining} readOnly={readOnly} qty={qty} setQty={setQty} />
      ) : (
      <div style={{ ...card, marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={th}>Vật tư</th>
              <th style={thR}>Cần</th>
              <th style={thR}>Đã {stepLabel.toLowerCase()}</th>
              <th style={thR}>Lỗi</th>
              <th style={thR}>Còn lại</th>
              {!readOnly && <th style={{ ...thR, width: 140 }}>Nhập đợt này</th>}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: '1px solid var(--border)' }}>
              <td style={td}>{item.outputMaterialName}</td>
              <td style={tdR}>{required}</td>
              <td style={tdR}>{done}</td>
              <td style={{ ...tdR, color: failed > 0 ? RED : 'var(--text3)' }}>{failed > 0 ? failed : '—'}</td>
              <td style={{ ...tdR, color: remaining > 0 ? ACCENT : GREEN, fontWeight: 700 }}>{remaining}</td>
              {!readOnly && (
                <td style={{ ...td, textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" min={0} placeholder="0" value={qty} onChange={e => setQty(e.target.value)} style={inp} />
                    {failed > 0 && remaining > 0 && (
                      <button
                        onClick={() => setQty(String(Math.min(failed, remaining)))}
                        style={{ ...smallBtn, padding: '4px 8px', fontSize: 11, background: ACCENT, cursor: 'pointer' }}>
                        Bù đủ
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
      )}
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <button onClick={submit} disabled={busy}
            style={{ ...smallBtn, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy ? 'not-allowed' : 'pointer' }}>
            <Send size={13} /> {busy ? '...' : 'Báo & gửi KCS'}
          </button>
        </div>
      )}
      {err && <div style={{ marginTop: 8, fontSize: 12, color: RED }}>{err}</div>}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
          <div><span style={{ color: 'var(--text3)' }}>Chờ KCS duyệt</span> <b style={{ color: AMBER }}>{awaitingQc}</b></div>
          <div><span style={{ color: 'var(--text3)' }}>Đã duyệt</span> <b style={{ color: GREEN }}>{passed}</b></div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 8 }}>Các đợt đã gửi ({bundlesSorted.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bundlesSorted.map(b => (
            <StepBundleHistoryCard
              key={b.id} bundle={b} orderIndex={orderIndexByBundleId.get(b.id) ?? 0}
              review={reviewByBundleId.get(b.id)}
            />
          ))}
          {bundlesSorted.length === 0 && (
            <div style={{ ...card, padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Chưa gửi KCS đợt nào</div>
          )}
        </div>
      </div>
    </div>
  )
}

function StepBundleHistoryCard({ bundle, orderIndex, review }: {
  bundle: BeMaterialYieldStepBundle; orderIndex: number; review?: BeMaterialYieldStepBundleQcReview
}) {
  const failed = review?.failedQty ?? 0
  return (
    <div style={{ ...card, borderColor: failed > 0 ? RED : undefined, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Đợt {orderIndex}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {bundle.qty} · {new Date(bundle.submittedAt).toLocaleString('vi-VN')}
          </div>
        </div>
        {bundle.status === 'AWAITING_QC' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ KCS</span>
        )}
        {bundle.status === 'QC_PASSED' && failed === 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đã duyệt</span>
        )}
        {failed > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: RED }}>Lỗi {failed}</span>
        )}
      </div>
    </div>
  )
}
