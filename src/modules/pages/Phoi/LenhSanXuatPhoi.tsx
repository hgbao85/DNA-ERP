'use client'

/**
 * Lệnh sản xuất — Công đoạn Phôi (theo dõi tiến độ + báo cắt xong theo PO/PI → từng đợt sắt).
 *
 * Đã nối BE thật (M3, 2026-08-12 — "Xuất sắt Phôi"): dựng thẳng từ GET /steel-issues (flat, cùng
 * nguồn dữ liệu "Xác nhận nhận sắt") — PHOI_STAFF chỉ có STEEL_ISSUE:VIEW, không có
 * SKU:VIEW/PRODUCTION_ORDER:VIEW nên không tự resolve steel-issue-plan (BOM) theo PI như phía kho
 * (XuatSatPage) được.
 *
 * B4 Đợt 3d (2026-08-19): gom theo PI + LOẠI SẮT (không còn theo mảnh) — SteelIssue giờ gộp theo
 * cả PI, không còn gắn 1 mảnh cụ thể (xem changelog 2026-08-18-xuat-sat-po-pi-vat-tu.md).
 *
 * Phạm vi (2026-08-22, chốt lại lần 2): xác nhận NHẬN sắt làm ở màn riêng "Xác nhận nhận sắt".
 * Màn NÀY làm phần còn lại của vòng đời sau khi nhận: báo cắt xong, đánh dấu công đoạn chi tiết
 * (uốn/dập/...).
 *
 * Báo cắt xong (2026-08-22, chốt lại lần 2 - lần đầu bị rollback 08-21 vì thảo luận sai phạm vi
 * màn, không phải sai thiết kế): Phôi KHAI THẲNG số đoạn thực cắt theo TỪNG CỠ (recordCutBatch).
 * "Báo cắt xong" tách làm 2 hành động độc lập: nhập từng đợt (nhiều lần, cộng dồn) + "Báo cắt
 * xong" (tín hiệu thuần, KHÔNG tự động khi Còn lại = 0 vì ca cắt thiếu do sắt hỏng/cong vẫn phải
 * đi tiếp được).
 *
 * KCS chấm lỗi (2026-08-24, vòng 2): CHỈ 2 kết quả Đạt/Không đạt. Đợt QC_PASSED còn lỗi
 * (outstanding > 0) vẫn xem được, nhưng KHÔNG còn nhập đợt cắt - Phôi tự bù bằng sắt kiếm ngoài
 * thực tế, bấm "Bù đủ" rồi CHỜ KCS duyệt lại (QcReviewsService.reportSegmentDone/recheck).
 *
 * Redesign 2026-08-26: PI vẫn là đơn vị lớn nhất. Thêm khối "PO/SKU trong đợt này" (THUẦN THAM
 * KHẢO). Đổi "Đã KCS đạt" → "Đã phôi" (chỉ ở màn Phôi).
 *
 * Redesign 2026-09-05 (gộp theo LOẠI SẮT + trạng thái hạ xuống đợt cắt) — thay đổi lớn nhất kể từ
 * bản gốc: trước đây PiDetail liệt kê PHẲNG mỗi lần kho giao (SteelIssue) thành 1 dòng riêng - 1
 * loại sắt kho giao 2 lần (vd thiếu hàng đợt đầu, giao bù sau) thì hiện 2 dòng ngang hàng, PI chỉ
 * 2 loại sắt vẫn thấy 4 dòng (thực tế trên production, PO-52). Giờ PiDetail gộp theo materialId
 * thành 1 "MaterialGroup" duy nhất mỗi loại sắt (Σ cây mọi lần kho giao), MaterialGroupDetail
 * (đổi tên từ IssueDetail) liệt kê CÁC ĐỢT CẮT (CutBundle) bên trong - mỗi đợt tự trạng thái riêng
 * (CUTTING/AWAITING_QC/QC_PASSED, xem CutBundle.status ở BE) nên cắt xong đợt nào gửi KCS đợt đó,
 * sắt giao bù không còn bị kẹt (trước đây SteelIssue.status làm chủ vòng đời, đợt đã gửi KCS thì
 * lô đó không cắt tiếp được - recordCutBatch chặn cứng, không có đường quay lại RECEIVED).
 * SteelIssue giờ chỉ còn ISSUED/RECEIVED (việc của kho, xem màn "Xác nhận nhận sắt" - KHÔNG đổi).
 *
 * Cùng đợt này: bỏ hẳn 2 ô "Số cây đã dùng"/"Mẩu nguyên" khỏi form nhập đợt cắt (yêu cầu nghiệp
 * vụ - 1 loại sắt giờ gộp nhiều lần kho giao, tách cây theo từng đợt cắt là tuỳ tiện). Hệ quả:
 * mất cân bằng vật chất/phế liệu tự tính, mất chặn "khai vượt số cây kho giao" - kiểm soát dồn về
 * KCS, đúng triết lý "không cap lúc báo, KCS mới là bước kiểm soát" vốn có của module này.
 */

