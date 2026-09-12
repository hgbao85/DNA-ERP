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
  ChevronLeft, ChevronRight, ChevronDown, Wrench, Clock, Check, AlertTriangle, RotateCcw, Plus, Ruler, X, Send,
} from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type {
  BeSteelIssue, BeQcReview, BePhoiProgressItem, BeCutBundle, BePiOrderSummary,
  BePhoiProgressSegment, BeStepBundle,
} from '../../../services/steel-issues-api'
import type { BeProductionOrderSummary, BeProductionBatchPlan } from '../../../services/production-batches-api'
import type { ProcessStep } from '../../../types/sku'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import VatTuTpDetail, { type VatTuTpItem } from './VatTuTpDetail'
import {
  ACCENT, GREEN, RED, AMBER, PURPLE, th, thR, td, tdR, card, smallBtn, inp, subFilterBtn,
} from './phoiStyles'

// '—' cho phoiDeadline null (KHSX chưa đặt mốc Phôi cho SKU này) - mirror dateVN() ở
// components/sanxuat/core.tsx (Hàn/Sơn), không import chéo vì file này cố ý độc lập (nối BE thật
// riêng, xem doc comment đầu file).
const dateVN = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN')
}

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
      // Ưu tiên piCode TRƯỚC salesOrderCode (2026-09-11, QA audit C1) - piCode là thuộc tính của
      // CHÍNH PI (mọi issue trong `list` chắc chắn cùng piCode), luôn ổn định bất kể thứ tự mảng.
      // salesOrderCode (PO) thì KHÔNG - 1 PI có thể gộp nhiều PO khác nhau (xem khối "PO/SKU trong
      // PI này" bên dưới), trước đây ưu tiên PO trước khiến nhãn đại diện có thể đổi giữa các lần
      // tải nếu thứ tự `issues` trả về từ BE đổi, và không phản ánh đủ các PO thực sự nằm trong PI.
      poNumber: list[0]?.piCode ?? list[0]?.salesOrderCode ?? vatTuTpItems[0]?.poNumber ?? productionInvoiceId,
      issues: list,
      bundles: piBundles,
      totalIssued: list.reduce((s, i) => s + i.barCount, 0),
      bundlesPending: piBundles.filter(b => b.status !== 'QC_PASSED').length,
      bundlesPassed: piBundles.filter(b => b.status === 'QC_PASSED').length,
      vatTuTpItems,
    }
  })
}

/** Tổng số đoạn còn thiếu (Σ mọi cỡ đoạn) của 1 loại sắt - CÙNG công thức với cột "Còn lại" ở
 *  ProgressBuDuTable (required - (done - failed), không âm). Dùng ở dòng tổng bảng danh sách loại
 *  sắt (2026-09-10, theo góp ý người dùng) - trước đây badge "đã phôi" chỉ nhìn trạng thái đợt cắt
 *  (không có đợt nào đang mở/chờ KCS), KHÔNG so với Cần/Đã làm thật - có thể báo "đã phôi" dù còn
 *  cắt thiếu rất nhiều (chưa ai mở đợt cắt tiếp theo). */
