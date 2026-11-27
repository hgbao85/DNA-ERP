'use client'

/**
 * Màn hình KCS — Công đoạn PHÔI (2 tầng: PI → các đợt chờ kiểm).
 *
 * Viết lại hoàn toàn (2026-08-24) — KHÔNG còn dùng chung `kcsCore.tsx`/`KcsTwoTierScreen` với
 * Hàn/Sơn nữa: Sếp chốt Phôi chấm THEO TỪNG CỠ ĐOẠN (khác Hàn/Sơn vẫn chấm cả lô theo số lượng
 * đơn thuần - production_batch chưa có "cỡ" gì để bóc). Tách riêng để không đụng kcsCore.tsx
 * (Hàn/Sơn dùng, không được vỡ).
 *
 * KCS chỉ chấm 2 kết quả: Đạt/Không đạt (2026-08-24, vòng 2 - bỏ hẳn "lỗi sửa được" đã thử ở vòng
 * 1). Đợt đóng QC_PASSED ngay.
 *
 * Redesign 2026-09-05 (chấm theo ĐỢT CẮT thay vì cả LÔ NHẬN): trước đây 1 lô nhận (SteelIssue)
 * chỉ có đúng 1 lượt "báo cắt xong" nên chấm theo issue = chấm đúng đợt. Từ khi trạng thái hạ
 * xuống CutBundle (mỗi lần Phôi bấm "Lưu đợt cắt" tự có vòng đời riêng, xem LenhSanXuatPhoi.tsx),
 * 1 lô nhận có thể có NHIỀU đợt cắt cùng lúc đang AWAITING_QC - phải chấm theo TỪNG bundle, không
 * còn theo issue. `QcReviewModal` giờ nhận thẳng `bundle` (segments đã có sẵn trong chính bundle,
 * không cần gọi lại API gộp nhiều bundle như bản issue-based cũ).
 *
 * Redesign 2026-09-07 (thêm StepBundle - chấm CÔNG ĐOẠN PHỤ riêng): mỗi PI giờ có thể có NHIỀU
 * "đợt gửi KCS công đoạn phụ" (Uốn/Dập/Tán/...) độc lập theo TỪNG LOẠI SẮT, KHÔNG chờ Cắt hay công
 * đoạn khác xong trước (xem StepBundle doc comment BE). `Row` gộp CẢ 2 loại đợt (Cắt lẫn công đoạn
 * phụ) thành 1 danh sách chờ kiểm chung cho từng PI - `QcReviewModal` tổng quát hoá (nhận
 * `id`/`segments`/`onReview` thay vì bám cứng `bundle`) để dùng chung cho cả 2 loại, tránh chép lại
 * nguyên modal.
 *
 * Redesign 2026-09-08 (StepBundle chuyển PI-wide, bỏ report-done/recheck): StepBundle không còn
 * gắn với đúng 1 CutBundle nào nữa (scope PI + loại sắt, xem LenhSanXuatPhoi.tsx/BeStepBundle) —
 * `StepRow` giờ lấy thẳng từ `api.getAllStepBundles()`, không còn duyệt qua `bundle.stepBundles`.
 * Đồng thời BỎ HẲN cơ chế "Bù đủ → KCS duyệt lại" (report-done/recheck) cho cả Cắt lẫn StepBundle:
 * "Lỗi" giờ là số lịch sử KHÔNG tự giảm, "Bù đủ" chỉ là nút pre-fill số lượng bên LenhSanXuatPhoi.tsx
 * rồi gửi 1 đợt HOÀN TOÀN MỚI qua đúng luồng bình thường — nên mọi đợt (Cắt lẫn công đoạn phụ) giờ
 * chỉ còn ĐÚNG 1 lượt duyệt qua `QcReviewModal`, không còn "chờ duyệt lại"/`RecheckModal` nữa.
 *
 * Redesign 2026-09-08 (lần 2, theo góp ý người dùng "màn KCS cũng làm tab theo công đoạn"): bảng
 * chờ duyệt trong `PiDetail` trước đây XỔ CHUNG mọi công đoạn (Cắt lẫn Uốn/Dập/... trộn lẫn theo
 * hàng, chỉ phân biệt qua cột "Công đoạn") - giờ tách thành TAB bấm chuyển qua lại (mirror
 * `MaterialGroupDetail` bên `LenhSanXuatPhoi.tsx` đã làm), mỗi tab chỉ hiện đúng đợt của công đoạn
 * đó + số đang chờ kiểm ngay trên nút tab - tab mặc định chọn công đoạn có nhiều đợt chờ nhất. Bỏ
 * luôn cột "Công đoạn" khỏi bảng (đã ngầm hiểu qua tab đang chọn, không cần lặp lại mỗi hàng).
 *
 * Redesign 2026-09-08 (lần 3, theo góp ý người dùng "sao lại đưa VTTP ra ngoài, sao không đưa vào
 * trong Phôi luôn"): bên `tkphoi` (LenhSanXuatPhoi.tsx) đã gộp Sắt + Vật tư TP vào 1 màn "Lệnh sản
 * xuất — Công đoạn Phôi" từ lâu (tab "Cắt sắt"/"Vật tư TP"), nhưng bên KCS lại tách "Phôi"/"Vật tư
 * TP" thành 2 mục nav riêng (MfgApp.tsx: 'kcs-phoi'/'kcs-vat-tu-tp') - không nhất quán. Gộp NHANH
 * (theo yêu cầu, không viết lại sâu): bỏ hẳn mục nav 'kcs-vat-tu-tp' riêng, `KcsPhoiPage` giờ tự có
 * dải tab "Cắt sắt"/"Vật tư TP" ở ĐẦU màn (`section` state) - tab "Vật tư TP" render NGUYÊN
 * `KcsVatTuThanhPhamPage` cũ (đổi tên `KcsSatSection` cho phần Sắt gốc, không đổi logic bên trong -
 * chỉ đổi VỊ TRÍ truy cập, 2 luồng dữ liệu vẫn hoàn toàn độc lập như trước).
 *
 * P1 (18/11/2026 - KCS tự chuyển): KCS tự thấy đợt công nhân vừa báo (dòng "đang mở", từ GET /floor/review) cạnh các đợt đã chốt (từ
 * các danh sách chấm có sẵn - review KHÔNG trả đợt đã chốt). Bấm "Chấm" ở dòng đang mở: màn gọi lệnh chốt (POST /floor/kcs/.../close)
 * rồi mở hộp chấm giữ đúng đợt vừa chốt. Hộp chấm có Đã báo / Thực có / Lỗi - cắt lại (Cắt) hoặc Làm lại + Bỏ, cắt lại (công đoạn phụ);
 * thiếu = Đã báo - Thực có. Dòng xám + khoá Chấm: đợt mở theo blockedReason, đợt đã chốt theo stoppedPis (so theo id PI). Logic thuần
 * (trạng thái dòng, kiểm số, dựng body) ở kcsReviewModel.ts.
 */