import { useMemo, useState } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, Wrench, Clock, Check, AlertTriangle, RotateCcw, Plus, Ruler, X, Grid, Send,
} from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type {
  BeSteelIssue, BeQcReview, BePhoiProgressItem, BeCutBundle, BePiOrderSummary,
} from '../../../services/steel-issues-api'
import type { BeProductionOrderSummary, BeProductionBatchPlan } from '../../../services/production-batches-api'
import type { ProcessStep } from '../../../types/sku'
import { PROCESS_STEPS, PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'
import VatTuTpDetail, { type VatTuTpItem } from './VatTuTpDetail'
import {
  ACCENT, GREEN, RED, AMBER, PURPLE, th, thR, td, tdR, card, smallBtn, inp, subFilterBtn,
} from './phoiStyles'

interface PiAgg {
  productionInvoiceId: string; poNumber: string; issues: BeSteelIssue[]; bundles: BeCutBundle[]
  totalIssued: number
  /** Số đợt cắt (không phải cây - xem comment đổi tiêu đề cột ở bảng danh sách PI) đang chờ xử lý
   *  (CUTTING hoặc AWAITING_QC) / đã qua KCS (QC_PASSED). */
  bundlesPending: number; bundlesPassed: number
  /** Vật tư thành phẩm (PieceMaterialYield, vd Pat/chân nhôm) của PI này - danh sách PHẲNG, mỗi
   *  (order, piece) 1 item (2026-09-04, gộp màn - trước đây ở tab riêng "Vật tư thành phẩm"). */
  vatTuTpItems: VatTuTpItem[]
}

function buildPiRows(
  issues: BeSteelIssue[], bundles: BeCutBundle[], vatTuTpByPi: Map<string, VatTuTpItem[]>,
): PiAgg[] {
  // Gom theo productionInvoiceId (luôn duy nhất) chứ KHÔNG theo mã hiển thị salesOrderCode -
  // nhiều lệnh SX có thể cùng chung 1 mã Sales (nhiều SKU/đơn) hoặc cùng null.
  const byPi = new Map<string, BeSteelIssue[]>()
  const order: string[] = []
  const issueById = new Map<string, BeSteelIssue>()
  for (const i of issues) {
    issueById.set(i.id, i)
    if (!byPi.has(i.productionInvoiceId)) { byPi.set(i.productionInvoiceId, []); order.push(i.productionInvoiceId) }
    byPi.get(i.productionInvoiceId)!.push(i)
  }
  // PI có thể CHỈ có vật tư thành phẩm (mảnh needsHan=false không cần sắt) - chưa từng xuất hiện
  // trong `issues` thì vẫn phải thêm vào danh sách, không được bỏ sót.
  for (const piId of vatTuTpByPi.keys()) {
    if (!byPi.has(piId)) { byPi.set(piId, []); order.push(piId) }
  }
  return order.map(productionInvoiceId => {
    const list = byPi.get(productionInvoiceId)!
    const vatTuTpItems = vatTuTpByPi.get(productionInvoiceId) ?? []
    // Đợt cắt thuộc PI này = đợt gắn vào 1 SteelIssue nằm trong `list` (bundle không tự biết PI).
    const piBundles = bundles.filter(b => issueById.get(b.steelIssueId)?.productionInvoiceId === productionInvoiceId)
    return {
      productionInvoiceId,
      poNumber: list[0]?.salesOrderCode ?? list[0]?.piCode ?? vatTuTpItems[0]?.poNumber ?? productionInvoiceId,
      issues: list,
      bundles: piBundles,
      totalIssued: list.reduce((s, i) => s + i.barCount, 0),
      bundlesPending: piBundles.filter(b => b.status !== 'QC_PASSED').length,
      bundlesPassed: piBundles.filter(b => b.status === 'QC_PASSED').length,
      vatTuTpItems,
    }
  })
}

/** 1 loại sắt trong 1 PI, gộp mọi lần kho giao (2026-09-05) - xem comment đầu file. */
interface MaterialGroup {
  key: string; materialId: string; materialName: string; barLengthMm: number
  issues: BeSteelIssue[]; bundles: BeCutBundle[]; totalBarCount: number
}

function buildMaterialGroups(issues: BeSteelIssue[], bundles: BeCutBundle[]): MaterialGroup[] {
  const byMaterial = new Map<string, BeSteelIssue[]>()
  const order: string[] = []
  for (const i of issues) {
    if (!byMaterial.has(i.materialId)) { byMaterial.set(i.materialId, []); order.push(i.materialId) }
    byMaterial.get(i.materialId)!.push(i)
  }
  return order.map(materialId => {
    const groupIssues = byMaterial.get(materialId)!
    const issueIds = new Set(groupIssues.map(i => i.id))
    return {
      key: materialId,
      materialId,
      materialName: groupIssues[0].materialName,
      barLengthMm: groupIssues[0].barLengthMm,
      issues: groupIssues,
      bundles: bundles.filter(b => issueIds.has(b.steelIssueId)),
      totalBarCount: groupIssues.reduce((s, i) => s + i.barCount, 0),
    }
  })
}

export default function LenhSanXuatPhoi({ readOnly = false, onOpenCuttingGuide }: {
  readOnly?: boolean
  /** Nhảy sang màn "Hướng dẫn cắt" (sidebar riêng) đúng PI đang mở - xem NewCutBundleForm. */
  onOpenCuttingGuide?: (productionInvoiceId: string) => void
}) {
  // activeOnly=true (2026-08-31): chỉ hiện PI có ít nhất 1 SKU đã được QLSX bấm "Bắt đầu" ở Bảng
  // thống kê - PI có thể chứa nhiều SKU, chỉ cần 1 SKU đang chạy là cả PI vẫn hiện (Phôi xuất sắt
  // chung theo PI, không tách theo SKU).
  const { data: issues, isLoading, refetch } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(undefined, true), [])
  const { data: reviews, refetch: refetchReviews } = useFetch<BeQcReview[]>(() => api.getQcReviewsForSteelIssues(), [])
  // Mọi đợt cắt (2026-09-05) - nguồn trạng thái chính từ nay (xem comment đầu file). Tải 1 LẦN
  // cho toàn bộ danh sách PI (không theo từng PI riêng) - danh sách chưa lớn, cùng idiom "fetch
  // hết rồi lọc/gộp client" đã dùng cho issues/reviews ở trên.
  const { data: allBundles, refetch: refetchBundles } = useFetch<BeCutBundle[]>(() => api.getAllCutBundles(), [])
  // Vật tư thành phẩm (2026-09-04, gộp màn - trước đây tab riêng "Vật tư thành phẩm", xem
  // VatTuTpDetail.tsx). listProductionOrdersForStage() trả MỌI order active (dùng chung Hàn/Sơn/
  // Phôi, không lọc theo needsHan) - lọc còn lại dựa vào plan.items rỗng hay không bên dưới.
  const { data: vatTuTpOrders, refetch: refetchVatTuTpOrders } = useFetch<BeProductionOrderSummary[]>(
    () => api.listProductionOrdersForStage(), [],
  )
  const orderIds = useMemo(() => (vatTuTpOrders ?? []).map(o => o.id), [vatTuTpOrders])
  const orderIdsKey = orderIds.join(',')
  const { data: vatTuTpPlans, refetch: refetchVatTuTpPlans } = useFetch<Record<string, BeProductionBatchPlan>>(
    () => orderIds.length === 0 ? Promise.resolve({}) : api.getProductionBatchPlanBatch(orderIds, 'PHOI'),
    [orderIdsKey],
  )
  const vatTuTpByPi = useMemo(() => {
    const m = new Map<string, VatTuTpItem[]>()
    if (!vatTuTpOrders || !vatTuTpPlans) return m
    for (const o of vatTuTpOrders) {
      const plan = vatTuTpPlans[o.id]
      if (!plan || plan.items.length === 0) continue
      const arr = m.get(o.productionInvoiceId) ?? []
      for (const item of plan.items) {
        arr.push({
          orderId: o.id, poNumber: plan.salesOrderCode ?? o.piCode, productName: plan.productName,
          pieceId: item.pieceId, pieceCode: item.pieceCode, pieceName: item.pieceName,
          plannedQty: item.plannedQty, awaitingQcQty: item.awaitingQcQty, passedQty: item.passedQty,
          rawMaterialOnHand: item.rawMaterialOnHand, processSteps: item.processSteps,
          stepProgress: item.stepProgress, qtyPerPiece: item.qtyPerPiece,
        })
      }
      m.set(o.productionInvoiceId, arr)
    }
    return m
  }, [vatTuTpOrders, vatTuTpPlans])
  const [selPi, setSelPi] = useState<string | null>(null)

  const piRows = useMemo(
    () => buildPiRows(issues ?? [], allBundles ?? [], vatTuTpByPi),
    [issues, allBundles, vatTuTpByPi],
  )
  const refetchAll = () => { refetch(); refetchReviews(); refetchBundles(); refetchVatTuTpOrders(); refetchVatTuTpPlans() }

  if (isLoading || !issues) return <LoadingState />

  const sel = selPi ? piRows.find(r => r.productionInvoiceId === selPi) ?? null : null

  if (sel) {
    return (
      <PiDetail pi={sel} readOnly={readOnly} reviews={reviews ?? []} onBack={() => setSelPi(null)} onRefetch={refetchAll} onOpenCuttingGuide={onOpenCuttingGuide} />
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Wrench size={20} /> Lệnh sản xuất — Công đoạn Phôi
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Theo dõi tiến độ cắt sắt + vật tư thành phẩm theo PO/PI — bấm để báo cắt xong / đánh dấu công đoạn theo từng đợt. Xác nhận nhận sắt làm ở <b>Xác nhận nhận sắt</b>.
      </div>

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PO / PI</th>
              <th style={thR}>Đã xuất (cây)</th>
              <th style={thR}>Đang xử lý (đợt)</th>
              <th style={thR}>Đã phôi (đợt)</th>
              <th style={thR}>Vật tư TP</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {piRows.map(r => {
              // Đơn vị khác hẳn Sắt (mảnh, không phải cây) - không cộng chung vào cột nào ở trên -
              // chỉ đếm bao nhiêu mảnh ĐÃ báo đủ (passed+awaiting >= planned) trên tổng số mảnh,
              // hiện dạng "đã xong X/Y" (thay vì "còn thiếu X/Y" - dễ đọc hơn: số tăng dần theo
              // tiến độ, khớp trực giác thanh "Đã cắt"/"Đã phôi" cùng hàng đều đếm phần ĐÃ LÀM).
              const vatTuTpDoneCount = r.vatTuTpItems.filter(v => v.passedQty + v.awaitingQcQty >= v.plannedQty).length
              const vatTuTpPending = r.vatTuTpItems.length - vatTuTpDoneCount
              return (
                <tr key={r.productionInvoiceId} onClick={() => setSelPi(r.productionInvoiceId)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{r.poNumber}</td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{r.issues.length > 0 ? r.totalIssued : '—'}</td>
                  <td style={tdR}>
                    {r.bundles.length === 0 ? <span style={{ color: 'var(--text3)' }}>—</span>
                      : r.bundlesPending > 0
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#d97706', fontWeight: 600 }}><Clock size={12} /> {r.bundlesPending}</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a' }}><Check size={12} /> xong</span>}
                  </td>
                  <td style={{ ...tdR, color: r.bundles.length > 0 ? '#16a34a' : 'var(--text3)', fontWeight: r.bundles.length > 0 ? 700 : 400 }}>{r.bundles.length > 0 ? r.bundlesPassed : '—'}</td>
                  <td style={tdR}>
                    {r.vatTuTpItems.length === 0 ? <span style={{ color: 'var(--text3)' }}>—</span>
                      : vatTuTpPending > 0
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: PURPLE, fontWeight: 600 }}><Wrench size={12} /> đã xong {vatTuTpDoneCount}/{r.vatTuTpItems.length}</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a' }}><Check size={12} /> xong ({r.vatTuTpItems.length})</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--text3)' }}><ChevronRight size={16} /></td>
                </tr>
              )
            })}
            {piRows.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Chưa có PI nào được xuất sắt</span>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Chi tiết 1 PI — danh sách LOẠI SẮT (gộp mọi lần kho giao), báo cắt xong / đánh dấu công đoạn ─

function PiDetail({ pi, readOnly, reviews, onBack, onRefetch, onOpenCuttingGuide }: {
  pi: PiAgg; readOnly: boolean; reviews: BeQcReview[]; onBack: () => void; onRefetch: () => void
  onOpenCuttingGuide?: (productionInvoiceId: string) => void
}) {
  // Chi tiết 1 loại sắt (2026-08-27, vòng 7; đổi tên MaterialGroupDetail 2026-09-05): trước đó
  // bấm 1 dòng chỉ BUNG RA NGAY TRONG danh sách - nhiều dòng có thể cùng mở, dòng nọ đẩy vị trí
  // dòng kia, cảm giác "ảnh hưởng lẫn nhau" giữa các loại sắt. Giờ bấm 1 dòng ĐIỀU HƯỚNG sang màn
  // chi tiết riêng - đúng pattern PI list → PiDetail đã có, chỉ thêm 1 tầng.
  const [selIssueId, setSelIssueId] = useState<string | null>(null)
  // Vật tư thành phẩm (2026-09-04, gộp màn) - key `${orderId}:${pieceId}` vì 2 SKU khác nhau trong
  // cùng PI có thể cùng dùng 1 pieceId trùng tên (vd cùng "Pat"), phải phân biệt theo cả order.
  const [selVatTuTpKey, setSelVatTuTpKey] = useState<string | null>(null)

  const { data: progress, refetch: refetchProgress } = useFetch<BePhoiProgressItem[]>(
    () => api.getPhoiProgress(pi.productionInvoiceId), [pi.productionInvoiceId],
  )
  // Khối "PO/SKU trong đợt này" - THUẦN THAM KHẢO, không mang số liệu tiến độ (tiến độ chỉ có ở
  // cấp PI × loại sắt, xem progress ở trên) - Phôi không biết trước cây sắt về SKU nào lúc cắt.
  // Luôn hiện kể cả PI thường (1 SKU) để đồng nhất giao diện.
  const { data: orderSummary } = useFetch<BePiOrderSummary[]>(
    () => api.getPiOrderSummary(pi.productionInvoiceId), [pi.productionInvoiceId],
  )
  const progressByMaterial = useMemo(() => {
    const m = new Map<string, BePhoiProgressItem>()
    for (const p of progress ?? []) m.set(p.materialId, p)
    return m
  }, [progress])
  // Nhập đợt cắt/mời KCS đổi cả phoi-progress (Cần/Đã cắt) lẫn steel-issues/qc-reviews (trạng
  // thái) - phải refetch cả 2 nguồn, không chỉ mỗi onRefetch() của cha.
  const refetchAll = () => { onRefetch(); refetchProgress() }

  // Review giờ khoá theo cutBundleId (2026-09-05, KCS chấm theo từng đợt cắt) - review CŨ (trước
  // khi hạ vòng đời, cutBundleId=null) không còn xuất hiện nữa vì mọi bundle cũ đã backfill status
  // QC_PASSED ngay từ migration, không quay lại AWAITING_QC để chấm lại qua đường mới.
  const reviewByBundle = useMemo(() => {
    const m = new Map<string, BeQcReview>()
    for (const r of reviews) if (r.cutBundleId) m.set(r.cutBundleId, r)
    return m
  }, [reviews])

  // Review công đoạn PHỤ (2026-09-07) - khoá theo stepBundleId, CÙNG nguồn `reviews` (BE ghi cả
  // steelIssueId lẫn stepBundleId trên dòng review nhánh này - xem QcReview doc comment BE).
  const reviewByStepBundle = useMemo(() => {
    const m = new Map<string, BeQcReview>()
    for (const r of reviews) if (r.stepBundleId) m.set(r.stepBundleId, r)
    return m
  }, [reviews])

  const materialGroups = useMemo(
    () => buildMaterialGroups(pi.issues, pi.bundles),
    [pi.issues, pi.bundles],
  )
  const traVeList = pi.issues.filter(l => l.status === 'RECEIVED' && l.reworkOfId)
  const traVe = traVeList.length
  const traVeCay = traVeList.reduce((s, l) => s + l.barCount, 0)

  // Tách "Cắt sắt"/"Vật tư TP" thành tab (2026-09-07, theo góp ý người dùng) - trước đây liệt kê
  // liền nhau trên 1 trang dài, cuộn xuống mới thấy hết cả 2 loại việc rất khác nhau (Sắt theo cỡ
  // đoạn, VTTP theo mảnh phẳng). Mặc định mở tab có dữ liệu (ưu tiên Sắt, PI đa số có cả 2 - nếu
  // PI CHỈ có VTTP thì mở thẳng tab đó, không bắt xem "Chưa có đợt sắt nào" trước) - CỐ Ý không mặc
  // định "Tất cả" dù thêm lựa chọn đó (dưới), để giữ đúng lợi ích tách tab (đỡ cuộn dài); "Tất cả"
  // chỉ là lối tắt khi cần xem gộp cả 2, không phải hành vi mở màn mặc định.
  const [tab, setTab] = useState<'all' | 'sat' | 'vttp' | 'matrix'>(() => materialGroups.length > 0 ? 'sat' : 'vttp')
  // Chỉ hiện tab "Ma trận" khi có ÍT NHẤT 1 mảnh VTTP đã khai processSteps (2026-09-07, đề xuất UX
  // "màn ma trận mảnh × công đoạn") - mảnh chưa khai công đoạn không có cột nào để hiện, thêm tab
  // rỗng chỉ gây rối.
  const matrixItems = useMemo(() => pi.vatTuTpItems.filter(v => v.processSteps.length > 0), [pi.vatTuTpItems])

  const selGroup = selIssueId ? materialGroups.find(g => g.key === selIssueId) ?? null : null
  if (selGroup) {
    return (
      <MaterialGroupDetail
        key={selGroup.key} group={selGroup} readOnly={readOnly} reviewByBundle={reviewByBundle}
        reviewByStepBundle={reviewByStepBundle}
        progress={progressByMaterial.get(selGroup.materialId) ?? null}
        onBack={() => setSelIssueId(null)} onRefetch={refetchAll} onOpenCuttingGuide={onOpenCuttingGuide}
      />
    )
  }

  const selVatTuTp = selVatTuTpKey
    ? pi.vatTuTpItems.find(v => `${v.orderId}:${v.pieceId}` === selVatTuTpKey) ?? null
    : null
  if (selVatTuTp) {
    return (
      <VatTuTpDetail
        key={selVatTuTpKey} item={selVatTuTp} readOnly={readOnly}
        onBack={() => setSelVatTuTpKey(null)} onRefetch={refetchAll}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{pi.poNumber}</h2>
      </div>

      <div style={{ ...card, padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>Đợt cắt này gồm</div>
        {!orderSummary ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Đang tải...</div>
        ) : orderSummary.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có dữ liệu.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {orderSummary.map((o, i) => (
              <div key={i} style={{ fontSize: 13, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{o.poNumber}</span>
                <span>{o.productName}</span>
                <span style={{ color: 'var(--text3)', marginLeft: 'auto' }}>SL {o.quantity.toLocaleString('vi-VN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {traVe > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'var(--red-bg, #fef2f2)', color: '#b91c1c', fontSize: 13 }}>
          <RotateCcw size={16} />
          <span><b>{traVe}</b> đợt KCS trả về cần <b>cắt lại</b> · tổng <b>{traVeCay}</b> cây.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setTab('all')} style={subFilterBtn(tab === 'all')}>
          Tất cả ({materialGroups.length + pi.vatTuTpItems.length})
        </button>
        <button onClick={() => setTab('sat')} style={subFilterBtn(tab === 'sat')}>
          Cắt sắt ({materialGroups.length})
        </button>
        <button onClick={() => setTab('vttp')} style={subFilterBtn(tab === 'vttp')}>
          <Wrench size={12} style={{ marginRight: 5 }} /> Vật tư TP ({pi.vatTuTpItems.length})
        </button>
        {matrixItems.length > 0 && (
          <button onClick={() => setTab('matrix')} style={subFilterBtn(tab === 'matrix')}>
            <Grid size={12} style={{ marginRight: 5 }} /> Ma trận
          </button>
        )}
      </div>

      {(tab === 'sat' || tab === 'all') && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'all' && (
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>Cắt sắt</div>
        )}
        {materialGroups.map(g => {
          // 1 dòng / LOẠI SẮT (2026-09-05, gộp mọi lần kho giao - xem comment đầu file). Trạng
          // thái tổng quát của dòng suy từ tập bundles: có đợt nào đang cắt → "đang cắt", hết
          // đang cắt mà còn đợt chờ KCS → "chờ KCS", mọi đợt đã qua KCS (và có ít nhất 1) →
          // "đã phôi" (trừ khi còn lỗi outstanding chưa bù đủ).
          const cuttingCount = g.bundles.filter(b => b.status === 'CUTTING').length
          const awaitingQcCount = g.bundles.filter(b => b.status === 'AWAITING_QC').length
          const passedBundles = g.bundles.filter(b => b.status === 'QC_PASSED')
          const outstanding = passedBundles.reduce((s, b) => {
            const segs = reviewByBundle.get(b.id)?.segments ?? []
            return s + segs.reduce((s2, x) => s2 + (x.failedQty - x.resolvedQty), 0)
          }, 0)
          const awaitingRecheck = passedBundles.some(b =>
            (reviewByBundle.get(b.id)?.segments ?? []).some(x => x.phoiReportedAt != null && x.failedQty - x.resolvedQty > 0),
          )
          const hasReceived = g.issues.some(i => i.status !== 'ISSUED')
          const isReturn = g.issues.some(i => i.status === 'RECEIVED' && !!i.reworkOfId)
          return (
            <div key={g.key} style={{ ...card, borderColor: isReturn ? RED : undefined }}>
              <div
                onClick={() => setSelIssueId(g.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer',
                  background: isReturn ? 'var(--red-bg, #fef2f2)' : undefined,
                  opacity: g.bundles.length > 0 && cuttingCount === 0 && awaitingQcCount === 0 && outstanding === 0 ? 0.75 : 1,
                }}
              >
                <ChevronRight size={15} color="var(--text3)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {g.materialName}
                    {isReturn && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: RED, marginLeft: 8 }}><RotateCcw size={11} /> KCS trả về</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {g.totalBarCount} cây × {g.barLengthMm.toLocaleString('vi-VN')}mm
                    {g.bundles.length > 0 && <> · {g.bundles.length} đợt cắt</>}
                  </div>
                </div>
                {!hasReceived ? (
                  <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>chờ nhận</span>
                ) : cuttingCount > 0 ? (
                  <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>đang cắt ({cuttingCount})</span>
                ) : awaitingQcCount > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ KCS ({awaitingQcCount})</span>
                ) : g.bundles.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>đã nhận, chưa cắt</span>
                ) : outstanding > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
                    <span style={{ color: RED }}>Lỗi {outstanding} đoạn</span>
                    {awaitingRecheck && <span style={{ color: AMBER }}>· chờ KCS duyệt lại</span>}
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đã phôi</span>
                )}
              </div>
            </div>
          )
        })}
        {materialGroups.length === 0 && (
          <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chưa có đợt sắt nào</div>
        )}
      </div>
      )}

      {/* Vật tư thành phẩm (2026-09-04, gộp màn - trước đây tab riêng "Vật tư thành phẩm"; tách lại
          thành tab riêng 2026-09-07 - xem comment "Tách 'Cắt sắt'/'Vật tư TP'" ở trên) - danh sách
          PHẲNG, mỗi (order, piece) 1 item (khác Sắt gộp theo cả PI) - xem VatTuTpItem. */}
      {(tab === 'vttp' || tab === 'all') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: tab === 'all' ? 20 : 0 }}>
            {tab === 'all' && (
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>Vật tư TP</div>
            )}
            {pi.vatTuTpItems.length === 0 && (
              <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chưa có vật tư thành phẩm nào</div>
            )}
            {pi.vatTuTpItems.map(v => {
              const key = `${v.orderId}:${v.pieceId}`
              const done = v.passedQty + v.awaitingQcQty >= v.plannedQty
              const undoneSteps = v.processSteps.filter(step => {
                const p = v.stepProgress.find(sp => sp.step === step)
                return !p || p.doneQty < p.requiredQty
              })
              return (
                <div key={key} onClick={() => setSelVatTuTpKey(key)} style={{ ...card, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
                    <ChevronRight size={15} color="var(--text3)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{v.pieceName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                        {v.poNumber} · Cần {v.plannedQty} mảnh{v.qtyPerPiece != null && v.qtyPerPiece > 1 ? ` (= ${v.plannedQty * v.qtyPerPiece} miếng)` : ''}
                      </div>
                    </div>
                    {v.processSteps.length === 0 ? (
                      done
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đã phôi</span>
                        : <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>chưa khai công đoạn</span>
                    ) : done ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đã phôi</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 260 }}>
                        {undoneSteps.length === 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ chốt</span>
                        ) : undoneSteps.map(step => (
                          <span key={step} style={{ fontSize: 11, fontWeight: 700, color: PURPLE, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                            {PROCESS_STEP_LABELS[step]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
      )}

      {tab === 'matrix' && (
        <PieceStepMatrix items={matrixItems} onSelectPiece={key => setSelVatTuTpKey(key)} />
      )}
    </div>
  )
}

// ── Ma trận mảnh × công đoạn (2026-09-07, đề xuất UX sau khi bỏ ràng buộc thứ tự) - nhìn 1 phát
// thấy công đoạn nào tụt lại + phát hiện bất thường kiểu "Tán 10/10 nhưng Cắt mới 3/10" (chính là
// cơ chế thay cho ràng buộc thứ tự đã bỏ, xem PieceStepBundle doc comment BE) - KHÔNG chặn gì,
// thuần hiển thị để QLSX/KCS tự đối chiếu, đúng tinh thần "xảy ra vấn đề mình xử lý" của Sếp. ───
function PieceStepMatrix({ items, onSelectPiece }: {
  items: VatTuTpItem[]; onSelectPiece: (key: string) => void
}) {
  // Cột = union processSteps của MỌI mảnh trong bảng, theo ĐÚNG thứ tự nghiệp vụ PROCESS_STEPS -
  // các mảnh có thể khai tập công đoạn khác nhau (vd mảnh A chỉ Cắt+Tán, mảnh B Cắt+Uốn+Dập).
  const columns = PROCESS_STEPS.filter(s => items.some(v => v.processSteps.includes(s)))

  return (
    <div style={{ ...card, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
        <thead>
          <tr style={{ background: 'var(--surface)' }}>
            <th style={th}>Mảnh</th>
            {columns.map(c => <th key={c} style={{ ...thR, minWidth: 84 }}>{PROCESS_STEP_LABELS[c]}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map(v => {
            const key = `${v.orderId}:${v.pieceId}`
            return (
              <tr key={key} onClick={() => onSelectPiece(key)}
                style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{v.pieceName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{v.poNumber}</div>
                </td>
                {columns.map((c, ci) => {
                  if (!v.processSteps.includes(c)) {
                    return <td key={c} style={{ ...tdR, color: 'var(--border)' }}>—</td>
                  }
                  const sp = v.stepProgress.find(x => x.step === c)
                  const required = sp?.requiredQty ?? v.plannedQty
                  const passed = sp?.passedQty ?? 0
                  const done = sp?.doneQty ?? 0
                  // Cảnh báo (KHÔNG chặn) - bước này đã BÁO (doneQty) vượt số bước LIỀN TRƯỚC đã
                  // được KCS DUYỆT (passedQty) - dấu hiệu công đoạn chạy trước công đoạn nó "cần"
                  // theo processSteps, dù hệ thống không còn ép thứ tự.
                  const prevStep = ci > 0 ? columns[ci - 1] : null
                  const hasPrev = prevStep != null && v.processSteps.includes(prevStep)
                  const prevPassed = hasPrev ? v.stepProgress.find(x => x.step === prevStep)?.passedQty ?? 0 : 0
                  const warn = hasPrev && done > prevPassed
                  const color = passed >= required && required > 0 ? GREEN : passed > 0 ? AMBER : 'var(--text3)'
                  return (
                    <td key={c} style={{ ...tdR, color, fontWeight: 700 }}>
                      <span title={warn ? `Đã báo ${done} nhưng công đoạn trước mới duyệt ${prevPassed} - đối chiếu lại` : undefined}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {warn && <AlertTriangle size={12} color={RED} />}
                        {passed}/{required}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Chi tiết 1 LOẠI SẮT (2026-09-05) — gộp mọi lần kho giao (xem comment đầu file), liệt kê CÁC
// ĐỢT CẮT bên trong. Mỗi đợt tự trạng thái riêng (CUTTING/AWAITING_QC/QC_PASSED) nên cắt xong đợt
// nào gửi KCS đợt đó, sắt giao bù vẫn cắt tiếp bình thường dù đợt trước đã/đang qua KCS.
//
// Công đoạn phụ (Uốn/Dập/...) của 1 đợt cắt (2026-09-07, thay cơ chế cờ tự khai completeBundleStep
// cũ) - mỗi công đoạn tự gửi KCS RIÊNG theo cỡ đoạn (StepBundleSection trong CutBundleCard),
// KHÔNG chờ Cắt hay công đoạn khác xong trước (quyết định nghiệp vụ 2026-09-07, xem StepBundle
// doc comment BE).
function MaterialGroupDetail({ group, readOnly, reviewByBundle, reviewByStepBundle, progress, onBack, onRefetch, onOpenCuttingGuide }: {
  group: MaterialGroup; readOnly: boolean; reviewByBundle: Map<string, BeQcReview>
  reviewByStepBundle: Map<string, BeQcReview>
  progress: BePhoiProgressItem | null
  onBack: () => void; onRefetch: () => void
  onOpenCuttingGuide?: (productionInvoiceId: string) => void
}) {
  const [busyBundleId, setBusyBundleId] = useState<string | null>(null)
  const [err, setErr] = useState('')

  // Issue đích để gắn đợt cắt MỚI/CỘNG DỒN vào. ƯU TIÊN issue nào ĐANG CÓ đợt cắt mở (status
  // CUTTING) - backend cộng dồn (recordCutBatch) tìm đợt mở THEO ĐÚNG steelIssueId, group có thể
  // gồm NHIỀU issue (nhiều lần kho giao) nên nếu cứ lấy issue ĐẦU TIÊN "khác ISSUED" một cách mù
  // quáng, có thể trúng nhầm 1 issue KHÁC issue đang giữ đợt mở - "Lưu đợt cắt" tưởng cộng dồn
  // nhưng lại tạo ra đợt MỚI dưới issue sai (bug thật phát hiện 2026-09-07 khi test "Hoàn tác": 2
  // issue cùng "khác ISSUED", đợt đang mở nằm ở issue A nhưng .find() chọn issue B trước). Không
  // issue nào đang có đợt mở (mọi đợt đã "Báo cắt xong"/QC_PASSED, hoặc lần đầu tiên chưa có đợt
  // nào) thì mới rơi về "issue đầu tiên đã xác nhận nhận" (khác ISSUED) để bắt đầu đợt mới - roll-up
  // status AWAITING_QC/QC_PASSED chỉ là hiển thị (xem SteelIssuesService.syncIssueStatusFromBundles),
  // backend chỉ thật sự chặn khi issue còn ISSUED - chưa nhận.
  const targetIssue =
    group.issues.find(i => i.status !== 'ISSUED' && group.bundles.some(b => b.steelIssueId === i.id && b.status === 'CUTTING'))
    ?? group.issues.find(i => i.status !== 'ISSUED')
    ?? null
  const isReturn = group.issues.some(i => i.status === 'RECEIVED' && !!i.reworkOfId)

  const bundlesSorted = useMemo(() => {
    const rank = (s: string) => (s === 'CUTTING' ? 0 : s === 'AWAITING_QC' ? 1 : 2)
    return [...group.bundles].sort((a, b) => {
      const r = rank(a.status) - rank(b.status)
      return r !== 0 ? r : b.createdAt.localeCompare(a.createdAt)
    })
  }, [group.bundles])

  // "Đợt N" đánh số theo thứ tự TẠO RA (cũ nhất = Đợt 1), KHÔNG theo thứ tự hiển thị ở
  // `bundlesSorted` (ưu tiên đợt đang cắt/chờ KCS lên đầu) - nếu đánh số theo vị trí hiển thị, số
  // của 1 đợt sẽ nhảy lung tung mỗi khi đợt khác đổi trạng thái. 2026-09-07, theo góp ý người dùng
  // - "4 cỡ đoạn · 8 đoạn" là thống kê, không cho biết ĐANG XEM đợt nào, khó nói chuyện ("đợt 2 bị
  // gì đó") hơn hẳn đánh số.
  const orderIndexByBundleId = useMemo(() => {
    const byCreatedAsc = [...group.bundles].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return new Map(byCreatedAsc.map((b, i) => [b.id, i + 1]))
  }, [group.bundles])

  const doFinishBundle = async (bundleId: string) => {
    setBusyBundleId(bundleId); setErr('')
    try { await api.finishCutBundle(bundleId); onRefetch() }
    catch (e) { setErr(errMsg(e, 'Không mời KCS được')) }
    finally { setBusyBundleId(null) }
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {group.materialName}
            {isReturn && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: RED }}><RotateCcw size={11} /> KCS trả về</span>}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {group.totalBarCount} cây × {group.barLengthMm.toLocaleString('vi-VN')}mm
          </div>
        </div>
      </div>

      <NewCutBundleForm
        targetIssue={targetIssue} progress={progress} readOnly={readOnly}
        bundles={group.bundles} reviewByBundle={reviewByBundle}
        onOpenCuttingGuide={onOpenCuttingGuide && targetIssue ? () => onOpenCuttingGuide(targetIssue.productionInvoiceId) : undefined}
        onCreated={onRefetch}
      />

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Các đợt cắt ({bundlesSorted.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bundlesSorted.map(b => (
            <CutBundleCard
              key={b.id} bundle={b} orderIndex={orderIndexByBundleId.get(b.id) ?? 0}
              readOnly={readOnly} review={reviewByBundle.get(b.id)}
              reviewByStepBundle={reviewByStepBundle}
              busy={busyBundleId === b.id}
              onFinish={() => doFinishBundle(b.id)}
              onRefetch={onRefetch}
            />
          ))}
          {bundlesSorted.length === 0 && (
            <div style={{ ...card, padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              {targetIssue ? 'Chưa nhập đợt cắt nào - nhập cỡ đoạn ở trên để tạo đợt đầu tiên.' : 'Chưa nhận sắt - xác nhận nhận ở "Xác nhận nhận sắt" trước.'}
            </div>
          )}
        </div>
      </div>

      {err && <div style={{ marginTop: 12, fontSize: 12, color: RED }}>{err}</div>}
    </div>
  )
}

// ── Form "Lưu đợt cắt" + bảng "Cần/Đã cắt/Lỗi/Còn lại" tham khảo (2026-09-05, sửa 2026-09-06) ──
// Bảng chỉ mang tính THAM KHẢO tổng thể (Σ mọi đợt cắt của material này trong cả PI, PI-wide -
// đúng quy ước có từ trước, không tách theo từng đợt) và không chặn lưu thêm dù "Còn lại" đã về 0
// (kiểm soát dồn về KCS, cùng triết lý module này đã áp dụng nhiều lần).
//
// Cột "Lỗi" LUÔN hiện (không ẩn/hiện theo điều kiện) - lúc viết lại màn này (2026-09-05) đã lỡ bỏ
// mất cột này cùng phần trừ `failed` khi tính "Còn lại", tưởng lỗi giờ chỉ cần xem ở CutBundleCard
// (từng đợt cắt riêng) là đủ. Khôi phục lại (2026-09-06, theo góp ý người dùng) vì 2 vai trò khác
// nhau: CutBundleCard cho biết ĐÚNG ĐỢT nào đang lỗi để Phôi "Bù đủ", còn cột "Lỗi" ở đây cho biết
// NGAY TỪ ĐẦU (không cần mở từng đợt) tổng số đoạn cỡ này đang lỗi TRÊN CẢ PI - `remaining` PHẢI
// trừ lại `failed` (đoạn lỗi chưa bù không tính là "đã xong"), khớp PhoiProgressSegmentDto.failed.
//
// "Lưu đợt cắt" (2026-09-06): mỗi lần bấm CỘNG DỒN vào đợt đang mở (CUTTING) của targetIssue nếu
// có - Phôi khai rải nhiều lần trong ca vẫn tính là 1 đợt. Chỉ khi bấm "Báo cắt xong"
// (CutBundleCard) đợt đó mới chốt và lần lưu tiếp theo mới bắt đầu đợt MỚI. Quyết định gộp/tách
// nằm hoàn toàn ở backend (SteelIssuesService.recordCutBatch) - FE không cần biết trước đây là
// cộng dồn hay tạo mới, chỉ cần refetch sau khi lưu.
//
// "Cách cắt gợi ý" (2026-08-25, bỏ) - phương án cắt KHÔNG phải gợi ý, là BẮT BUỘC theo đúng
// solver đã duyệt. Bảng chip gọn khó nhìn khi nhiều cỡ và không in được, thay bằng liên kết sang
// màn riêng "Hướng dẫn cắt" (sidebar, HuongDanCatPage.tsx) - bảng lưới ô-theo-ô + xuất Excel.
//
// "Bù đủ" ngay tại cột "Lỗi" (2026-09-07, theo góp ý người dùng) - trước đây CHỈ bấm được trong
// từng CutBundleCard riêng (phải biết đúng đợt nào lỗi). "Lỗi" ở bảng này là TỔNG trên cả PI, có
// thể gộp từ NHIỀU đợt cắt cùng lỗi 1 cỡ đoạn cùng lúc - popup chỉ hỏi 1 số duy nhất (Phôi không
// cần biết khái niệm "đợt cắt"), hệ thống tự phân bổ xuống từng đợt theo `allocateQty()` (đợt cũ
// nhất trước). Bỏ qua các đợt ĐANG chờ KCS duyệt lại (phoiReportedAt != null) - không báo lại được.
function findBuDuRowsForSegment(
  segmentSpecId: string, bundles: BeCutBundle[], reviewByBundle: Map<string, BeQcReview>,
): { rows: { bundleId: string; outstanding: number; createdAt: string }[]; availableTotal: number; pendingTotal: number } {
  const rows: { bundleId: string; outstanding: number; createdAt: string }[] = []
  let pendingTotal = 0
  const passed = bundles.filter(b => b.status === 'QC_PASSED')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)) // đợt cũ nhất trước (FIFO)
  for (const b of passed) {
    const seg = reviewByBundle.get(b.id)?.segments.find(s => s.segmentSpecId === segmentSpecId)
    if (!seg) continue
    const outstanding = seg.failedQty - seg.resolvedQty
    if (outstanding <= 0) continue
    if (seg.phoiReportedAt) { pendingTotal += outstanding; continue }
    rows.push({ bundleId: b.id, outstanding, createdAt: b.createdAt })
  }
  return { rows, availableTotal: rows.reduce((s, r) => s + r.outstanding, 0), pendingTotal }
}

function allocateQty(rows: { bundleId: string; outstanding: number }[], qty: number): { bundleId: string; qty: number }[] {
  let remaining = qty
  const alloc: { bundleId: string; qty: number }[] = []
  for (const r of rows) {
    if (remaining <= 0) break
    const take = Math.min(r.outstanding, remaining)
    alloc.push({ bundleId: r.bundleId, qty: take })
    remaining -= take
  }
  return alloc
}

// Hiện rõ phân bổ khi lỗi rải ở TỪ 2 ĐỢT CẮT trở lên (2026-09-07, theo góp ý người dùng) - trước
// đó allocateQty() chia xuống từng đợt "âm thầm", Phôi không biết đợt nào nhận bao nhiêu. Trường
// hợp thường gặp (đúng 1 đợt) giữ nguyên gọn, không hiện gì thêm - chỉ hiện khi thực sự cần phân
// biệt (rows.length > 1) để không làm rối luồng đơn giản.
function BuDuPopup({ cutLengthMm, rows, busy, error, onSubmit, onClose }: {
  cutLengthMm: number
  rows: { bundleId: string; outstanding: number; createdAt: string }[]
  busy: boolean; error: string
  onSubmit: (qty: number) => void; onClose: () => void
}) {
  const maxQty = rows.reduce((s, r) => s + r.outstanding, 0)
  const [qty, setQty] = useState(String(maxQty))
  const n = Math.floor(Number(qty))
  const invalid = !(n >= 1 && n <= maxQty)
  const alloc = allocateQty(rows, n).filter(a => a.qty > 0)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ ...card, width: 300, padding: 18 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Bù đủ — {cutLengthMm.toLocaleString('vi-VN')}mm</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Đang lỗi {maxQty} đoạn - nhập số đã sửa xong (KCS sẽ kiểm tra lại trước khi tính đạt).
        </div>
        <input type="number" min={1} max={maxQty} value={qty} autoFocus
          onChange={e => setQty(e.target.value)} style={{ ...inp, width: '100%', marginBottom: 8, boxSizing: 'border-box' }} />
        {rows.length > 1 && !invalid && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
            Sẽ phân bổ: {alloc.map(a => {
              const r = rows.find(x => x.bundleId === a.bundleId)!
              return `đợt ${new Date(r.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} → ${a.qty}`
            }).join(', ')}
          </div>
        )}
        {error && <div style={{ color: RED, fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} disabled={busy}
            style={{ ...smallBtn, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: busy ? 'not-allowed' : 'pointer' }}>
            Hủy
          </button>
          <button onClick={() => !invalid && onSubmit(n)} disabled={busy || invalid}
            style={{ ...smallBtn, background: ACCENT, cursor: busy || invalid ? 'not-allowed' : 'pointer' }}>
            {busy ? '...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NewCutBundleForm({ targetIssue, progress, readOnly, bundles, reviewByBundle, onOpenCuttingGuide, onCreated }: {
  targetIssue: BeSteelIssue | null; progress: BePhoiProgressItem | null; readOnly: boolean
  bundles: BeCutBundle[]; reviewByBundle: Map<string, BeQcReview>
  onOpenCuttingGuide?: () => void; onCreated: () => void
}) {
  const [rowInputs, setRowInputs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [buDuTarget, setBuDuTarget] = useState<{
    segmentSpecId: string; cutLengthMm: number
    rows: { bundleId: string; outstanding: number; createdAt: string }[]
  } | null>(null)
  const [buDuBusy, setBuDuBusy] = useState(false)
  const [buDuErr, setBuDuErr] = useState('')
  // "Hoàn tác" lần "Lưu đợt cắt" GẦN NHẤT (2026-09-07) - chỉ 1 cấp, tự mất khi lưu lần tiếp theo
  // (bị ghi đè) hoặc bấm Hoàn tác xong. Sống trong state cục bộ - rời màn/refresh là mất, đúng ý
  // "chỉ dùng ngay sau khi lỡ tay", không phải sổ nhật ký chỉnh sửa lâu dài.
  const [lastSaved, setLastSaved] = useState<{
    bundleId: string; segments: { segmentSpecId: string; qty: number; cutLengthMm: number }[]
  } | null>(null)
  const [undoBusy, setUndoBusy] = useState(false)
  const [undoErr, setUndoErr] = useState('')

  const segments = progress?.segments ?? []
  const canSubmit = !readOnly && !!targetIssue

  const submitBuDu = async (qty: number) => {
    if (!buDuTarget) return
    const alloc = allocateQty(buDuTarget.rows, qty)
    setBuDuBusy(true); setBuDuErr('')
    try {
      for (const a of alloc) await api.reportSegmentDoneForBundle(a.bundleId, buDuTarget.segmentSpecId, a.qty)
      setBuDuTarget(null)
      onCreated()
    } catch (e) { setBuDuErr(errMsg(e, 'Không báo được')) }
    finally { setBuDuBusy(false) }
  }

  const submit = async () => {
    if (!targetIssue) return
    const rows = segments
      .map(s => ({ segmentSpecId: s.segmentSpecId, qty: Math.floor(Number(rowInputs[s.segmentSpecId]) || 0) }))
      .filter(r => r.qty > 0)
    if (rows.length === 0) { setErr('Nhập ít nhất 1 cỡ đoạn đã cắt được'); return }
    setBusy(true); setErr(''); setUndoErr('')
    try {
      const bundle = await api.recordCutBatch(targetIssue.id, { segments: rows })
      setRowInputs({})
      setLastSaved({
        bundleId: bundle.id,
        segments: rows.map(r => ({
          ...r, cutLengthMm: segments.find(s => s.segmentSpecId === r.segmentSpecId)?.cutLengthMm ?? 0,
        })),
      })
      onCreated()
    } catch (e) { setErr(errMsg(e, 'Không lưu được đợt cắt - kiểm lại số liệu')) }
    finally { setBusy(false) }
  }

  const undo = async () => {
    if (!lastSaved) return
    setUndoBusy(true); setUndoErr('')
    try {
      await api.undoLastCutBatch(lastSaved.bundleId, lastSaved.segments.map(s => ({ segmentSpecId: s.segmentSpecId, qty: s.qty })))
      setLastSaved(null)
      onCreated()
    } catch (e) { setUndoErr(errMsg(e, 'Không hoàn tác được')) }
    finally { setUndoBusy(false) }
  }

  if (!progress) return <LoadingState />

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
        Cần cắt theo định mức lệnh này (tổng cả PI, tham khảo):
      </div>
      <div style={{ ...card, marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={th}>Cỡ đoạn</th>
              <th style={thR}>Cần</th>
              <th style={thR}>Đã cắt</th>
              <th style={thR}>Lỗi</th>
              <th style={thR}>Còn lại</th>
              {canSubmit && <th style={{ ...thR, width: 100 }}>Nhập đợt này</th>}
            </tr>
          </thead>
          <tbody>
            {segments.map(s => {
              const remaining = s.required - (s.done - s.failed)
              const buDu = s.failed > 0 && !readOnly ? findBuDuRowsForSegment(s.segmentSpecId, bundles, reviewByBundle) : null
              return (
                <tr key={s.segmentSpecId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{s.cutLengthMm.toLocaleString('vi-VN')}mm</td>
                  <td style={tdR}>{s.required}</td>
                  <td style={tdR}>{s.done}</td>
                  <td style={{ ...tdR, color: s.failed > 0 ? RED : 'var(--text3)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span>{s.failed > 0 ? s.failed : '—'}</span>
                      {buDu && buDu.availableTotal > 0 && (
                        <button
                          onClick={() => setBuDuTarget({ segmentSpecId: s.segmentSpecId, cutLengthMm: s.cutLengthMm, rows: buDu.rows })}
                          style={{ ...smallBtn, padding: '2px 8px', fontSize: 11, background: ACCENT, cursor: 'pointer' }}>
                          Bù đủ
                        </button>
                      )}
                      {buDu && buDu.availableTotal === 0 && buDu.pendingTotal > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: AMBER }}>chờ KCS</span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...tdR, color: remaining > 0 ? ACCENT : GREEN, fontWeight: 700 }}>{remaining > 0 ? remaining : 0}</td>
                  {canSubmit && (
                    <td style={{ ...td, textAlign: 'right' }}>
                      <input type="number" min={0} placeholder="0" value={rowInputs[s.segmentSpecId] ?? ''}
                        onChange={e => setRowInputs(r => ({ ...r, [s.segmentSpecId]: e.target.value }))}
                        style={inp} />
                    </td>
                  )}
                </tr>
              )
            })}
            {segments.length === 0 && (
              <tr><td colSpan={canSubmit ? 6 : 5} style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                Chưa xác định được định mức cho loại sắt này
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && !targetIssue && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Chưa có lô sắt nào đã nhận - xác nhận nhận ở &quot;Xác nhận nhận sắt&quot; trước khi lưu đợt cắt.
        </div>
      )}
      {canSubmit && segments.length > 0 && (
        <button onClick={submit} disabled={busy}
          style={{ ...smallBtn, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy ? 'not-allowed' : 'pointer', marginBottom: 4 }}>
          <Plus size={13} /> {busy ? '...' : 'Lưu đợt cắt'}
        </button>
      )}
      {err && <div style={{ marginTop: 8, fontSize: 12, color: RED }}>{err}</div>}

      {/* "Hoàn tác" lần lưu gần nhất (2026-09-07) - biến mất ngay khi lưu lần tiếp theo (lastSaved
          bị ghi đè) hoặc bấm Hoàn tác xong; KHÔNG phải sổ nhật ký nhiều lượt. */}
      {lastSaved && !readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 4, fontSize: 12, color: 'var(--text3)' }}>
          <span>
            Đã lưu: {lastSaved.segments.map(s => `+${s.qty}×${s.cutLengthMm.toLocaleString('vi-VN')}mm`).join(', ')}
          </span>
          <button onClick={undo} disabled={undoBusy}
            style={{ background: 'none', border: 'none', padding: 0, color: ACCENT, fontWeight: 600, cursor: undoBusy ? 'not-allowed' : 'pointer', fontSize: 12 }}>
            {undoBusy ? '...' : 'Hoàn tác'}
          </button>
          <button onClick={() => setLastSaved(null)} disabled={undoBusy}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text3)', cursor: undoBusy ? 'not-allowed' : 'pointer' }}>
            <X size={13} />
          </button>
        </div>
      )}
      {undoErr && <div style={{ marginTop: 4, fontSize: 12, color: RED }}>{undoErr}</div>}

      {onOpenCuttingGuide && (
        <button onClick={onOpenCuttingGuide}
          style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', padding: 0, marginTop: 10, fontSize: 12, fontWeight: 600, color: ACCENT, cursor: 'pointer' }}>
          <Ruler size={13} /> Xem hướng dẫn cắt đầy đủ (bắt buộc theo đúng phương án đã duyệt, xuất được để in) →
        </button>
      )}

      {buDuTarget && (
        <BuDuPopup cutLengthMm={buDuTarget.cutLengthMm} rows={buDuTarget.rows} busy={buDuBusy} error={buDuErr}
          onClose={() => { setBuDuTarget(null); setBuDuErr('') }}
          onSubmit={submitBuDu} />
      )}
    </div>
  )
}

// ── 1 ĐỢT CẮT cụ thể - segments đã khai + trạng thái riêng + hành động tương ứng ─────────────
//
// "Bù đủ" cho LỖI CẮT KHÔNG còn bấm được ở đây (2026-09-07, theo góp ý người dùng - 2 điểm hành
// động cho cùng 1 việc gây phân vân bấm chỗ nào) - dồn hẳn về cột "Lỗi" ở bảng tổng trong
// `NewCutBundleForm` (đã xử lý đúng cả trường hợp 1 đợt lẫn nhiều đợt qua
// `findBuDuRowsForSegment`/`allocateQty`). Riêng "Bù đủ" cho công đoạn PHỤ (StepBundleSection bên
// dưới) VẪN bấm ngay tại đây - mỗi StepBundle của đợt này chỉ có 1 nơi hiện, không có bảng tổng
// nào khác gộp lỗi công đoạn phụ theo cỡ đoạn để dồn về (khác trường hợp lỗi Cắt).
function CutBundleCard({ bundle, orderIndex, readOnly, review, reviewByStepBundle, busy, onFinish, onRefetch }: {
  bundle: BeCutBundle; orderIndex: number; readOnly: boolean; review?: BeQcReview
  reviewByStepBundle: Map<string, BeQcReview>; busy: boolean
  onFinish: () => void; onRefetch: () => void
}) {
  const segs = review?.segments ?? []
  const outstanding = segs.reduce((s, x) => s + (x.failedQty - x.resolvedQty), 0)
  // Xổ ra/vào bảng chi tiết cỡ đoạn (2026-09-07, theo góp ý người dùng) - dòng tóm tắt cũ nối
  // "N×cỡmm" bằng " + " dài dằng dặc khi đợt có nhiều cỡ, khó đọc. Mặc định GỌN (đóng), TRỪ KHI
  // đợt đang có lỗi (outstanding > 0) - lúc đó tự bung sẵn để Phôi thấy ngay cột "Lỗi" không cần
  // bấm thêm (cột Lỗi giờ nằm TRONG bảng, gộp cùng "Số lượng" theo đúng cỡ đoạn - 2026-09-07, theo
  // góp ý người dùng lần 2, thay vì tách rời 1 dòng riêng phía dưới bảng như bản đầu).
  const [expanded, setExpanded] = useState(outstanding > 0)
  // Công đoạn phụ bắt buộc của loại sắt này (2026-09-07, KHÔNG còn chặn "Báo cắt xong" - mỗi công
  // đoạn tự gửi KCS riêng, hiện panel bất kể bundle.status vì không còn ràng buộc thứ tự).
  const secondarySteps = bundle.requiredSteps.filter(s => s !== 'CAT')
  const totalQty = bundle.segments.reduce((s, x) => s + x.qty, 0)

  return (
    <div style={{ ...card, borderColor: outstanding > 0 ? RED : undefined, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        {expanded ? <ChevronDown size={15} color="var(--text3)" /> : <ChevronRight size={15} color="var(--text3)" />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Đợt {orderIndex}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {bundle.segments.length} cỡ đoạn · {totalQty} đoạn · {new Date(bundle.createdAt).toLocaleString('vi-VN')}
          </div>
        </div>
        {bundle.status === 'CUTTING' ? (
          <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>đang cắt</span>
        ) : bundle.status === 'AWAITING_QC' ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ KCS</span>
        ) : outstanding > 0 ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: RED }}>Lỗi {outstanding} đoạn</span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đã duyệt</span>
        )}
      </div>

      {expanded && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={th}>Cỡ đoạn</th>
              <th style={thR}>Số lượng</th>
              {/* Cột "Lỗi" ngay cạnh "Số lượng" (2026-09-07, theo góp ý người dùng) - trước để
                  riêng 1 dòng tách rời phía dưới bảng, cùng 1 cỡ đoạn nhưng lỗi hiện ở nơi khác
                  hẳn số lượng gây khó theo dõi. Chỉ thêm cột này khi đợt CÓ lỗi (outstanding > 0)
                  - đa số đợt không lỗi, không cần thêm cột thừa. */}
              {outstanding > 0 && <th style={thR}>Lỗi</th>}
            </tr>
          </thead>
          <tbody>
            {bundle.segments.map(s => {
              const rev = segs.find(x => x.segmentSpecId === s.segmentSpecId)
              const segOutstanding = rev ? rev.failedQty - rev.resolvedQty : 0
              return (
                <tr key={s.segmentSpecId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{s.cutLengthMm.toLocaleString('vi-VN')}mm</td>
                  <td style={tdR}>{s.qty}</td>
                  {outstanding > 0 && (
                    <td style={{ ...tdR, color: segOutstanding > 0 ? RED : 'var(--text3)' }}>
                      {segOutstanding > 0 ? (
                        <>
                          lỗi {segOutstanding}
                          {rev?.phoiReportedAt && <span style={{ color: AMBER, fontWeight: 600 }}> · chờ KCS</span>}
                        </>
                      ) : '—'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {bundle.status === 'CUTTING' && !readOnly && (
        <button onClick={onFinish} disabled={busy}
          style={{
            ...smallBtn, marginTop: 10, cursor: busy ? 'not-allowed' : 'pointer',
            background: GREEN, color: '#fff', border: 'none',
          }}>
          {busy ? '...' : 'Báo cắt xong'}
        </button>
      )}

      {secondarySteps.map(step => (
        <StepBundleSection
          key={step} cutBundle={bundle} step={step} readOnly={readOnly}
          reviewByStepBundle={reviewByStepBundle} onRefetch={onRefetch}
        />
      ))}

    </div>
  )
}

// ── Gửi KCS cho 1 CÔNG ĐOẠN PHỤ (Uốn/Dập/Tán/...) của 1 đợt cắt cụ thể (2026-09-07) - nhập số
// lượng theo cỡ đoạn rồi gửi KCS trong CÙNG 1 lần bấm (gộp recordStepBatch + submitStepBundle) -
// không tách 2 bước "lưu đợt"/"gửi" riêng như Cắt, vì chưa có nguồn dữ liệu nào đọc được "đã lưu
// nhưng CHƯA gửi" theo đúng đợt cắt (khác Cắt: bảng NewCutBundleForm đọc PhoiProgress PI-wide).
// KCS chấm CHỈ Đạt/Không đạt (mirror hành vi gốc của Cắt/Sắt, KHÔNG có "sửa được/phế"). KHÔNG chờ
// Cắt hay công đoạn phụ khác xong trước (quyết định nghiệp vụ 2026-09-07).
function StepBundleSection({ cutBundle, step, readOnly, reviewByStepBundle, onRefetch }: {
  cutBundle: BeCutBundle; step: ProcessStep; readOnly: boolean
  reviewByStepBundle: Map<string, BeQcReview>; onRefetch: () => void
}) {
  const [qtyBySpec, setQtyBySpec] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [buDuTarget, setBuDuTarget] = useState<{ stepBundleId: string; segmentSpecId: string; outstanding: number } | null>(null)
  const [buDuQty, setBuDuQty] = useState('')
  const [buDuBusy, setBuDuBusy] = useState(false)

  const stepBundles = [...cutBundle.stepBundles.filter(sb => sb.step === step)]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

  const send = async () => {
    const segments = cutBundle.segments
      .map(s => ({ segmentSpecId: s.segmentSpecId, qty: Math.floor(Number(qtyBySpec[s.segmentSpecId]) || 0) }))
      .filter(s => s.qty > 0)
    if (segments.length === 0) { setErr(`Nhập số đoạn đã ${PROCESS_STEP_LABELS[step].toLowerCase()}`); return }
    setBusy(true); setErr('')
    try {
      await api.recordStepBatch(cutBundle.id, { step, segments })
      await api.submitStepBundle(cutBundle.id, step)
      setQtyBySpec({}); onRefetch()
    } catch (e) { setErr(errMsg(e, 'Không gửi KCS được')) }
    finally { setBusy(false) }
  }

  const submitBuDu = async () => {
    if (!buDuTarget) return
    const q = Math.max(1, Math.min(buDuTarget.outstanding, Math.floor(Number(buDuQty) || 0)))
    setBuDuBusy(true); setErr('')
    try {
      await api.reportSegmentDoneForStepBundle(buDuTarget.stepBundleId, buDuTarget.segmentSpecId, q)
      setBuDuTarget(null); setBuDuQty(''); onRefetch()
    } catch (e) { setErr(errMsg(e, 'Không báo được')) }
    finally { setBuDuBusy(false) }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text2)' }}>{PROCESS_STEP_LABELS[step]}</div>

      {stepBundles.map(sb => {
        const rv = reviewByStepBundle.get(sb.id)
        const rvSegs = rv?.segments ?? []
        const totalSbQty = sb.segments.reduce((s, x) => s + x.qty, 0)
        const errRows = sb.segments
          .map(s => ({ s, rv: rvSegs.find(x => x.segmentSpecId === s.segmentSpecId) }))
          .filter(({ rv }) => rv && rv.failedQty - rv.resolvedQty > 0)
        return (
          <div key={sb.id} style={{ fontSize: 12, marginBottom: 5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text3)' }}>
              {totalSbQty} đoạn · {new Date(sb.submittedAt).toLocaleString('vi-VN')}
            </span>
            {sb.status === 'AWAITING_QC' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: AMBER }}><Clock size={11} /> chờ KCS</span>
            ) : errRows.length > 0 ? (
              errRows.map(({ s, rv }) => {
                const segOutstanding = rv!.failedQty - rv!.resolvedQty
                return (
                  <span key={s.segmentSpecId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: RED, fontWeight: 700 }}>
                    lỗi {segOutstanding} ({s.cutLengthMm.toLocaleString('vi-VN')}mm)
                    {rv!.phoiReportedAt ? (
                      <span style={{ color: AMBER, fontWeight: 600 }}>· chờ KCS duyệt lại</span>
                    ) : !readOnly ? (
                      <button
                        onClick={() => { setBuDuTarget({ stepBundleId: sb.id, segmentSpecId: s.segmentSpecId, outstanding: segOutstanding }); setBuDuQty(String(segOutstanding)); setErr('') }}
                        style={{ ...smallBtn, padding: '2px 8px', background: ACCENT }}
                      >
                        Bù đủ
                      </button>
                    ) : null}
                  </span>
                )
              })
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: GREEN }}><Check size={11} /> đã duyệt</span>
            )}
          </div>
        )
      })}

      {buDuTarget && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8 }}>
          <input type="number" min={1} max={buDuTarget.outstanding} value={buDuQty} onChange={e => setBuDuQty(e.target.value)} style={{ ...inp, width: 70 }} autoFocus />
          <button onClick={submitBuDu} disabled={buDuBusy} style={{ ...smallBtn, background: GREEN, cursor: buDuBusy ? 'not-allowed' : 'pointer' }}>{buDuBusy ? '...' : 'Xác nhận'}</button>
          <button onClick={() => setBuDuTarget(null)} style={{ ...smallBtn, background: 'var(--surface2)', color: 'var(--text)' }}>Hủy</button>
        </div>
      )}

      {!readOnly && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 4 }}>
          {cutBundle.segments.map(s => (
            <label key={s.segmentSpecId} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text2)' }}>
              {s.cutLengthMm.toLocaleString('vi-VN')}mm
              <input type="number" min={0} placeholder="0" value={qtyBySpec[s.segmentSpecId] ?? ''}
                onChange={e => setQtyBySpec(m => ({ ...m, [s.segmentSpecId]: e.target.value }))}
                style={{ ...inp, width: 56 }} />
            </label>
          ))}
          <button onClick={send} disabled={busy}
            style={{ ...smallBtn, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy ? 'not-allowed' : 'pointer' }}>
            <Send size={12} /> {busy ? '...' : 'Gửi KCS'}
          </button>
        </div>
      )}
      {err && <div style={{ marginTop: 6, fontSize: 12, color: RED }}>{err}</div>}
    </div>
  )
}