function sumRemaining(progress: BePhoiProgressItem | null | undefined): number {
  return (progress?.segments ?? []).reduce((s, x) => s + Math.max(x.required - (x.done - x.failed), 0), 0)
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
  const { data: issues, isLoading, error, refetch } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(undefined, true), [])
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

  if (isLoading) return <LoadingState />
  // error PHẢI kiểm trước `!issues` (2026-09-11, QA audit B2) - trước đây gate chung
  // `isLoading || !issues` khiến lỗi tải (mất mạng/403) kẹt ở LoadingState vĩnh viễn vì isLoading đã
  // về false nhưng issues vẫn null - không phân biệt được với "đang tải chậm".
  if (error || !issues) return <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />

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
              <th style={th}>PI</th>
              <th style={thR}>Đã xuất (cây)</th>
              <th style={thR}>Cắt sắt</th>
              <th style={thR}>Vật tư TP</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {piRows.map(r => {
              // Đơn vị khác hẳn Sắt (mảnh, không phải cây) - không cộng chung vào cột nào ở trên -
              // chỉ đếm bao nhiêu mảnh ĐÃ ĐƯỢC KCS DUYỆT THẬT (passedQty, KHÔNG cộng awaitingQcQty -
              // 2026-09-10, cùng lý do sửa ở PiDetail/materialGroups: gửi KCS xong nhưng CHƯA duyệt
              // không được tính là xong) trên tổng số mảnh.
              const vatTuTpDoneCount = r.vatTuTpItems.filter(v => v.passedQty >= v.plannedQty).length
              const vatTuTpPending = r.vatTuTpItems.length - vatTuTpDoneCount
              return (
                <tr key={r.productionInvoiceId} onClick={() => setSelPi(r.productionInvoiceId)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{r.poNumber}</td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{r.issues.length > 0 ? r.totalIssued : '—'}</td>
                  {/* "đã phôi" ở CỘT NÀY nghĩa là CẢ PO đã cắt xong (không phải 1 đợt) - 2026-09-10,
                      theo góp ý người dùng: trước đây tách riêng cột "Đã phôi (đợt)" hiện SỐ đợt đã
                      qua KCS (vd "1") - dễ hiểu nhầm "đã phôi" = xong 1 đợt, gộp lại còn 1 cột duy
                      nhất, chữ "đã phôi" CHỈ xuất hiện khi thật sự không còn đợt nào đang cắt/chờ
                      KCS. Vẫn dùng chỉ báo "không còn đợt đang mở" (KHÔNG so remaining=0 như ở
                      PiDetail/materialGroups) - tính remaining=0 thật cho CẢ PI cần fetch progress
                      riêng từng PI, chưa làm ở màn danh sách này, xem changelog nếu muốn nâng cấp. */}
                  <td style={tdR}>
                    {r.bundles.length === 0 ? <span style={{ color: 'var(--text3)' }}>—</span>
                      : r.bundlesPending > 0
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#d97706', fontWeight: 600 }}><Clock size={12} /> {r.bundlesPending} đợt</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a', fontWeight: 700 }}><Check size={12} /> đã phôi</span>}
                  </td>
                  <td style={tdR}>
                    {r.vatTuTpItems.length === 0 ? <span style={{ color: 'var(--text3)' }}>—</span>
                      : vatTuTpPending > 0
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: PURPLE, fontWeight: 600 }}><Wrench size={12} /> đã xong {vatTuTpDoneCount}/{r.vatTuTpItems.length}</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a', fontWeight: 700 }}><Check size={12} /> đã phôi ({r.vatTuTpItems.length})</span>}
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
  // Lịch sử StepBundle của CẢ PI (2026-09-07 lần 2 - không còn gắn với đúng đợt cắt nào, xem
  // BeStepBundle) - MaterialGroupDetail tự lọc theo materialId khi render.
  const { data: stepBundles, refetch: refetchStepBundles } = useFetch<BeStepBundle[]>(
    () => api.getStepBundlesForInvoice(pi.productionInvoiceId), [pi.productionInvoiceId],
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
  const refetchAll = () => { onRefetch(); refetchProgress(); refetchStepBundles() }

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
  const [tab, setTab] = useState<'all' | 'sat' | 'vttp'>(() => materialGroups.length > 0 ? 'sat' : 'vttp')

  const selGroup = selIssueId ? materialGroups.find(g => g.key === selIssueId) ?? null : null
  if (selGroup) {
    return (
      <MaterialGroupDetail
        key={selGroup.key} group={selGroup} readOnly={readOnly} reviewByBundle={reviewByBundle}
        reviewByStepBundle={reviewByStepBundle}
        stepBundles={(stepBundles ?? []).filter(sb => sb.materialId === selGroup.materialId)}
        progress={progressByMaterial.get(selGroup.materialId) ?? null}
        productionInvoiceId={pi.productionInvoiceId}
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
        {/* "PO/SKU trong PI này" (KHÔNG phải "Đợt cắt" - 2026-09-11, QA audit C9): nội dung là
            danh sách PO/SKU của CẢ PI (getPiOrderSummary), không phải 1 đợt cắt (CutBundle) cụ thể -
            tên cũ "Đợt cắt này gồm" dễ nhầm với "Đợt N" đánh số riêng ở màn chi tiết bên dưới. */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>PO/SKU trong PI này</div>
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
                <span style={{ color: 'var(--text3)', marginLeft: 'auto' }}>Deadline {dateVN(o.phoiDeadline)}</span>
                <span style={{ color: 'var(--text3)' }}>SL {o.quantity.toLocaleString('vi-VN')}</span>
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
      </div>

      {(tab === 'sat' || tab === 'all') && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'all' && (
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>Cắt sắt</div>
        )}
        {materialGroups.map(g => {
          // 1 dòng / LOẠI SẮT (2026-09-05, gộp mọi lần kho giao - xem comment đầu file). Trạng
          // thái tổng quát của dòng suy từ tập bundles: có đợt nào đang cắt → "đang cắt", hết đang
          // cắt mà còn đợt chờ KCS → "chờ KCS", ĐÃ CẮT ĐỦ định mức (remaining === 0, xem
          // sumRemaining) → "đã duyệt" - còn thiếu hàng mà không đợt nào đang mở thì "còn thiếu X
          // đoạn" (2026-09-10, theo góp ý người dùng: trước đây chỉ nhìn "không có đợt nào đang mở"
          // mà gọi đã phôi, có thể sai khi còn thiếu rất nhiều nhưng chưa ai mở đợt cắt tiếp theo).
          // Chữ "đã phôi" (2026-09-10 lần 2) chỉ dành cho CẢ PO ở bảng danh sách PI ngoài cùng
          // (piRows.map) - 1 loại sắt xong không có nghĩa cả PO xong, ở đây dùng "đã duyệt". CỐ Ý
          // KHÔNG còn phân biệt theo "outstanding" (lỗi lịch sử) nữa (2026-09-11 lần 2, theo góp ý
          // người dùng "thấy dài dòng quá") - remaining===0 là đủ để hiện gọn "đã duyệt", không cần
          // kèm chú thích lỗi lịch sử đã bù đủ (xem chi tiết từng đợt trong "Các đợt cắt" nếu cần).
          const cuttingCount = g.bundles.filter(b => b.status === 'CUTTING').length
          const awaitingQcCount = g.bundles.filter(b => b.status === 'AWAITING_QC').length
          const remaining = sumRemaining(progressByMaterial.get(g.materialId))
          const hasReceived = g.issues.some(i => i.status !== 'ISSUED')
          const isReturn = g.issues.some(i => i.status === 'RECEIVED' && !!i.reworkOfId)
          return (
            <div key={g.key} style={{ ...card, borderColor: isReturn ? RED : undefined }}>
              <div
                onClick={() => setSelIssueId(g.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer',
                  background: isReturn ? 'var(--red-bg, #fef2f2)' : undefined,
                  // KHÔNG còn đòi outstanding===0 (2026-09-11, cùng lý do sửa badge B1 ở dưới) -
                  // remaining===0 là đủ để coi là "xong", lỗi lịch sử đã bù đủ không cản trạng thái
                  // mờ đi này nữa.
                  opacity: g.bundles.length > 0 && cuttingCount === 0 && awaitingQcCount === 0 && remaining === 0 ? 0.75 : 1,
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
                ) : remaining > 0 ? (
                  // remaining PHẢI kiểm TRƯỚC outstanding (2026-09-11, QA audit B1) - outstanding là
                  // Σ lỗi CỘNG DỒN LỊCH SỬ, KHÔNG BAO GIỜ tự giảm (đúng thiết kế "Bù đủ dồn về bảng
                  // tổng") - trước đây check outstanding trước khiến dòng kẹt đỏ "Lỗi N đoạn" VĨNH
                  // VIỄN dù đã bù đủ + cắt đủ 100% (remaining=0) từ lâu, không bao giờ chuyển "đã
                  // duyệt" được nữa. Còn thiếu hàng (remaining>0) mới là tín hiệu ưu tiên hiển thị.
                  <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>còn thiếu {remaining} đoạn</span>
                ) : (
                  // Đã cắt ĐỦ (remaining=0) → "đã duyệt" (xanh, KHÔNG phải "đã phôi" - dành riêng
                  // cho CẢ PO ở bảng danh sách PI ngoài cùng, xem piRows.map) - dù outstanding lịch
                  // sử >0 vẫn CHỈ hiện gọn "đã duyệt", KHÔNG kèm chú thích "(từng lỗi N đoạn, đã bù
                  // đủ)" nữa (2026-09-11 lần 2, theo góp ý người dùng: "thấy dài dòng quá" - lỗi lịch
                  // sử đã bù đủ không còn ý nghĩa hiển thị nữa khi đã xong, chỉ cần biết "đã duyệt"
                  // là đủ, chi tiết lỗi từng đợt vẫn xem được trong "Các đợt cắt" bên dưới).
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đã duyệt</span>
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
              // "đã duyệt" PHẢI là đã KCS duyệt thật (passedQty), KHÔNG được tính cả awaitingQcQty
              // (2026-09-10, theo góp ý người dùng - trước đây gửi KCS xong, CHƯA duyệt, đã hiện
              // "đã phôi" - cùng dạng lỗi với badge tổng bên Sắt, xem sumRemaining ở trên). Chữ
              // "đã phôi" dành riêng cho bảng danh sách PI (ngoài cùng, xem piRows.map ở trên) -
              // ở CẤP TỪNG MẢNH này dùng "đã duyệt" (theo góp ý người dùng vòng sau, 2026-09-10 lần
              // 2: "phần này không cần đã phôi" - đúng ĐỢT/MẢNH này chỉ là 1 phần của cả công đoạn
              // Phôi, "đã phôi" nên dành cho khi CẢ PO xong, không phải từng mảnh riêng lẻ).
              const passed = v.passedQty >= v.plannedQty
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
                      passed ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đã duyệt</span>
                      ) : v.awaitingQcQty > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ KCS duyệt</span>
                      ) : (
                        <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>chưa khai công đoạn</span>
                      )
                    ) : passed ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đã duyệt</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 260 }}>
                        {undoneSteps.length === 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ KCS duyệt bước cuối</span>
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

    </div>
  )
}

// ── Chi tiết 1 LOẠI SẮT (2026-09-05) — gộp mọi lần kho giao (xem comment đầu file), liệt kê CÁC
// ĐỢT CẮT bên trong. Mỗi đợt tự trạng thái riêng (CUTTING/AWAITING_QC/QC_PASSED) nên cắt xong đợt
// nào gửi KCS đợt đó, sắt giao bù vẫn cắt tiếp bình thường dù đợt trước đã/đang qua KCS.
//
// Công đoạn phụ (Uốn/Dập/...) (2026-09-07 lần 2, xem changelog "Bù đủ dồn về bảng tổng") - KHÔNG
// còn gắn với đúng đợt cắt nào (StepBundle scope PI+vật tư) - mỗi công đoạn có 1 bảng tổng RIÊNG
// (StepBundleForm), "Các đợt cắt"/"Các đợt đã gửi" (lịch sử riêng từng công đoạn) lùi hẳn về thuần
// XEM (không còn nút "Báo cắt xong"/"Bù đủ" nào trong đó - mọi thao tác dồn về các bảng tổng).
//
// Đổi 2026-09-08 (theo góp ý người dùng - xổ dọc hết mọi công đoạn cùng lúc dễ nhầm lịch sử công
// đoạn này với công đoạn khác): CÁC CÔNG ĐOẠN GIỜ LÀ TAB bấm chuyển qua lại (mirror `VatTuTpDetail`
// - cùng `subFilterBtn`), chỉ hiện ĐÚNG 1 bảng tổng + lịch sử của riêng nó tại 1 thời điểm - "Các
// đợt cắt" theo đó tự nằm NGAY DƯỚI bảng tổng Cắt (trong tab Cắt), không còn bị đẩy xuống cuối
// trang sau mọi tab Uốn/Dập như bản trước.
function MaterialGroupDetail({
  group, readOnly, reviewByBundle, reviewByStepBundle, stepBundles, progress, productionInvoiceId,
  onBack, onRefetch, onOpenCuttingGuide,
}: {
  group: MaterialGroup; readOnly: boolean; reviewByBundle: Map<string, BeQcReview>
  reviewByStepBundle: Map<string, BeQcReview>
  stepBundles: BeStepBundle[]
  progress: BePhoiProgressItem | null
  productionInvoiceId: string
  onBack: () => void; onRefetch: () => void
  onOpenCuttingGuide?: (productionInvoiceId: string) => void
}) {
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
  // của 1 đợt sẽ nhảy lung tung mỗi khi đợt khác đổi trạng thái.
  const orderIndexByBundleId = useMemo(() => {
    const byCreatedAsc = [...group.bundles].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return new Map(byCreatedAsc.map((b, i) => [b.id, i + 1]))
  }, [group.bundles])

  // Công đoạn phụ bắt buộc của loại sắt này - lấy từ requiredSteps của bất kỳ đợt cắt nào (cùng
  // giá trị PI+vật tư, xem resolveRequiredSteps() BE) - rỗng nếu CHƯA có đợt cắt nào (chưa có gì
  // để Uốn/Dập/... nên chưa cần hiện bảng nào).
  const secondarySteps = group.bundles[0]?.requiredSteps.filter(s => s !== 'CAT') ?? []
  const tabItems: { key: 'CAT' | ProcessStep; label: string }[] = [
    { key: 'CAT', label: 'Cắt' },
    ...secondarySteps.map(step => ({ key: step, label: PROCESS_STEP_LABELS[step] })),
  ]
  const [activeStep, setActiveStep] = useState<'CAT' | ProcessStep>('CAT')

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

      {tabItems.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {tabItems.map(it => (
            <button key={it.key} onClick={() => setActiveStep(it.key)} style={subFilterBtn(activeStep === it.key)}>
              {it.label}
            </button>
          ))}
        </div>
      )}

      {activeStep === 'CAT' ? (
        <>
          <NewCutBundleForm
            targetIssue={targetIssue} progress={progress} readOnly={readOnly}
            bundles={group.bundles}
            onOpenCuttingGuide={onOpenCuttingGuide && targetIssue ? () => onOpenCuttingGuide(targetIssue.productionInvoiceId) : undefined}
            onCreated={onRefetch}
          />

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Các đợt cắt ({bundlesSorted.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bundlesSorted.map(b => (
                <CutBundleCard
                  key={b.id} bundle={b} orderIndex={orderIndexByBundleId.get(b.id) ?? 0}
                  review={reviewByBundle.get(b.id)}
                />
              ))}
              {bundlesSorted.length === 0 && (
                <div style={{ ...card, padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  {targetIssue ? 'Chưa nhập đợt cắt nào - nhập cỡ đoạn ở trên để tạo đợt đầu tiên.' : 'Chưa nhận sắt - xác nhận nhận ở "Xác nhận nhận sắt" trước.'}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <StepBundleForm
          key={activeStep} productionInvoiceId={productionInvoiceId} materialId={group.materialId} step={activeStep}
          readOnly={readOnly} stepBundles={stepBundles.filter(sb => sb.step === activeStep)}
          reviewByStepBundle={reviewByStepBundle} onRefetch={onRefetch}
        />
      )}
    </div>
  )
}

// ── Bảng "Cần/Đã.../Lỗi/Còn lại" dùng chung cho CẢ Cắt lẫn công đoạn phụ (2026-09-07 lần 2, xem
// changelog "Bù đủ dồn về bảng tổng") - PI-wide, THAM KHẢO tổng thể (Σ mọi đợt của material này
// trong cả PI, không tách theo từng đợt), không chặn nhập thêm dù "Còn lại" đã về 0 (kiểm soát dồn
// về KCS). "Lỗi" là Σ failedQty CỘNG DỒN LỊCH SỬ (không tự giảm) - nút "Bù đủ" chỉ pre-fill ô
// "Nhập đợt này" (client-side, KHÔNG gọi API) khi còn thiếu hàng do lỗi (remaining>0 && failed>0) -
// Phôi tự gõ/sửa số rồi bấm nút Gửi (Lưu đợt cắt/Gửi KCS) của form gọi component này như bình
// thường, không có cơ chế report-done/recheck riêng nào nữa.
function ProgressBuDuTable({ segments, canInput, rowInputs, onInputChange }: {
  segments: BePhoiProgressSegment[]; canInput: boolean
  rowInputs: Record<string, string>; onInputChange: (segmentSpecId: string, value: string) => void
}) {
  return (
    <div style={{ ...card, marginBottom: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface)' }}>
            <th style={th}>Cỡ đoạn</th>
            <th style={thR}>Cần</th>
            <th style={thR}>Đã làm</th>
            <th style={thR}>Lỗi</th>
            <th style={thR}>Còn lại</th>
            {canInput && <th style={{ ...thR, width: 100 }}>Nhập đợt này</th>}
          </tr>
        </thead>
        <tbody>
          {segments.map(s => {
            const remaining = Math.max(s.required - (s.done - s.failed), 0)
            return (
              <tr key={s.segmentSpecId} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={td}>{s.cutLengthMm.toLocaleString('vi-VN')}mm</td>
                <td style={tdR}>{s.required}</td>
                <td style={tdR}>{s.done}</td>
                <td style={{ ...tdR, color: s.failed > 0 ? RED : 'var(--text3)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span>{s.failed > 0 ? s.failed : '—'}</span>
                    {canInput && s.failed > 0 && remaining > 0 && (
                      <button
                        onClick={() => onInputChange(s.segmentSpecId, String(Math.min(s.failed, remaining)))}
                        style={{ ...smallBtn, padding: '2px 8px', fontSize: 11, background: ACCENT, cursor: 'pointer' }}>
                        Bù đủ
                      </button>
                    )}
                  </div>
                </td>
                <td style={{ ...tdR, color: remaining > 0 ? ACCENT : GREEN, fontWeight: 700 }}>{remaining}</td>
                {canInput && (
                  <td style={{ ...td, textAlign: 'right' }}>
                    <input type="number" min={0} placeholder="0" value={rowInputs[s.segmentSpecId] ?? ''}
                      onChange={e => onInputChange(s.segmentSpecId, e.target.value)}
                      style={inp} />
                  </td>
                )}
              </tr>
            )
          })}
          {segments.length === 0 && (
            <tr><td colSpan={canInput ? 6 : 5} style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
              Chưa xác định được định mức
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Bảng tổng Cắt: "Lưu đợt cắt" (cộng dồn) + "Gửi KCS" (báo cắt xong đợt đang mở) - cả 2 hành
// động đều dồn về ĐÂY (2026-09-07 lần 2, theo yêu cầu Sếp Trương Văn Nhân: đợt cắt lịch sử bên
// dưới KHÔNG còn nút bấm nào). "Gửi KCS" chỉ hiện khi có đúng 1 đợt đang CUTTING - tự nhắm đúng
// đợt đó, Phôi không cần biết/chọn đợt nào (luôn tối đa 1 đợt CUTTING tại 1 thời điểm).
//
// "Lưu đợt cắt": mỗi lần bấm CỘNG DỒN vào đợt đang mở (CUTTING) của targetIssue nếu có - Phôi khai
// rải nhiều lần trong ca vẫn tính là 1 đợt. Quyết định gộp/tách nằm hoàn toàn ở backend
// (SteelIssuesService.recordCutBatch) - FE không cần biết trước đây là cộng dồn hay tạo mới, chỉ
// cần refetch sau khi lưu.
//
// "Cách cắt gợi ý" (2026-08-25, bỏ) - phương án cắt KHÔNG phải gợi ý, là BẮT BUỘC theo đúng
// solver đã duyệt. Bảng chip gọn khó nhìn khi nhiều cỡ và không in được, thay bằng liên kết sang
// màn riêng "Hướng dẫn cắt" (sidebar, HuongDanCatPage.tsx) - bảng lưới ô-theo-ô + xuất Excel.
function NewCutBundleForm({ targetIssue, progress, readOnly, bundles, onOpenCuttingGuide, onCreated }: {
  targetIssue: BeSteelIssue | null; progress: BePhoiProgressItem | null; readOnly: boolean
  bundles: BeCutBundle[]
  onOpenCuttingGuide?: () => void; onCreated: () => void
}) {
  const [rowInputs, setRowInputs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [finishBusy, setFinishBusy] = useState(false)
  const [finishErr, setFinishErr] = useState('')
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
  const openBundle = bundles.find(b => b.status === 'CUTTING') ?? null

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

  const finish = async () => {
    if (!openBundle) return
    setFinishBusy(true); setFinishErr('')
    try { await api.finishCutBundle(openBundle.id); onCreated() }
    catch (e) { setFinishErr(errMsg(e, 'Không mời KCS được')) }
    finally { setFinishBusy(false) }
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
      <ProgressBuDuTable segments={segments} canInput={canSubmit} rowInputs={rowInputs}
        onInputChange={(id, v) => setRowInputs(r => ({ ...r, [id]: v }))} />

      {!readOnly && !targetIssue && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Chưa có lô sắt nào đã nhận - xác nhận nhận ở &quot;Xác nhận nhận sắt&quot; trước khi lưu đợt cắt.
        </div>
      )}
      {canSubmit && segments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <button onClick={submit} disabled={busy}
            style={{ ...smallBtn, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy ? 'not-allowed' : 'pointer' }}>
            <Plus size={13} /> {busy ? '...' : 'Lưu đợt cắt'}
          </button>
          {openBundle && (
            <button onClick={finish} disabled={finishBusy}
              style={{ ...smallBtn, background: GREEN, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: finishBusy ? 'not-allowed' : 'pointer' }}>
              <Send size={13} /> {finishBusy ? '...' : 'Gửi KCS'}
            </button>
          )}
        </div>
      )}
      {err && <div style={{ marginTop: 8, fontSize: 12, color: RED }}>{err}</div>}
      {finishErr && <div style={{ marginTop: 8, fontSize: 12, color: RED }}>{finishErr}</div>}

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
          <Ruler size={13} /> Xem hướng dẫn cắt đầy đủ
        </button>
      )}
    </div>
  )
}

// ── 1 ĐỢT CẮT cụ thể - segments đã khai + trạng thái riêng + hành động tương ứng ─────────────
//
// "Bù đủ" cho LỖI CẮT KHÔNG còn bấm được ở đây (2026-09-07, theo góp ý người dùng - 2 điểm hành
// động cho cùng 1 việc gây phân vân bấm chỗ nào) - dồn hẳn về cột "Lỗi" ở bảng tổng trong
// `NewCutBundleForm` (đã xử lý đúng cả trường hợp 1 đợt lẫn nhiều đợt qua
// KHÔNG có nút bấm nào (kể cả "Bù đủ") - mọi thao tác dồn về NewCutBundleForm (bảng tổng, xem doc
// comment ở đó). Card này chỉ còn hiện SỐ LIỆU (đã cắt bao nhiêu, lỗi bao nhiêu THEO ĐÚNG đợt này,
// trạng thái) để chẩn đoán đúng ĐỢT nào đang vướng.
function CutBundleCard({ bundle, orderIndex, review }: {
  bundle: BeCutBundle; orderIndex: number; review?: BeQcReview
}) {
  const segs = review?.segments ?? []
  const outstanding = segs.reduce((s, x) => s + x.failedQty, 0)
  // Xổ ra/vào bảng chi tiết cỡ đoạn - mặc định GỌN (đóng), TRỪ KHI đợt đang có lỗi (outstanding >
  // 0) - lúc đó tự bung sẵn để Phôi thấy ngay cột "Lỗi" không cần bấm thêm.
  const [expanded, setExpanded] = useState(outstanding > 0)
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
          // QC_PASSED nhưng còn lỗi chưa bù đủ - trước đây (2026-09-10) không hiện gì ở đây, chỉ có
          // viền đỏ + bảng cỡ đoạn tự bung, dễ lướt qua không để ý đợt này còn vướng.
          <span style={{ fontSize: 12, fontWeight: 700, color: RED }}>Lỗi {outstanding} đoạn</span>
        ) : bundle.status === 'QC_PASSED' ? (
          // Theo góp ý người dùng (2026-09-10): trước đây đợt đã qua KCS không hiện badge nào cả
          // (chỉ "đang cắt"/"chờ KCS" có label), nhìn vào tưởng đợt chưa xử lý xong.
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: GREEN }}><Check size={12} /> đã duyệt</span>
        ) : null}
      </div>

      {expanded && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={th}>Cỡ đoạn</th>
              <th style={thR}>Số lượng</th>
              {outstanding > 0 && <th style={thR}>Lỗi</th>}
            </tr>
          </thead>
          <tbody>
            {bundle.segments.map(s => {
              const rev = segs.find(x => x.segmentSpecId === s.segmentSpecId)
              const segFailed = rev?.failedQty ?? 0
              return (
                <tr key={s.segmentSpecId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{s.cutLengthMm.toLocaleString('vi-VN')}mm</td>
                  <td style={tdR}>{s.qty}</td>
                  {outstanding > 0 && (
                    <td style={{ ...tdR, color: segFailed > 0 ? RED : 'var(--text3)' }}>
                      {segFailed > 0 ? `lỗi ${segFailed}` : '—'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Bảng tổng CÔNG ĐOẠN PHỤ (Uốn/Dập/Tán/...) (2026-09-07 lần 2, xem changelog "Bù đủ dồn về bảng
// tổng") - CÙNG cấu trúc NewCutBundleForm (ProgressBuDuTable, PI-wide theo cả loại sắt) nhưng
// "Nhập đợt này" + "Gửi KCS" GỘP LÀM 1 lần bấm (recordStepBatch rồi submitStepBundle luôn) - không
// tách 2 bước như Cắt vì không cần "Hoàn tác" (Cắt cần vì lỡ tay khai sai số cây/cỡ vẫn còn liên
// quan tới cân đối kho; công đoạn phụ không tác động gì lên tồn kho). Lịch sử "Các đợt đã gửi" bên
// dưới THUẦN XEM, không có nút nào.
function StepBundleForm({ productionInvoiceId, materialId, step, readOnly, stepBundles, reviewByStepBundle, onRefetch }: {
  productionInvoiceId: string; materialId: string; step: ProcessStep; readOnly: boolean
  stepBundles: BeStepBundle[]; reviewByStepBundle: Map<string, BeQcReview>; onRefetch: () => void
}) {
  const { data: progressList, refetch: refetchProgress } = useFetch<BePhoiProgressItem[]>(
    () => api.getStepProgress(productionInvoiceId, step), [productionInvoiceId, step],
  )
  const item = (progressList ?? []).find(p => p.materialId === materialId) ?? null
  const segments = item?.segments ?? []

  const [rowInputs, setRowInputs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const send = async () => {
    const segs = segments
      .map(s => ({ segmentSpecId: s.segmentSpecId, qty: Math.floor(Number(rowInputs[s.segmentSpecId]) || 0) }))
      .filter(s => s.qty > 0)
    if (segs.length === 0) { setErr(`Nhập số đoạn đã ${PROCESS_STEP_LABELS[step].toLowerCase()}`); return }
    setBusy(true); setErr('')
    try {
      await api.recordStepBatch(productionInvoiceId, { materialId, step, segments: segs })
      await api.submitStepBundle(productionInvoiceId, materialId, step)
      setRowInputs({}); refetchProgress(); onRefetch()
    } catch (e) { setErr(errMsg(e, 'Không gửi KCS được')) }
    finally { setBusy(false) }
  }

  const sorted = [...stepBundles].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  // "Đợt N" đánh số theo thứ tự TẠO RA (cũ nhất = Đợt 1) - cùng lý do với CutBundleCard
  // (orderIndexByBundleId ở MaterialGroupDetail): không đánh theo vị trí hiển thị (sorted ưu tiên
  // mới nhất lên đầu) để số không nhảy lung tung khi 1 đợt khác đổi trạng thái.
  const orderIndexByBundleId = useMemo(() => {
    const byCreatedAsc = [...stepBundles].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    return new Map(byCreatedAsc.map((sb, i) => [sb.id, i + 1]))
  }, [stepBundles])

  return (
    <div>
      <ProgressBuDuTable segments={segments} canInput={!readOnly} rowInputs={rowInputs}
        onInputChange={(id, v) => setRowInputs(r => ({ ...r, [id]: v }))} />
      {!readOnly && segments.length > 0 && (
        <button onClick={send} disabled={busy}
          style={{ ...smallBtn, background: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy ? 'not-allowed' : 'pointer', marginBottom: 4 }}>
          <Send size={13} /> {busy ? '...' : 'Gửi KCS'}
        </button>
      )}
      {err && <div style={{ marginTop: 8, marginBottom: 8, fontSize: 12, color: RED }}>{err}</div>}

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 8 }}>Các đợt đã gửi ({sorted.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(sb => (
            <StepBundleHistoryCard
              key={sb.id} stepBundle={sb} orderIndex={orderIndexByBundleId.get(sb.id) ?? 0}
              review={reviewByStepBundle.get(sb.id)}
            />
          ))}
          {sorted.length === 0 && (
            <div style={{ ...card, padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Chưa gửi KCS đợt nào</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 1 "đợt gửi KCS" công đoạn phụ - THUẦN XEM, không có nút nào (xem StepBundleForm doc comment).
// Mirror CutBundleCard (2026-09-08, theo yêu cầu người dùng "làm giống Cắt luôn") - cùng cách đánh
// số "Đợt N", bấm mở/đóng bảng chi tiết cỡ đoạn, tự bung sẵn + viền đỏ khi có lỗi lịch sử, KHÔNG
// còn badge "Lỗi N đoạn"/"đã duyệt" (xem mục 19 changelog). */
function StepBundleHistoryCard({ stepBundle, orderIndex, review }: {
  stepBundle: BeStepBundle; orderIndex: number; review?: BeQcReview
}) {
  const segs = review?.segments ?? []
  const outstanding = segs.reduce((s, x) => s + x.failedQty, 0)
  const [expanded, setExpanded] = useState(outstanding > 0)
  const totalQty = stepBundle.segments.reduce((s, x) => s + x.qty, 0)

  return (
    <div style={{ ...card, borderColor: outstanding > 0 ? RED : undefined, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        {expanded ? <ChevronDown size={15} color="var(--text3)" /> : <ChevronRight size={15} color="var(--text3)" />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Đợt {orderIndex}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {stepBundle.segments.length} cỡ đoạn · {totalQty} đoạn · {new Date(stepBundle.submittedAt).toLocaleString('vi-VN')}
          </div>
        </div>
        {stepBundle.status === 'AWAITING_QC' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> chờ KCS</span>
        )}
      </div>

      {expanded && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={th}>Cỡ đoạn</th>
              <th style={thR}>Số lượng</th>
              {outstanding > 0 && <th style={thR}>Lỗi</th>}
            </tr>
          </thead>
          <tbody>
            {stepBundle.segments.map(s => {
              const rev = segs.find(x => x.segmentSpecId === s.segmentSpecId)
              const segFailed = rev?.failedQty ?? 0
              return (
                <tr key={s.segmentSpecId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{s.cutLengthMm.toLocaleString('vi-VN')}mm</td>
                  <td style={tdR}>{s.qty}</td>
                  {outstanding > 0 && (
                    <td style={{ ...tdR, color: segFailed > 0 ? RED : 'var(--text3)' }}>
                      {segFailed > 0 ? `lỗi ${segFailed}` : '—'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