import { useUrlParamValue } from '../../../hooks/useUrlState'
import { focusAttr, focusAttrAny, focusKey } from '../../../utils/notificationLink'
import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Check, Clock, ChevronLeft, ChevronRight, AlertTriangle, Upload, X, Plus, Wrench } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeSteelIssue, BeQcReview, BeCutBundle, BeStepBundle, BePiOrderSummary, QcReviewResult } from '../../../services/steel-issues-api'
import type { BeReviewCutBundle, BeReviewStepGroup } from '../../../services/floor-api'
import { closeCutBundle, closeStepGroup, getKcsFloorReview, isKcsFloorForbidden } from '../../../services/kcs-floor-api'
import type { BeDefectReason } from '../../../services/defect-reasons-api'
import type { ProcessStep } from '../../../types/sku'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import KcsVatTuThanhPhamPage from './KcsVatTuThanhPhamPage'
import KcsChanNhomSection from './KcsChanNhomSection'
import MobileListCards from '../../../components/MobileListCards'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import LenhCode from '../../../components/LenhCode'
import {
  MSG_ACTUAL_CLAMPED, MSG_FORBIDDEN, buildSegmentsPayload, calcRow, clampActual, hasBlockingError, isPiStopped,
  pickRowState, reviewOutcome, sumRows, totalsText,
  type KcsRowState, type StoppedPi,
} from './kcsReviewModel'

const ACCENT = 'var(--fg-e65100)'
const GREEN = 'var(--fg-16a34a)'
const RED = 'var(--fg-c62828)'
const AMBER = 'var(--fg-d97706)'
const tabBtn = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 600,
  border: '1px solid ' + (active ? ACCENT : 'var(--border)'), borderRadius: 20, cursor: 'pointer',
  background: active ? 'var(--accent-bg, var(--bg-fff3e8))' : 'var(--surface)', color: active ? ACCENT : 'var(--text2)',
})
const tabPendingBadge: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px',
  borderRadius: 8, fontSize: 10.5, fontWeight: 700, background: AMBER, color: '#fff',
}
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
// overflowX (không cắt): trên điện thoại bảng rộng hơn khung thì cuộn ngang thay vì mất cột bên phải.
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }

interface PiAgg {
  productionInvoiceId: string; poNumber: string; bundles: Row[]
  /** Đợt đang mở + đã chốt chờ chấm, KHÔNG tính dòng xám (khớp số đỏ menu). */
  pendingCount: number
  /** Dòng xám chưa chấm được (lệnh dừng / dữ liệu cũ chưa gắn SKU). */
  blockedCount: number
}
/** 1 đợt cắt kèm lô nhận cha (để hiện materialName/barLengthMm - bundle tự nó không có tên vật tư). */
/** orderCancelled: câu 4 (24/11/2026) - SKU đã huỷ, KCS vẫn chấm nốt (không xám theo lệnh dừng). */
interface CutRow { kind: 'cut'; bundle: BeCutBundle; issue: BeSteelIssue; orderCancelled?: boolean }
/** 1 đợt gửi KCS công đoạn PHỤ (2026-09-08, PI-wide) - StepBundle tự mang đủ
 *  productionInvoiceId/materialName, không cần cutBundle/issue cha nữa. */
interface StepRow { kind: 'step'; stepBundle: BeStepBundle; orderCancelled?: boolean }
/** P1 (18/11/2026): đợt cắt ĐANG MỞ (công nhân vừa báo, chưa chốt) - từ GET /floor/review. Bấm Chấm thì chốt rồi chấm. */
interface OpenCutRow { kind: 'openCut'; r: BeReviewCutBundle; piId: string }
/** P1: nhóm công đoạn phụ ĐANG MỞ (các dòng chưa gom, theo người + SKU) - từ GET /floor/review. */
interface OpenStepRow { kind: 'openStep'; r: BeReviewStepGroup; piId: string }
type Row = CutRow | StepRow | OpenCutRow | OpenStepRow

type RowStatus = 'OPEN' | 'AWAITING_QC' | 'QC_PASSED'

function piIdOf(x: Row): string {
  switch (x.kind) {
    case 'cut': return x.issue.productionInvoiceId
    case 'step': return x.stepBundle.productionInvoiceId
    default: return x.piId
  }
}
function materialNameOf(x: Row): string {
  switch (x.kind) {
    case 'cut': return x.issue.materialName
    case 'step': return x.stepBundle.materialName
    default: return x.r.material.name
  }
}
/** SKU (ProductionOrder.id) mà đợt này làm cho (2026-09-21) - null = đợt CŨ chưa gắn SKU. */
function orderIdOf(x: Row): string | null {
  switch (x.kind) {
    case 'cut': return x.bundle.productionOrderId
    case 'step': return x.stepBundle.productionOrderId
    default: return x.r.order?.productionOrderId ?? null
  }
}
function idOf(x: Row): string {
  switch (x.kind) {
    case 'cut': return x.bundle.id
    case 'step': return x.stepBundle.id
    case 'openCut': return x.r.cutBundleId
    // Nhóm mở chưa có id riêng: ghép khoá chốt (PI + vật tư + công đoạn + SKU + người).
    default: return `${x.piId}:${x.r.material.materialId}:${x.r.step}:${x.r.order?.productionOrderId ?? 'null'}:${x.r.workerId ?? 'null'}`
  }
}
function statusOf(x: Row): RowStatus {
  switch (x.kind) {
    // Đợt CUTTING không bao giờ vào danh sách (buildPiRows lọc), nên chỉ còn 2 trạng thái.
    case 'cut': return x.bundle.status === 'QC_PASSED' ? 'QC_PASSED' : 'AWAITING_QC'
    case 'step': return x.stepBundle.status
    default: return 'OPEN'
  }
}
/** Mốc thời gian hiện ở dòng: "Báo lúc" (đang mở: lần báo còn hiệu lực đầu tiên) / "Chốt lúc" (đã chốt). */
function timeOf(x: Row): { label: string; at: string } {
  switch (x.kind) {
    case 'cut': return { label: 'Chốt lúc', at: x.bundle.completedAt ?? x.bundle.createdAt }
    case 'step': return { label: 'Chốt lúc', at: x.stepBundle.submittedAt }
    default: return { label: 'Báo lúc', at: x.r.waitingSince }
  }
}
function segmentsOf(x: Row): { cutLengthMm: number; qty: number }[] {
  switch (x.kind) {
    case 'cut': return x.bundle.segments
    case 'step': return x.stepBundle.segments
    default: return x.r.segments
  }
}
/** Tab công đoạn: 'CAT' (Cắt) hoặc đúng `ProcessStep` của đợt công đoạn phụ. */
function stepKeyOf(x: Row): 'CAT' | ProcessStep {
  switch (x.kind) {
    case 'cut': case 'openCut': return 'CAT'
    case 'step': return x.stepBundle.step
    default: return x.r.step as ProcessStep
  }
}
/** Người báo: đợt cắt có sổ nhiều người; nhóm mở có 1 người; đợt công đoạn đã chốt không có. */
function reporterTextOf(x: Row): string | null {
  switch (x.kind) {
    case 'cut': return x.bundle.reportedByNames?.length ? x.bundle.reportedByNames.join(', ') : null
    case 'openCut': return x.r.openedByName
    case 'openStep': return x.r.workerName
    default: return null
  }
}

/**
 * Trạng thái dòng (UF2): đợt MỞ xám theo `blockedReason`; đợt ĐÃ CHỐT xám theo `stoppedPis` (so theo id PI - MF2).
 * Đợt đã chấm xong (QC_PASSED) luôn bình thường.
 */
function stateOf(x: Row, stoppedPis: readonly StoppedPi[] | undefined): KcsRowState {
  const status = statusOf(x)
  if (status === 'QC_PASSED') return { muted: false, locked: true, message: null, counted: false }
  if (x.kind === 'openCut' || x.kind === 'openStep') return pickRowState({ phase: 'OPEN', blockedReason: x.r.blockedReason })
  // Câu 4 (24/11/2026): đợt chờ chấm của SKU đã huỷ chấm được dù PI không còn SKU đang chạy.
  const orderCancelled = (x.kind === 'cut' || x.kind === 'step') && x.orderCancelled === true
  return pickRowState({ phase: 'AWAITING_QC', piStopped: !orderCancelled && isPiStopped(stoppedPis, { productionInvoiceId: piIdOf(x) }) })
}

function buildPiRows(
  issues: BeSteelIssue[], bundles: BeCutBundle[], stepBundles: BeStepBundle[],
  openCuts: BeReviewCutBundle[], openSteps: BeReviewStepGroup[], stoppedPis: readonly StoppedPi[] | undefined,
  cancelledOrderIds: readonly string[] = [],
): PiAgg[] {
  // Câu 4 (nghiệp vụ 24/11/2026, đảo cách ẩn 23/11): KCS chấm nốt đợt của SKU đã huỷ - hàng đạt vào kho công đoạn.
  const cancelled = new Set(cancelledOrderIds)
  const isCancelled = (orderId: string | null) => orderId != null && cancelled.has(orderId)
  const issueById = new Map(issues.map((i) => [i.id, i]))
  // poNumber tra theo productionInvoiceId (không còn dùng issue của chính Row vì StepRow không có
  // issue cha nữa) - lấy từ bất kỳ issue nào cùng PI, đều cùng 1 piCode. 2026-09-10 (theo yêu cầu
  // người dùng): màn KCS LUÔN hiện mã PI, KHÔNG hiện mã PO (đơn hàng Sales) - trước đây ưu tiên PO
  // nếu có, dễ nhầm với "PO" ở màn Mua hàng/Kho (2 mã khác nhau cùng gọi là "PO") - cùng đổi với
  // Hàn/Sơn/Vật tư TP (KcsStagePage.tsx).
  // P1: mã lệnh lấy thêm từ GET /floor/review (pi.code) - danh sách lô nhận chỉ trả 100 dòng nên có PI chỉ có đợt mở thì không có ở đây.
  const poNumberByPi = new Map<string, string>()
  for (const i of issues) {
    if (!poNumberByPi.has(i.productionInvoiceId)) poNumberByPi.set(i.productionInvoiceId, i.piCode)
  }
  for (const c of openCuts) if (c.pi && !poNumberByPi.has(c.pi.productionInvoiceId)) poNumberByPi.set(c.pi.productionInvoiceId, c.pi.code)
  for (const s of openSteps) if (s.pi && !poNumberByPi.has(s.pi.productionInvoiceId)) poNumberByPi.set(s.pi.productionInvoiceId, s.pi.code)
  for (const s of stoppedPis ?? []) if (!poNumberByPi.has(s.productionInvoiceId)) poNumberByPi.set(s.productionInvoiceId, s.code)
  // Chỉ đợt liên quan KCS (đang mở / đã chốt trở lên) - đợt còn CUTTING hoặc công đoạn phụ chưa gửi chưa liên quan.
  const cutRows: Row[] = bundles
    .filter((b) => b.status === 'AWAITING_QC' || b.status === 'QC_PASSED')
    .map((b): Omit<CutRow, 'issue'> & { issue: BeSteelIssue | undefined } => ({ kind: 'cut', bundle: b, issue: issueById.get(b.steelIssueId), orderCancelled: isCancelled(b.productionOrderId) }))
    .filter((x): x is CutRow => x.issue != null)
  const stepRows: Row[] = stepBundles
    .filter((sb) => sb.status === 'AWAITING_QC' || sb.status === 'QC_PASSED')
    .map((sb) => ({ kind: 'step' as const, stepBundle: sb, orderCancelled: isCancelled(sb.productionOrderId) }))
  const openCutRows: Row[] = openCuts
    .filter((r) => r.pi != null)
    .map((r) => ({ kind: 'openCut' as const, r, piId: r.pi!.productionInvoiceId }))
  const openStepRows: Row[] = openSteps
    .filter((r) => r.pi != null)
    .map((r) => ({ kind: 'openStep' as const, r, piId: r.pi!.productionInvoiceId }))
  const relevant = [...openCutRows, ...openStepRows, ...cutRows, ...stepRows]
  const byPi = new Map<string, Row[]>()
  const order: string[] = []
  for (const x of relevant) {
    const piId = piIdOf(x)
    if (!byPi.has(piId)) { byPi.set(piId, []); order.push(piId) }
    byPi.get(piId)!.push(x)
  }
  return order
    .map((productionInvoiceId) => {
      const list = byPi.get(productionInvoiceId)!
      // Đếm cả dòng ĐANG MỞ, trừ dòng xám (khớp số đỏ menu, AC10 / AC11).
      let pendingCount = 0
      let blockedCount = 0
      for (const x of list) {
        if (statusOf(x) === 'QC_PASSED') continue
        if (stateOf(x, stoppedPis).counted) pendingCount++
        else blockedCount++
      }
      return {
        productionInvoiceId,
        poNumber: poNumberByPi.get(productionInvoiceId) ?? productionInvoiceId,
        bundles: list,
        pendingCount,
        blockedCount,
      }
    })
    .sort((a, b) => b.pendingCount - a.pendingCount)
}

const sectionTabBtn = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '7px 14px', fontSize: 13, fontWeight: 600,
  border: '1px solid ' + (active ? ACCENT : 'var(--border)'), borderRadius: 20, cursor: 'pointer',
  background: active ? 'var(--accent-bg, var(--bg-fff3e8))' : 'var(--surface)', color: active ? ACCENT : 'var(--text2)',
})

export default function KcsPhoiPage() {
  // `?sub=chan-nhom` từ thông báo "Phôi gửi KCS vật tư không gắn mảnh" mở thẳng tab con tương ứng.
  const urlSub = useUrlParamValue('sub')
  const [section, setSection] = useState<'sat' | 'vattutp' | 'chan-nhom'>(urlSub === 'chan-nhom' ? 'chan-nhom' : 'sat')
  useEffect(() => {
    if (urlSub === 'chan-nhom') setSection('chan-nhom')
  }, [urlSub])

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        <button onClick={() => setSection('sat')} style={sectionTabBtn(section === 'sat')}>Cắt sắt</button>
        <button onClick={() => setSection('vattutp')} style={sectionTabBtn(section === 'vattutp')}>Vật tư TP</button>
        <button onClick={() => setSection('chan-nhom')} style={sectionTabBtn(section === 'chan-nhom')}>VT không gắn mảnh</button>
      </div>
      {section === 'sat' ? <KcsSatSection /> : section === 'vattutp' ? <KcsVatTuThanhPhamPage /> : <KcsChanNhomSection />}
    </div>
  )
}

function KcsSatSection() {
  // PH1 (18/11): getSteelIssuesByStatus / getAllStepBundles đã đọc hết trang, /cut-bundles không phân trang - tải thẳng 3 danh sách.
  const { data: kcsData, isLoading, error, refetch } = useFetch(async () => {
    const [issues, allBundles, allStepBundles] = await Promise.all([
      api.getSteelIssuesByStatus(), api.getAllCutBundles(), api.getAllStepBundles(),
    ])
    return { issues, allBundles, allStepBundles }
  }, [])
  const issues = kcsData?.issues
  const allBundles = kcsData?.allBundles
  const allStepBundles = kcsData?.allStepBundles
  const { data: reviews, refetch: refetchReviews } = useFetch<BeQcReview[]>(() => api.getQcReviewsForSteelIssues(), [])
  // P1: đợt ĐANG MỞ + stoppedPis của tổ Phôi. 403 trả { forbidden } (không ném, không console.error); lỗi khác không làm vỡ màn.
  const { data: floorReview, error: floorReviewError, refetch: refetchFloorReview } = useFetch(() => getKcsFloorReview('PHOI'), [])
  const refetchAll = () => { void refetch(); void refetchReviews(); void refetchFloorReview() }
  // Công nhân báo / QLSX hủy phát 'floor'; sự kiện dồn dập gom 3 giây thành 1 lần tải lại.
  useRealtimeRefetch(['steel-issues', 'qc-reviews', 'production-orders', 'floor'], refetchAll, { debounceMs: 3000 })
  const [selPi, setSelPi] = useState<string | null>(null)

  const forbidden = floorReview != null && isKcsFloorForbidden(floorReview)
  const review = floorReview != null && !isKcsFloorForbidden(floorReview) ? floorReview : null
  const notice = forbidden ? MSG_FORBIDDEN : floorReviewError ? `Không tải được các đợt đang mở - ${floorReviewError}` : ''

  const piRows = useMemo(
    () => buildPiRows(issues ?? [], allBundles ?? [], allStepBundles ?? [], review?.cutBundles ?? [], review?.stepGroups ?? [], review?.stoppedPis, review?.cancelledOrderIds),
    [issues, allBundles, allStepBundles, review],
  )

  if (isLoading) return <LoadingState />
  if (error || !issues) return <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />

  const noticeEl = notice ? (
    <div role="status" style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius)', background: 'var(--surface2)', color: AMBER, fontSize: 13, wordBreak: 'break-word' }}>{notice}</div>
  ) : null

  const sel = selPi ? piRows.find((r) => r.productionInvoiceId === selPi) ?? null : null
  if (sel) {
    return <PiDetail pi={sel} reviews={reviews ?? []} stoppedPis={review?.stoppedPis} notice={noticeEl} onBack={() => setSelPi(null)} onRefetch={refetchAll} />
  }

  return (
    <div>
      <h2 style={{ ...pageTitle, marginBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Wrench size={20} /> Màn hình KCS — Công đoạn Phôi
      </h2>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Kiểm tra chất lượng theo từng cỡ đoạn — bấm vào lệnh có đợt chờ chấm để chấm.
      </div>
      {noticeEl}
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Lệnh</th>
              <th style={thR}>Đợt chờ chấm</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {piRows.map((r) => (
              <tr key={r.productionInvoiceId} {...focusAttrAny(r.bundles.map((x) => (x.kind === 'cut' || x.kind === 'openCut' ? focusKey('CUT_BUNDLE', idOf(x)) : null)))} onClick={() => setSelPi(r.productionInvoiceId)}
                style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}><LenhCode piCode={r.poNumber} /></td>
                <td style={tdR}>
                  {r.pendingCount > 0
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: AMBER, fontWeight: 700 }}><Clock size={12} /> {r.pendingCount}</span>
                    : r.blockedCount > 0
                      ? <span style={{ color: 'var(--text3)' }}>{r.blockedCount} đợt chưa chấm được</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: GREEN }}><Check size={12} /> đã duyệt hết</span>}
                  {r.pendingCount > 0 && r.blockedCount > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}> (+{r.blockedCount} chưa chấm được)</span>}
                </td>
                <td style={{ ...td, textAlign: 'center', color: 'var(--text3)' }}><ChevronRight size={16} /></td>
              </tr>
            ))}
            {piRows.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}><div className="table-empty-msg"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Chưa có đợt nào chờ chấm</span></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Hộp chấm mở cho đúng đợt vừa chốt (hoặc đợt đã chốt sẵn): id + cỡ đoạn lấy từ lệnh chốt / dòng, không đọc lại danh sách đang tự tải. */
interface ReviewTarget {
  x: Row
  kind: 'CAT' | 'STEP'
  id: string
  segments: { segmentSpecId: string; cutLengthMm: number; qty: number }[]
}

function PiDetail({ pi, reviews, stoppedPis, notice, onBack, onRefetch }: {
  pi: PiAgg; reviews: BeQcReview[]; stoppedPis: readonly StoppedPi[] | undefined; notice: React.ReactNode
  onBack: () => void; onRefetch: () => void
}) {
  // Điện thoại: đợt chờ kiểm dạng thẻ + nút duyệt ở chân thẻ (bảng 6 cột vỡ chữ từng từ).
  const isMobile = useIsMobile()
  const [target, setTarget] = useState<ReviewTarget | null>(null)
  const [closingKey, setClosingKey] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState('')

  // KCS phải biết đang duyệt đợt của SKU nào (2026-09-21) - nhãn kèm mã PO + số lượng vì các SKU cùng PI có thể
  // cùng tên sản phẩm.
  const { data: orderSummary } = useFetch<BePiOrderSummary[]>(() => api.getPiOrderSummary(pi.productionInvoiceId), [pi.productionInvoiceId])
  const skuLabelOf = (x: Row): string => {
    // Đợt đang mở: review đã trả sẵn mã PO + SKU.
    if (x.kind === 'openCut' || x.kind === 'openStep') return x.r.order ? `${x.r.order.poNumber} · ${x.r.order.sku}` : 'Chưa phân SKU'
    const oid = orderIdOf(x)
    if (!oid) return 'Chưa phân SKU'
    const o = (orderSummary ?? []).find(s => s.productionOrderId === oid)
    // Review IT 26/11 mục 2.8: nhãn "SKU đã huỷ" như màn KCS Hàn / Sơn (KCS vẫn chấm nốt đợt này).
    const cancelledTag = (x.kind === 'cut' || x.kind === 'step') && x.orderCancelled ? ' (SKU đã huỷ)' : ''
    return o ? `${o.poNumber} · ${o.sku}${cancelledTag}` : '…'
  }

  const reviewByBundle = useMemo(() => {
    const m = new Map<string, BeQcReview>()
    for (const r of reviews) if (r.cutBundleId) m.set(r.cutBundleId, r)
    return m
  }, [reviews])
  const reviewByStepBundle = useMemo(() => {
    const m = new Map<string, BeQcReview>()
    for (const r of reviews) if (r.stepBundleId) m.set(r.stepBundleId, r)
    return m
  }, [reviews])

  const reviewOf = (x: Row) => x.kind === 'cut' ? reviewByBundle.get(x.bundle.id) : x.kind === 'step' ? reviewByStepBundle.get(x.stepBundle.id) : undefined

  // Danh sách công đoạn xuất hiện trong PI này (Cắt luôn trước, còn lại theo thứ tự gặp trong dữ
  // liệu) + số đợt đang chờ chấm mỗi công đoạn (không tính dòng xám) - dùng để dựng dải tab và badge số chờ trên từng tab.
  const stepKeys = useMemo(() => {
    const seen = new Set<string>()
    const keys: ('CAT' | ProcessStep)[] = []
    for (const x of pi.bundles) {
      const k = stepKeyOf(x)
      if (!seen.has(k)) { seen.add(k); keys.push(k) }
    }
    return keys
  }, [pi.bundles])
  const pendingByStep = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of pi.bundles) {
      if (statusOf(x) !== 'QC_PASSED' && stateOf(x, stoppedPis).counted) { const k = stepKeyOf(x); m.set(k, (m.get(k) ?? 0) + 1) }
    }
    return m
  }, [pi.bundles, stoppedPis])
  // Mặc định mở đúng công đoạn đang chờ NHIỀU nhất (đỡ phải tự bấm tìm). Tính LẠI theo dữ liệu hiện có cho tới khi
  // người dùng tự bấm tab (2026-09-21): trước đây chỉ tính 1 lần lúc mount, mà danh sách đợt Cắt và đợt công đoạn
  // phụ tải riêng nên lúc mount có thể mới có 1 loại -> mặc định vào nhầm tab Uốn dù tab Cắt có đợt chờ.
  const [picked, setPicked] = useState<'CAT' | ProcessStep | null>(null)
  const bestStep = useMemo(() => {
    let best: 'CAT' | ProcessStep = stepKeys[0] ?? 'CAT'
    let bestPending = -1
    for (const k of stepKeys) {
      const p = pendingByStep.get(k) ?? 0
      if (p > bestPending) { bestPending = p; best = k }
    }
    return best
  }, [stepKeys, pendingByStep])
  const effectiveActiveStep = picked && stepKeys.includes(picked) ? picked : bestStep

  const rank = (x: Row) => statusOf(x) === 'QC_PASSED' ? 1 : 0
  const rows = pi.bundles
    .filter((x) => stepKeyOf(x) === effectiveActiveStep)
    .sort((a, b) => {
      const r = rank(a) - rank(b)
      return r !== 0 ? r : timeOf(b).at.localeCompare(timeOf(a).at)
    })

  // Bấm "Chấm": đợt đang mở thì chốt trước (5 route close), hộp chấm giữ đúng đợt vừa chốt. Lỗi 409 / 400 -> hiện đúng câu BE,
  // tải lại danh sách, KHÔNG mở hộp.
  const startReview = async (x: Row) => {
    if (closingKey !== null || stateOf(x, stoppedPis).locked) return
    setActionErr('')
    setPicked(effectiveActiveStep) /* giữ nguyên tab đang đứng sau khi chấm (test tay 09/11 điểm 34e) */
    if (x.kind === 'cut') { setTarget({ x, kind: 'CAT', id: x.bundle.id, segments: x.bundle.segments }); return }
    if (x.kind === 'step') { setTarget({ x, kind: 'STEP', id: x.stepBundle.id, segments: x.stepBundle.segments }); return }
    const key = idOf(x)
    setClosingKey(key)
    try {
      if (x.kind === 'openCut') {
        const b = await closeCutBundle(x.r.cutBundleId)
        setTarget({ x, kind: 'CAT', id: b.id, segments: b.segments })
      } else {
        const b = await closeStepGroup({
          productionInvoiceId: x.piId, materialId: x.r.material.materialId, step: x.r.step,
          productionOrderId: x.r.order?.productionOrderId ?? null, workerId: x.r.workerId,
        })
        setTarget({ x, kind: 'STEP', id: b.id, segments: b.segments })
      }
      onRefetch()
    } catch (e) {
      setActionErr(errMsg(e, 'Không chốt được để chấm - tải lại trang'))
      onRefetch()
    } finally { setClosingKey(null) }
  }

  // Nhãn trạng thái + nút chấm dùng chung cho bảng (màn rộng) và thẻ (điện thoại).
  // failedQty là số ĐOẠN lịch sử của ĐÚNG đợt - đợt QC_PASSED có lỗi lịch sử vẫn hiện "đạt" (xem chú thích tại bảng).
  const statusBadge = (x: Row) => {
    const status = statusOf(x)
    if (status !== 'QC_PASSED') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: AMBER }}><Clock size={12} /> {status === 'OPEN' ? 'đang mở' : 'đã chốt'}</span>
    }
    const o = reviewOutcome(reviewOf(x)?.segments ?? [])
    const isCut = stepKeyOf(x) === 'CAT'
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 12, fontWeight: 700 }}>
        <Check size={12} color={GREEN} /> <span style={{ color: GREEN }}>đạt</span>
        {o.failed > 0 && (
          <span style={{ color: RED, fontWeight: 600 }}>
            (lỗi {o.failed} đoạn{!isCut && ` - bỏ ${o.scrap}, làm lại ${o.rework}`})
          </span>
        )}
        {o.short > 0 && <span style={{ color: 'var(--text3)', fontWeight: 600 }}>(thiếu {o.short})</span>}
      </span>
    )
  }
  const reviewBtn = (x: Row) => {
    const locked = stateOf(x, stoppedPis).locked
    return (
      <button onClick={() => startReview(x)} disabled={locked || closingKey !== null} title={stateOf(x, stoppedPis).message ?? undefined}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.5 : 1 }}>
        <ClipboardCheck size={13} /> {closingKey === idOf(x) ? 'Đang chốt…' : 'Chấm'}
      </button>
    )
  }
  const blockedLine = (x: Row) => {
    const m = stateOf(x, stoppedPis).message
    return m ? <div style={{ fontSize: 11, color: RED, marginTop: 2 }}>{m}</div> : null
  }
  const timeText = (x: Row) => { const t = timeOf(x); return `${t.label} ${new Date(t.at).toLocaleString('vi-VN')}` }
  const segText = (x: Row) => segmentsOf(x).map((s) => s.qty + '×' + s.cutLengthMm.toLocaleString('vi-VN') + 'mm').join(' + ')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}><LenhCode piCode={pi.poNumber} /></h2>
      </div>

      {notice}
      {actionErr && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} /> <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{actionErr}</span>
        </div>
      )}

      {stepKeys.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {stepKeys.map((k) => {
            const label = k === 'CAT' ? 'Cắt' : PROCESS_STEP_LABELS[k]
            const pending = pendingByStep.get(k) ?? 0
            return (
              <button key={k} onClick={() => setPicked(k)} style={tabBtn(k === effectiveActiveStep)}>
                {label}
                {pending > 0 && <span style={tabPendingBadge}>{pending}</span>}
              </button>
            )
          })}
        </div>
      )}

      {isMobile ? (
        <MobileListCards emptyText="Không còn lô chờ chấm." items={rows.map(x => {
          const muted = stateOf(x, stoppedPis).muted
          return {
            key: x.kind + ':' + idOf(x),
            title: <span style={{ opacity: muted ? 0.55 : 1 }}><b>{materialNameOf(x)}</b>{blockedLine(x)}</span>,
            badge: statusBadge(x),
            meta: [
              { label: 'SKU', value: <span style={{ fontWeight: 600, color: orderIdOf(x) ? 'var(--text)' : 'var(--text3)' }}>{skuLabelOf(x)}</span> },
              { label: timeOf(x).label, value: new Date(timeOf(x).at).toLocaleString('vi-VN') },
              { label: 'Đợt', value: segText(x) },
              ...(reporterTextOf(x) ? [{ label: 'Người báo', value: reporterTextOf(x) as string }] : []),
            ],
            footer: statusOf(x) !== 'QC_PASSED' ? reviewBtn(x) : undefined,
          }
        })} />
      ) : (
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Loại sắt</th>
              <th style={th}>SKU</th>
              <th style={th}>Đợt</th>
              <th style={th}>Thời điểm</th>
              <th style={{ ...th, textAlign: 'center' }}>Trạng thái</th>
              <th style={{ ...th, width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const id = idOf(x)
              const status = statusOf(x)
              const muted = stateOf(x, stoppedPis).muted
              return (
                <tr key={`${x.kind}:${id}`} {...(x.kind === 'cut' || x.kind === 'openCut' ? focusAttr('CUT_BUNDLE', id) : {})} style={{ borderTop: '1px solid var(--border)', opacity: muted ? 0.55 : 1 }}>
                  <td style={{ ...td, fontWeight: 600 }}>{materialNameOf(x)}{blockedLine(x)}</td>
                  <td style={{ ...td, fontWeight: 600, color: orderIdOf(x) ? 'var(--text)' : 'var(--text3)' }}>{skuLabelOf(x)}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>
                    {segText(x)}
                    {/* Ai báo đợt này (2026-10-12) - để KCS biết đợt lỗi do ai báo */}
                    {reporterTextOf(x) && (
                      <div style={{ fontSize: 11, marginTop: 2 }}>Người báo: {reporterTextOf(x)}</div>
                    )}
                  </td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{timeText(x)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{statusBadge(x)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{status !== 'QC_PASSED' && reviewBtn(x)}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Không còn lô chờ chấm.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {target && (
        <QcReviewModal
          kind={target.kind} id={target.id} materialName={materialNameOf(target.x)} skuLabel={skuLabelOf(target.x)} segments={target.segments}
          onReview={(id, data) => target.kind === 'CAT' ? api.reviewCutBundleQc(id, data) : api.reviewStepBundleQc(id, data)}
          onSaved={onRefetch}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  )
}

// ── Modal chấm: nhập THEO TỪNG CỠ ĐOẠN của chính ĐỢT (Cắt hoặc công đoạn phụ) này ────────
// (2026-09-05) segments đã có sẵn trong đợt (không còn gọi getCutBundles()/aggregate nhiều bundle
// như bản issue-based cũ - 1 đợt giờ CHÍNH LÀ đơn vị chấm, không cần gộp). Tổng quát hoá
// (2026-09-07) nhận `id`/`segments`/`onReview` thay vì bám cứng `bundle` - dùng chung được cho cả
// CutBundle (Cắt) lẫn StepBundle (công đoạn phụ), 2 nhánh chỉ khác API đích (onReview).
//
// P1 (18/11/2026): cột Đã báo / Thực có (≤ Đã báo, tự về Đã báo kèm câu nhắc) / Cắt: "Lỗi - cắt lại" / công đoạn phụ: "Làm lại" +
// "Bỏ, cắt lại". Thiếu = Đã báo - Thực có, ghi riêng. Vẫn không kẹp im lặng ở ô lỗi / bỏ: báo đỏ + khoá nút. Sau khi lưu, nếu BE
// trả `notes` (Cắt ghi thiếu làm công đoạn sau bị chặn) thì hiện màu vàng và giữ hộp cho tới khi người dùng đóng.

type SegIn = { segmentSpecId: string; cutLengthMm: number; qty: number }
type SegInput = { actual: string; failed: string; rework: string; scrap: string }
const EMPTY_INPUT: SegInput = { actual: '', failed: '', rework: '', scrap: '' }

function QcReviewModal({ kind, id, materialName, skuLabel, segments, onReview, onSaved, onClose }: {
  kind: 'CAT' | 'STEP'; id: string; materialName: string; skuLabel: string
  segments: SegIn[]
  onReview: (id: string, data: {
    segments: ReturnType<typeof buildSegmentsPayload>
    defectReasonId?: string; reason?: string; photoUrl?: string
  }) => Promise<QcReviewResult>
  /** Đã lưu xong (tải lại danh sách) - hộp có thể còn mở để hiện câu cảnh báo. */
  onSaved: () => void
  onClose: () => void
}) {
  const { data: reasons, refetch: refetchReasons } = useFetch<BeDefectReason[]>(() => api.getDefectReasons('PHOI'), [])

  const [inputs, setInputs] = useState<Record<string, SegInput>>({})
  const [clampedBySeg, setClampedBySeg] = useState<Record<string, boolean>>({})
  const [reasonId, setReasonId] = useState<string>('')
  const [note, setNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  /** != null: đã lưu xong; hiện các câu cảnh báo (vàng) trước khi đóng. */
  const [notes, setNotes] = useState<string[] | null>(null)

  const list = reasons ?? []
  const inputOf = (segId: string): SegInput => inputs[segId] ?? EMPTY_INPUT
  const setField = (segId: string, patch: Partial<SegInput>) => setInputs((p) => ({ ...p, [segId]: { ...(p[segId] ?? EMPTY_INPUT), ...patch } }))

  // Không kẹp im lặng (test tay 09/11 điểm 33): lỗi / bỏ sai thì giữ số người dùng gõ, báo đỏ và khoá nút chấm.
  // Riêng Thực có > Đã báo thì tự về Đã báo kèm câu nhắc (S2).
  const rows = segments.map((s) => {
    const inp = inputOf(s.segmentSpecId)
    const calc = calcRow(kind, { reported: s.qty, actual: inp.actual, failed: inp.failed, rework: inp.rework, scrap: inp.scrap })
    return { segmentSpecId: s.segmentSpecId, cutLengthMm: s.cutLengthMm, calc }
  })
  const coLoi = hasBlockingError(rows.map((r) => r.calc))
  const totals = sumRows(rows.map((r) => r.calc))
  const anyClamped = rows.some((r) => clampedBySeg[r.segmentSpecId])

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
    if (coLoi) return
    if (totals.failed > 0 && !reasonId) { setErr('Có đoạn không đạt → phải chọn nguyên nhân'); return }
    setBusy(true); setErr('')
    try {
      const res = await onReview(id, {
        segments: buildSegmentsPayload(kind, rows),
        defectReasonId: totals.failed > 0 ? reasonId : undefined,
        reason: note || undefined,
        photoUrl: photoUrl || undefined,
      })
      onSaved()
      const n = res?.notes ?? []
      if (n.length > 0) setNotes(n)
      else onClose()
    } catch (e) { setErr(errMsg(e, 'Không duyệt được')) }
    finally { setBusy(false) }
  }

  const numInp = (bad: boolean): React.CSSProperties => ({
    width: 64, padding: '5px 7px', fontSize: 12, border: `1px solid ${bad ? RED : 'var(--border)'}`, borderRadius: 6,
    textAlign: 'right', background: 'var(--surface)', color: bad ? RED : 'var(--text)', boxSizing: 'border-box',
  })
  const isCut = kind === 'CAT'

  return (
    <div onClick={notes ? undefined : onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 14, padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, wordBreak: 'break-word' }}>Chấm — {materialName}</h3>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginTop: 4, wordBreak: 'break-word' }}>SKU: {skuLabel}</div>
          </div>
          <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }}><X size={18} /></button>
        </div>

        {notes ? (
          <>
            <div style={{ fontSize: 13, color: GREEN, fontWeight: 600, marginBottom: 10 }}>Đã chấm xong. {totalsText(kind, totals)}</div>
            <div role="status" style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-fef3c7)', color: 'var(--fg-92400e)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notes.map((n, i) => <div key={i} style={{ wordBreak: 'break-word' }}>{n}</div>)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={onClose}
                style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Đóng</button>
            </div>
          </>
        ) : (<>
        <div style={{ ...card, marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={th}>Cỡ đoạn</th>
                <th style={thR}>Đã báo</th>
                <th style={{ ...thR, width: 84 }}>Thực có</th>
                {isCut
                  ? <th style={{ ...thR, width: 100 }}>Lỗi - cắt lại</th>
                  : <>
                    <th style={{ ...thR, width: 84 }}>Làm lại</th>
                    <th style={{ ...thR, width: 100 }}>Bỏ, cắt lại</th>
                  </>}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const inp = inputOf(s.segmentSpecId)
                const bad = s.calc.error !== null
                return (
                  <tr key={s.segmentSpecId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>{s.cutLengthMm.toLocaleString('vi-VN')}mm</td>
                    <td style={tdR}>{s.calc.reported}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <input type="number" min={0} max={s.calc.reported} inputMode="numeric" placeholder={String(s.calc.reported)}
                        value={inp.actual}
                        onChange={(e) => {
                          const c = clampActual(e.target.value, s.calc.reported)
                          setField(s.segmentSpecId, { actual: c.value })
                          setClampedBySeg((p) => ({ ...p, [s.segmentSpecId]: c.clamped }))
                        }}
                        style={numInp(false)} />
                    </td>
                    {isCut ? (
                      <td style={{ ...td, textAlign: 'right' }}>
                        <input type="number" min={0} max={s.calc.reported} inputMode="numeric" placeholder="0"
                          value={inp.failed} onChange={(e) => setField(s.segmentSpecId, { failed: e.target.value })}
                          style={numInp(bad)} />
                      </td>
                    ) : (<>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <input type="number" min={0} max={s.calc.reported} inputMode="numeric" placeholder="0"
                          value={inp.rework} onChange={(e) => setField(s.segmentSpecId, { rework: e.target.value })}
                          style={numInp(bad)} />
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <input type="number" min={0} max={s.calc.reported} inputMode="numeric" placeholder="0"
                          value={inp.scrap} onChange={(e) => setField(s.segmentSpecId, { scrap: e.target.value })}
                          style={numInp(bad)} />
                      </td>
                    </>)}
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={isCut ? 4 : 5} style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Đợt này chưa khai đoạn nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {anyClamped && <div style={{ fontSize: 12, color: AMBER, marginBottom: 8 }}>{MSG_ACTUAL_CLAMPED}</div>}
        {rows.filter((r) => r.calc.error).map((r) => (
          <div key={r.segmentSpecId} style={{ fontSize: 12, color: RED, marginBottom: 4, wordBreak: 'break-word' }}>
            Cỡ {r.cutLengthMm.toLocaleString('vi-VN')}mm: {r.calc.error}
          </div>
        ))}

        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          <b style={{ color: totals.failed > 0 ? RED : 'var(--text3)' }}>{totalsText(kind, totals)}</b>
        </div>

        {totals.failed > 0 && <>
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

        {err && <div style={{ color: RED, fontSize: 13, marginTop: 10, wordBreak: 'break-word' }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Hủy</button>
          <button onClick={submit} disabled={busy || uploading || coLoi}
            style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy || coLoi ? 'not-allowed' : 'pointer', opacity: coLoi ? 0.5 : 1 }}>
            {busy ? '...' : 'Xác nhận chấm'}
          </button>
        </div>
        </>)}
      </div>
    </div>
  )
}
