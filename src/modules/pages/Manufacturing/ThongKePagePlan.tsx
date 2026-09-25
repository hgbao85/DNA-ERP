import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Factory, PackageCheck, Search, ShoppingCart, Wrench, type LucideIcon } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useAuth } from '../../../context/AuthContext'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { errMsg } from '../../../utils/errors'
import * as api from '../../../services/api'
import { useInspection, type PurchaseProposal } from '../../../context/InspectionContext'
import type { Sku } from '../../../types/sku'
import LenhSanXuatBoard, { type BoardColumn } from '../../../components/sanxuat/LenhSanXuatBoard'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import type { ProcessStep } from '../../../types/sku'
import { VatTuDetailBoard, PHOI_CFG, HAN_CFG, SON_CFG, VAT_TU_TP_CFG, lechOf, type ProcLine, type StageCfg } from '../../../components/sanxuat/core'
import type { ManhLine } from '../../../types/manh'
import ManhSkuDetail from '../InboundWarehouse/ManhSkuDetail'
import type { MockPiece } from '../../../lib/mock/chuyen-kiem-fixtures'
import { tabBtn, btnSecondary } from '../../../styles/buttons'
import ProgressBar from '../../../components/ProgressBar'
import type { BePhoiProgressItem } from '../../../services/steel-issues-api'
import type { BeProductionBatchPlan } from '../../../services/production-batches-api'
import type { BeWeavingIssuePlanItem } from '../../../services/weaving-issues-api'
import type { BeTransferCheckPiece } from '../../../services/transfer-check-api'
import type { BePackagingProgress } from '../../../services/packaging-api'

// ─── Types ───────────────────────────────────────────────────────────────────

type OrderStatus = 'PRODUCING' | 'DONE'
type MfgStage = 'PURCHASING' | 'FRAME' | 'WEAVING' | 'CHUYEN_KIEM' | 'PACKAGING'
// 'na' = KHÔNG ÁP DỤNG cho lệnh này (vd sản phẩm không có mảnh đan/không cần sơn) - khác 'pending' (có
// việc nhưng chưa làm). Bước 'na' bị bỏ khỏi phép tính % và điều kiện "Hoàn thành" (audit 2026-09-19 N2).
type SubStatus = 'done' | 'in-progress' | 'pending' | 'na'

// `ncc`/`unitPrice` đã gỡ 2026-08-27 cùng luồng báo giá - giá và NCC nay nằm trong file Excel Sếp
// ký (PurchaseProposalItem.approvalFileUrl), phần mềm không lưu tách ra.
interface MaterialItem {
  name: string
  qty: number      // Tổng SL
  unit: string
  boughtQty: number // Đã mua
}

// Công đoạn Đan dùng chung cấu trúc ManhLine/ManhAllocation + component ManhSkuDetail với "Theo dõi
// xuất đan" (khovttp@demo.com) và "Theo dõi nhập đan" (khotp@demo.com) — xem StageDetailCard.
// BE weaving-points không có field `name` riêng — `code` đóng vai trò tên/định danh chính.
interface WeavingPointLite { id: number; code: string; fullName?: string }

interface StageDetails {
  purchasing: { materials: MaterialItem[] }
  frame: {
    phoi: SubStatus; han: SubStatus; son: SubStatus
    // Dữ liệu chi tiết từng công đoạn nhỏ — cùng cấu trúc ProcLine dùng ở màn
    // Lệnh sản xuất Phôi/Hàn/Sơn, để hiển thị lại y hệt cho KHSX xem (xem FrameSubStages).
    phoiMaterials: PhoiMaterialView[]
    /** Vật tư thành phẩm (vd chân nhôm - Phôi tự báo theo MẢNH, cái) - cùng nguồn Hàn/Sơn, stage=PHOI. */
    phoiVtTpLines: ProcLine[]
    /** Số lệnh (đã duyệt) cùng PI - Phôi cắt chung cho cả PI nên >1 nghĩa là số Phôi dùng chung các lệnh. */
    /** Số đoạn cắt từ đợt CŨ chưa gắn SKU của PI này (không thuộc SKU nào) - chỉ để ghi chú. */
    phoiUnassignedDone: number
    hanLines: ProcLine[]
    sonLines: ProcLine[]
  }
  weaving: { nhapDan: SubStatus; xuatDan: SubStatus; lines: ManhLine[]; skuQty: number }
  // Chuyền kiểm/Đóng gói đọc thật qua getTransferCheckPieces()/getPackaging() — cùng nguồn 2 trang
  // Chuyền kiểm/Đóng gói thật của thủ kho thành phẩm (khotp@demo.com) — xem ChuyenKiemContent/PackagingContent.
  chuyenKiem: { daKiem: SubStatus; pieces: (MockPiece & { daKiemQty: number })[] }
  packaging: { dongGoi: SubStatus; totalBoxes: number; daDongQty: number }
}

interface MfgOrder {
  /** ApprovedRow.itemId (ProductionInvoiceItem.id thật) - KHÔNG dùng pf.id (Sku): nhiều item đã
   *  duyệt có thể fallback về CHUNG 1 Sku (skuByProduct.get(mfgProductId) ở dưới) khi không có Sku
   *  khớp đúng theo cặp PI+product, khiến 2 dòng khác nhau trùng id nếu lấy theo pf.id (React
   *  "duplicate key" ở bảng, 2026-09-01). itemId luôn duy nhất 1-1 theo đúng ý nghĩa "mỗi item đã
   *  duyệt = đúng 1 dòng" (xem comment ApprovedRow). */
  id: string
  code: string        // Mã PO — lấy từ exportOrder.poNumber (dữ liệu thật)
  piCode: string       // Mã PI — 1 SKU trong 1 PO chỉ có đúng 1 PI (xem skus.service.ts)
  sku: string
  productName: string
  customer: string
  deadline?: string
  approvedAt: string
  status: OrderStatus
  mfgStage?: MfgStage
  hasVariance: boolean // lệch định mức ở công đoạn Khung cơ khí (Phôi/Hàn/Sơn) — xem phoiStageStats/aggLineStats
  /** ProductionOrder.id thật - null nếu item duyệt xong nhưng lệnh chưa tạo được ("kẹt", race hiếm).
   *  Cần để gọi nút Bắt đầu/Kết thúc (QLSX) - xem FloorStageCell. */
  orderId: string | null
  /** QLSX kiểm soát qua nút Bắt đầu/Kết thúc ở chính bảng này (2026-08-31) - null nếu orderId null. */
  floorStage: FloorStage | null
  /** Việc 3b (2026-09-21) - true thì hiện nút "Nạp lại định mức" cạnh FloorStageCell. */
  bomOutOfDate: boolean | null
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const MFG_STAGES: { key: MfgStage; label: string; icon: React.ReactNode }[] = [
  { key: 'PURCHASING',  label: 'Mua hàng',     icon: <ShoppingCart size={16} /> },
  { key: 'FRAME',       label: 'Khung cơ khí', icon: <Wrench size={16} /> },
  { key: 'WEAVING',     label: 'Đan',          icon: <Factory size={16} /> },
  { key: 'CHUYEN_KIEM', label: 'Chuyền kiểm',  icon: <ClipboardCheck size={16} /> },
  { key: 'PACKAGING',   label: 'Đóng gói',     icon: <PackageCheck size={16} /> },
]

// Icon riêng cho MfgStageTracker (size nhỏ hơn để vừa vòng tròn 22px) — dùng component thay vì
// element đã dựng sẵn ở MFG_STAGES.icon để tự chọn size khi render.
const STAGE_TRACKER_ICONS: Record<MfgStage, LucideIcon> = {
  PURCHASING: ShoppingCart,
  FRAME: Wrench,
  WEAVING: Factory,
  CHUYEN_KIEM: ClipboardCheck,
  PACKAGING: PackageCheck,
}

// ─── Dữ liệu thật: Sku + PurchaseProposal ───────────────────────────────
// "Danh sách" và "Nội dung mua hàng" đọc trực tiếp từ Sku/PurchaseProposal thật
// (giống TheoDoiMuaHangPage.tsx). Khung cơ khí/Đan/Chuyền kiểm/Đóng gói cũng đã thật —
// xem buildFrame/buildWeaving/buildChuyenKiem/buildPackaging bên dưới.

// Ghép đề xuất mua với lệnh theo MÃ PI (2026-09-19, audit N1): trước đây so p.skuId (placeholder =
// cuttingProposalId) với Sku.id nên KHÔNG BAO GIỜ khớp -> bước Mua hàng luôn "xong". Đề xuất mua vốn
// gộp theo PI nên PI có nhiều lệnh sẽ dùng chung danh sách vật tư (cùng cách Phôi đang gộp theo PI).
function getPurchasingRows(piCode: string, proposals: PurchaseProposal[]): MaterialItem[] {
  return proposals
    .filter(p => p.piCode === piCode)
    .flatMap(p => p.items.map(item => ({
      name: item.name,
      qty: item.buyQty,
      unit: item.unit,
      boughtQty: item.receivedQty ?? 0,
    })))
}

function getPurchasingPercent(materials: MaterialItem[]): number {
  if (materials.length === 0) return 100 // không có gì cần mua → coi như xong bước mua hàng
  // qty<=0 = không có gì cần mua ở dòng này -> coi như đủ (trước đây tính 0 làm % kẹt vĩnh viễn)
  const w = (m: MaterialItem) => m.qty <= 0 ? 1 : Math.min(1, m.boughtQty / m.qty)
  return Math.round(materials.reduce((s, m) => s + w(m), 0) / materials.length * 100)
}

// ─── Dữ liệu chi tiết Khung cơ khí/Đan/Chuyền kiểm/Đóng gói: API thật, tải theo BATCH ────────
// 2026-08-31: BE đã có 5 endpoint "*-batch" (steel-issues-batch, production-batch-plan-batch,
// weaving-issue-plan-batch, transfer-check-batch, packaging-batch) - trước đây mỗi dòng SKU tự
// gọi 1 loạt API riêng (N dòng x tới 6 request/dòng), với PI/PO nào bị nhiều SKU dùng chung thì
// tải trùng lặp y hệt nhau nhiều lần. Giờ CẢ TRANG chỉ gọi đúng 5 request 1 lần (buildBatchProgressData,
// xem cuối file component) rồi map lại từng dòng ĐỒNG BỘ (không async nữa) qua buildOrderRow.

// need<=0 = lệnh không có việc ở bước này -> 'na' (KHÔNG phải 'pending'). Chỉ đúng khi ĐÃ BIẾT chắc
// nguồn dữ liệu tải được - nếu không (tải lỗi / chưa có lệnh) truyền known=false để ra 'pending', tránh
// hiện "xong" giả khi nguồn lỗi.
function subStatusOf(need: number, done: number, known = true): SubStatus {
  if (!known) return 'pending'
  if (need <= 0) return 'na'
  if (done <= 0) return 'pending'
  return done >= need ? 'done' : 'in-progress'
}

// "Đã làm" của MỖI dòng/mảnh bị chặn trần bằng định mức của chính nó (2026-09-19, audit T2): hệ thống cho phép
// báo dư, nên mảnh A báo dư không được bù cho mảnh B còn thiếu, và % không vượt 100.
function lineTotals(lines: ProcLine[]): { need: number; done: number } {
  return { need: lines.reduce((s, l) => s + l.needQty, 0), done: lines.reduce((s, l) => s + Math.min(l.doneQty, l.needQty), 0) }
}

// % nguyên, CHỈ ra 100 khi thật sự đủ (làm tròn xuống - 99,6% không được hiện 100%). Mọi nơi hiển thị % tiến độ
// (thanh công đoạn, tab con, bảng danh sách) đều đi qua hàm này để khớp nhau (audit T1).
function pctOf(need: number, done: number): number {
  if (need <= 0) return 0
  // Đã có làm dù rất nhỏ thì tối thiểu 1% - hiện 0% sẽ như "chưa làm gì" và làm công đoạn bị ẩn khỏi thanh trạng thái.
  return Math.min(100, Math.max(done > 0 ? 1 : 0, Math.floor(Math.min(done, need) / need * 100)))
}

// Đan: xuất/nhập cộng theo TỪNG mảnh đã chặn trần theo tổng cần của mảnh đó.
function weavingTotals(lines: ManhLine[]): { need: number; issued: number; received: number } {
  const sum = (l: ManhLine, k: 'xuatQty' | 'nhapQty') => l.allocations.reduce((a, x) => a + x[k], 0)
  return {
    need: lines.reduce((a, l) => a + l.totalQty, 0),
    issued: lines.reduce((a, l) => a + Math.min(sum(l, 'xuatQty'), l.totalQty), 0),
    received: lines.reduce((a, l) => a + Math.min(sum(l, 'nhapQty'), l.totalQty), 0),
  }
}

// Chuyền kiểm: đã kiểm cộng theo từng mảnh đã chặn trần theo tổng cần của mảnh đó.
function chuyenKiemTotals(pieces: StageDetails['chuyenKiem']['pieces']): { need: number; done: number } {
  return { need: pieces.reduce((a, p) => a + p.totalQty, 0), done: pieces.reduce((a, p) => a + Math.min(p.daKiemQty, p.totalQty), 0) }
}

// Phôi (2026-09-19, audit N3/N4): đo bằng ĐOẠN đã cắt / ĐỊNH MỨC theo từng loại sắt → cỡ đoạn - đúng nguồn
// (getPhoiProgress) mà màn Phôi thật đang dùng - thay cho "số cây kho đã xuất" trước đây (sai khái niệm, và
// coi mỗi đợt xuất của cùng 1 loại sắt là 1 loại sắt riêng nên báo "lệch" giả). Mỗi loại sắt = 1 dòng.
interface PhoiSegmentView { cutLengthMm: number; required: number; done: number; failed: number; good: number; remaining: number }
/** 1 công đoạn của Phôi cho 1 loại sắt: Cắt hoặc công đoạn phụ (Uốn/Dập/...). */
interface PhoiStepView { step: 'CAT' | ProcessStep; label: string; segments: PhoiSegmentView[]; need: number; done: number }
interface PhoiMaterialView {
  materialId: string; materialCode: string; materialName: string; issuedBarCount: number
  /** Cắt + các công đoạn phụ loại sắt này cần đi qua. */
  steps: PhoiStepView[]
  /** Σ các công đoạn: mỗi đoạn tính 1 lần cho MỖI công đoạn nó phải qua (Cắt, Uốn, ...). */
  need: number; done: number
}

// Phôi = Cắt + MỌI công đoạn phụ (Uốn/Dập/Đục lỗ/Tán/Tóp đầu/Xẻ) của từng loại sắt, theo từng cỡ đoạn (2026-09-21).
// orderId = SKU cần xem (số THẬT theo SKU, từ đợt ghi kèm SKU); null = gộp cả PI (dùng cho lớp PI, gồm cả phần đợt
// CŨ chưa gắn SKU). Đợt cũ chưa gắn SKU KHÔNG tính vào SKU nào (trừ PI chỉ 1 SKU - BE đã tự gán).
function mapPhoiSegments(segs: BePhoiProgressItem['segments'], orderId: string | null): PhoiSegmentView[] {
  const out: PhoiSegmentView[] = []
  for (const s of segs) {
    const src = orderId === null
      ? { required: s.required, done: s.done, failed: s.failed }
      : (s.byOrder ?? []).find(o => o.productionOrderId === orderId) ?? { required: 0, done: 0, failed: 0 }
    if (orderId !== null && src.required <= 0 && src.done <= 0 && src.failed <= 0) continue
    // "Đạt" = đã làm trừ lỗi KCS (lỗi cộng dồn, Phôi bù bằng cách làm thêm); chặn trần theo định mức để làm dư ở
    // cỡ này không bù cho cỡ khác còn thiếu.
    const good = Math.min(src.required, Math.max(0, src.done - src.failed))
    out.push({ cutLengthMm: s.cutLengthMm, required: src.required, done: src.done, failed: src.failed, good, remaining: Math.max(0, src.required - (src.done - src.failed)) })
  }
  return out
}

function mapPhoiProgress(items: BePhoiProgressItem[], orderId: string | null): PhoiMaterialView[] {
  const views: PhoiMaterialView[] = []
  for (const it of items) {
    const rawSteps: { step: 'CAT' | ProcessStep; segments: BePhoiProgressItem['segments'] }[] = [
      { step: 'CAT', segments: it.segments },
      ...(it.steps ?? []),
    ]
    const steps: PhoiStepView[] = []
    for (const rs of rawSteps) {
      const segments = mapPhoiSegments(rs.segments, orderId)
      if (segments.length === 0) continue
      steps.push({
        step: rs.step,
        label: rs.step === 'CAT' ? 'Cắt' : PROCESS_STEP_LABELS[rs.step],
        segments,
        need: segments.reduce((a, s) => a + s.required, 0),
        done: segments.reduce((a, s) => a + s.good, 0),
      })
    }
    if (steps.length === 0) continue
    views.push({
      materialId: it.materialId, materialCode: it.materialCode, materialName: it.materialName, issuedBarCount: it.issuedBarCount,
      steps,
      need: steps.reduce((a, st) => a + st.need, 0),
      done: steps.reduce((a, st) => a + st.done, 0),
    })
  }
  return views
}

// Số đoạn đã làm từ các đợt CŨ (trước 2026-09-21) chưa gắn SKU - chỉ hiện ở mức PI (PI nhiều SKU).
function unassignedCutOf(items: BePhoiProgressItem[]): number {
  const one = (segs: BePhoiProgressItem['segments']) => segs.reduce((a, s) => a + ((s.byOrder ?? []).find(o => o.productionOrderId === null)?.done ?? 0), 0)
  return items.reduce((t, it) => t + one(it.segments) + (it.steps ?? []).reduce((a, st) => a + one(st.segments), 0), 0)
}

function mapBatchPlanToLines(plan: BeProductionBatchPlan | null): ProcLine[] {
  return (plan?.items ?? []).map(item => ({
    id: Number(item.pieceId),
    itemName: item.pieceName,
    spec: item.pieceCode,
    needQty: item.plannedQty,
    doneQty: item.passedQty,
    lastInputAt: null,
  }))
}

interface BatchProgressData {
  phoiProgressByPi: Record<string, BePhoiProgressItem[]>
  phoiVtTpPlanByOrder: Record<string, BeProductionBatchPlan>
  hanPlanByOrder: Record<string, BeProductionBatchPlan>
  sonPlanByOrder: Record<string, BeProductionBatchPlan>
  weavingPlanByOrder: Record<string, BeWeavingIssuePlanItem[]>
  transferCheckByItem: Record<string, BeTransferCheckPiece[]>
  packagingByItem: Record<string, BePackagingProgress>
  /** Nhãn các nguồn tải LỖI (rỗng = tải đủ) - nguồn lỗi coi như "không biết", KHÔNG được hiểu là "không có
   *  việc" (audit 2026-09-19 T5) và được báo lên đầu trang. */
  failed: string[]
  /** Chữ ký danh sách dòng mà dữ liệu này được tải cho (xem batchKeyOf) - chỉ dùng được khi khớp đúng danh sách
   *  hiện tại, tránh dùng dữ liệu của danh sách cũ/rỗng cho các lệnh mới (bug 2026-09-21). */
  key: string
}
const EMPTY_BATCH_DATA: BatchProgressData = {
  phoiProgressByPi: {}, phoiVtTpPlanByOrder: {}, hanPlanByOrder: {}, sonPlanByOrder: {},
  weavingPlanByOrder: {}, transferCheckByItem: {}, packagingByItem: {}, failed: [], key: '',
}

function batchKeyOf(rows: ApprovedRow[]): string {
  return rows.map(r => `${r.piId}:${r.orderId ?? ''}:${r.itemId}`).sort().join(',')
}

// 7 request CỐ ĐỊNH cho CẢ TRANG, bất kể có bao nhiêu dòng SKU đã duyệt (trước đây tới 6×N) - mỗi
// dimension bắt lỗi riêng (không gộp vào 1 Promise.all lớn): 1 trong 7 lỗi mạng/429 thoáng qua chỉ
// khiến ĐÚNG dimension đó rỗng (mọi dòng hiện tạm "pending" ở phần đó), không kéo sập 5 dimension
// còn lại hay làm cả trang trắng trơn "Không có lệnh nào" (bug đã gặp thật ở tài khoản Boss
// 2026-08-31, lúc còn 1 Promise.all lớn không bắt lỗi riêng từng phần).
async function buildBatchProgressData(rows: ApprovedRow[]): Promise<BatchProgressData> {
  const piIds = [...new Set(rows.map(r => r.piId))]
  const orderIds = [...new Set(rows.map(r => r.orderId).filter((id): id is string => !!id))]
  const itemIds = [...new Set(rows.map(r => r.itemId))]

  const failed: string[] = []
  const safeFetch = <T extends Record<string, unknown>>(label: string, p: Promise<T>): Promise<T> =>
    p.catch(err => {
      console.error(`ThongKePagePlan: batch fetch '${label}' failed`, err)
      failed.push(label)
      return {} as T
    })

  const [phoiProgressByPi, phoiVtTpPlanByOrder, hanPlanByOrder, sonPlanByOrder, weavingPlanByOrder, transferCheckByItem, packagingByItem] =
    await Promise.all([
      safeFetch('phoi-progress', api.getPhoiProgressBatch(piIds)),
      safeFetch('production-batch-plan(PHOI)', api.getProductionBatchPlanBatch(orderIds, 'PHOI')),
      safeFetch('production-batch-plan(HAN)', api.getProductionBatchPlanBatch(orderIds, 'HAN')),
      safeFetch('production-batch-plan(SON)', api.getProductionBatchPlanBatch(orderIds, 'SON')),
      safeFetch('weaving-issue-plan', api.getWeavingIssuePlanBatch(orderIds)),
      safeFetch('transfer-check', api.getTransferCheckPiecesBatch(itemIds)),
      safeFetch('packaging', api.getPackagingBatch(itemIds)),
    ])
  // Backend BỎ KHỎI kết quả PI nào lấy tiến độ Phôi lỗi (thay vì trả rỗng) - thiếu khoá = không biết, phải báo lỗi.
  if (!failed.includes('phoi-progress') && piIds.some(id => !(id in phoiProgressByPi))) failed.push('phoi-progress')
  return { phoiProgressByPi, phoiVtTpPlanByOrder, hanPlanByOrder, sonPlanByOrder, weavingPlanByOrder, transferCheckByItem, packagingByItem, failed, key: batchKeyOf(rows) }
}

function buildFrame(
  phoiProgress: BePhoiProgressItem[] | null, vtTpPlan: BeProductionBatchPlan | null,
  hanPlan: BeProductionBatchPlan | null, sonPlan: BeProductionBatchPlan | null, orderId: string | null,
): StageDetails['frame'] {
  const phoiMaterials = mapPhoiProgress(phoiProgress ?? [], orderId)
  const phoiVtTpLines = mapBatchPlanToLines(vtTpPlan)
  const hanLines = mapBatchPlanToLines(hanPlan)
  const sonLines = mapBatchPlanToLines(sonPlan)
  const vtTpTotals = lineTotals(phoiVtTpLines)
  const phoiNeed = phoiMaterials.reduce((a, m) => a + m.need, 0) + vtTpTotals.need
  const phoiDone = phoiMaterials.reduce((a, m) => a + m.done, 0) + Math.min(vtTpTotals.done, vtTpTotals.need)
  // Cần đủ CẢ 2 nguồn (định mức cắt + vật tư thành phẩm) mới biết chắc; thiếu 1 nguồn -> 'pending'.
  const phoi = subStatusOf(phoiNeed, phoiDone, phoiProgress !== null && vtTpPlan !== null)
  const hanTotals = lineTotals(hanLines)
  const sonTotals = lineTotals(sonLines)
  // plan null = không biết (chưa có lệnh/tải lỗi) -> 'pending'; plan có nhưng không mảnh nào cần Hàn/Sơn -> 'na'.
  return {
    phoi,
    han: subStatusOf(hanTotals.need, hanTotals.done, hanPlan !== null),
    son: subStatusOf(sonTotals.need, sonTotals.done, sonPlan !== null),
    phoiMaterials, phoiVtTpLines, phoiUnassignedDone: unassignedCutOf(phoiProgress ?? []), hanLines, sonLines,
  }
}

// Đan: dùng nguyên component thật ManhSkuDetail (đã dùng cho 2 màn thủ kho thật) — chỉ đổi nguồn
// dữ liệu nạp vào từ mock sang weaving-issue-plan-batch thật.
function buildWeaving(itemsOrNull: BeWeavingIssuePlanItem[] | null, skuQty: number): StageDetails['weaving'] {
  const items = itemsOrNull ?? []
  const lines: ManhLine[] = items.map(it => ({
    id: Number(it.pieceId),
    name: it.pieceName,
    unit: 'cái',
    totalQty: it.totalQty,
    tonThuc: it.remainingToIssue,
    allocations: it.allocations.map((a, ai) => ({
      id: Number(it.pieceId) * 1000 + ai,
      weavingPointId: Number(a.weavingPointId),
      xuatQty: a.issuedQty,
      nhapQty: a.receivedQty,
    })),
  }))
  const { need: totalQty, issued: issuedQty, received: receivedQty } = weavingTotals(lines)
  // "Nhập đan" so với TỔNG cần (không phải với số đã xuất - audit T4): xuất 5/100 rồi nhận đủ 5 mới là 5%.
  const known = itemsOrNull !== null
  return { xuatDan: subStatusOf(totalQty, issuedQty, known), nhapDan: subStatusOf(totalQty, receivedQty, known), lines, skuQty }
}

// Chuyền kiểm: readyQty ("chờ thực thi") là luỹ kế SUM(WeavingReceipt.qty), KHÔNG trừ phần đã kiểm
// (xem transfer-check-api.ts) — "chờ thực thi hiện tại" = readyQty - checkedQty, khớp đúng ý nghĩa
// cột "Chờ thực thi" của ChuyenKiemContent bên dưới (remaining = totalQty - choThucThi - daKiemQty).
function buildChuyenKiem(pieces: BeTransferCheckPiece[], known: boolean): StageDetails['chuyenKiem'] {
  const mapped = pieces.map(p => ({
    id: p.pieceId, name: p.pieceName, totalQty: p.totalQty,
    choThucThi: Math.max(0, p.readyQty - p.checkedQty),
    daKiemQty: p.checkedQty,
  }))
  const { need, done } = chuyenKiemTotals(mapped)
  return { daKiem: subStatusOf(need, done, known), pieces: mapped }
}

// Đóng gói luôn áp dụng cho mọi lệnh (tổng = số lượng lệnh) - totalQty 0 chỉ xảy ra khi chưa có lệnh/tải lỗi
// nên là 'pending', không phải 'na'.
function buildPackaging(progress: BePackagingProgress | undefined): StageDetails['packaging'] {
  const p = progress ?? { totalQty: 0, packedQty: 0, remainingQty: 0 }
  return { dongGoi: p.totalQty > 0 ? subStatusOf(p.totalQty, p.packedQty) : 'pending', totalBoxes: p.totalQty, daDongQty: p.packedQty }
}

function emptyExecutionStages(skuQty: number): Pick<StageDetails, 'frame' | 'weaving' | 'chuyenKiem' | 'packaging'> {
  return {
    frame: { phoi: 'pending', han: 'pending', son: 'pending', phoiMaterials: [], phoiVtTpLines: [], phoiUnassignedDone: 0, hanLines: [], sonLines: [] },
    weaving: { nhapDan: 'pending', xuatDan: 'pending', lines: [], skuQty },
    chuyenKiem: { daKiem: 'pending', pieces: [] },
    packaging: { dongGoi: 'pending', totalBoxes: 0, daDongQty: 0 },
  }
}

function buildExecutionStages(row: ApprovedRow, skuQty: number, batch: BatchProgressData): Pick<StageDetails, 'frame' | 'weaving' | 'chuyenKiem' | 'packaging'> {
  const phoiProgress = batch.phoiProgressByPi[row.piId] ?? null
  const vtTpPlan = row.orderId ? (batch.phoiVtTpPlanByOrder[row.orderId] ?? null) : null
  const hanPlan = row.orderId ? (batch.hanPlanByOrder[row.orderId] ?? null) : null
  const sonPlan = row.orderId ? (batch.sonPlanByOrder[row.orderId] ?? null) : null
  const weavingItems = row.orderId ? (batch.weavingPlanByOrder[row.orderId] ?? null) : null
  const transferCheckPieces = batch.transferCheckByItem[row.itemId] ?? []
  // BE luôn trả mảng (rỗng) cho mọi itemId kể cả khi tải lỗi/chưa có lệnh -> phải tự xác định "đã biết chắc".
  const transferKnown = !!row.orderId && !batch.failed.includes('transfer-check')
  const packagingProgress = batch.packagingByItem[row.itemId]
  return {
    frame: buildFrame(phoiProgress, vtTpPlan, hanPlan, sonPlan, row.orderId),
    weaving: buildWeaving(weavingItems, skuQty),
    chuyenKiem: buildChuyenKiem(transferCheckPieces, transferKnown),
    packaging: buildPackaging(packagingProgress),
  }
}

// Đồng bộ hoàn toàn (không còn gọi API riêng/dòng) - mọi dữ liệu tiến độ đã có sẵn trong `batch`
// (tải 1 lần cho cả trang, xem buildBatchProgressData). Nguồn định danh (piId/orderId/itemId/
// poCode/piCode/deadline) lấy thẳng từ `row` (ProductionInvoiceItem thật), KHÔNG qua pf.exportOrder/
// pf.piCode tĩnh nữa - chính xác hơn cả cách "H6 fix" trước đây (poInfoMap dò theo mfgProductId,
// "lấy ProductionOrder đầu tiên tìm thấy") vì đây là đúng-1-1 theo chính item đang xét.
function buildOrderRow(row: ApprovedRow, proposals: PurchaseProposal[], batch: BatchProgressData): { order: MfgOrder; details: StageDetails } {
  const { pf, skuQty } = row
  const materials = getPurchasingRows(row.piCode, proposals)
  const purchPct = getPurchasingPercent(materials)
  // Luôn dựng tiến độ thực thi từ dữ liệu thật, KHÔNG còn ẩn khi Mua hàng <100% (2026-09-19): mua hàng
  // giờ đã ghép đúng nên có thể <100% trong khi Phôi/Đan... đã chạy (các công đoạn song song); dữ liệu
  // thật tự nói lên việc đã làm, ẩn đi chỉ khiến Giám đốc thấy sai lệch.
  const stages = row.orderId ? buildExecutionStages(row, skuQty, batch) : emptyExecutionStages(skuQty)
  const { frame, weaving, chuyenKiem, packaging } = stages
  const details: StageDetails = { purchasing: { materials }, frame, weaving, chuyenKiem, packaging }
  // "Đã kết thúc" của xưởng (QLSX bấm Kết thúc, không hoàn tác được - xem FloorStageCell) cũng là hoàn thành:
  // nhiều lệnh không có phiếu xuất sắt/mảnh đan nên các bước con không bao giờ tự "xong" (audit N2).
  const done = row.floorStage === 'FINISHED' || isAllDone(details)
  const anyExecProgress = Array.from(PARALLEL_STAGE_KEYS).some(k => !isStageNA(k, details) && getStagePercent(k, details) > 0)
  const hasVariance = aggLineStats(frame.hanLines).lech || aggLineStats(frame.sonLines).lech
  const order: MfgOrder = {
    id: row.itemId,
    code: row.poCode ?? 'Chưa gắn đơn hàng',
    piCode: row.piCode,
    sku: pf.mfgProduct?.factoryCode ?? '—',
    productName: pf.mfgProduct?.name ?? '',
    customer: pf.customerName ?? '—',
    deadline: row.deliveryDeadline,
    approvedAt: pf.createdAt,
    status: done ? 'DONE' : 'PRODUCING',
    // Còn ở "Mua hàng" chỉ khi chưa mua đủ VÀ chưa có công đoạn nào bắt đầu chạy.
    mfgStage: done ? undefined : (purchPct < 100 && !anyExecProgress ? 'PURCHASING' : 'FRAME'),
    hasVariance,
    orderId: row.orderId,
    floorStage: row.floorStage,
    bomOutOfDate: row.bomOutOfDate,
  }
  return { order, details }
}

// ─── Status meta ──────────────────────────────────────────────────────────────

const STATUS_META: Record<OrderStatus, { label: string; bg: string; color: string; border: string }> = {
  PRODUCING: { label: 'Đang sản xuất', bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber)' },
  DONE:      { label: 'Hoàn thành',    bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green)' },
}

// ─── Trạng thái xưởng (QLSX Bắt đầu/Kết thúc, 2026-08-31) ──────────────────────
// ĐỘC LẬP với STATUS_META ở trên (đó là trạng thái tổng hợp CÔNG VIỆC của lệnh, còn đây là cổng
// hiển thị do QLSX kiểm soát cho Phôi/Hàn/Sơn thấy hay không - xem ProductionOrderFloorStage BE).

const FLOOR_STAGE_META: Record<FloorStage, { label: string; color: string; bg: string }> = {
  PENDING:  { label: 'Chưa bắt đầu', color: 'var(--text3)', bg: 'var(--surface2)' },
  ACTIVE:   { label: 'Đang chạy',    color: 'var(--amber)', bg: 'var(--amber-bg)' },
  PAUSED:   { label: 'Đang tạm dừng', color: '#d97706',      bg: '#fef3c7' },
  FINISHED: { label: 'Đã kết thúc',  color: 'var(--green)', bg: 'var(--green-bg)' },
}

// 2026-09-01: mỗi nút đều hỏi lại xác nhận trước khi gọi API (window.confirm - cùng idiom đã dùng
// ở MfgWarehousesPage/LenhMuaNCCPage) - bấm nhầm "Kết thúc"/"Tạm dừng" ngay trên bảng danh sách
// (không có undo) ảnh hưởng luôn tới gate assertPiHasActiveFloor() phía dưới (chặn cả PI, không
// riêng SKU này) nên cần chắn thêm 1 bước trước khi gọi.
const FLOOR_ACTION_CONFIRM: Record<'start' | 'resume' | 'pause' | 'finish', string> = {
  start:  'Xác nhận BẮT ĐẦU sản xuất lệnh này?',
  resume: 'Xác nhận TIẾP TỤC sản xuất lệnh này?',
  pause:  'Xác nhận TẠM DỪNG lệnh này? Các thao tác ghi trên xưởng (xuất vật tư/báo sản lượng/KCS...) của cả PI sẽ bị chặn cho tới khi Bắt đầu/Tiếp tục lại (nếu không còn SKU nào khác trong PI đang chạy).',
  finish: 'Xác nhận KẾT THÚC lệnh này? Không thể hoàn tác thao tác này.',
}

const floorActionBtn = (bg: string): React.CSSProperties => ({
  padding: '4px 10px', fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 6,
  background: bg, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
})

// Chỉ QLSX (canManage=true) mới thấy nút - Boss/KHSX chỉ xem badge. orderId null nghĩa là item đã
// duyệt nhưng ProductionOrder chưa tạo được (kẹt, race hiếm) - không có gì để Bắt đầu/Kết thúc.
// PENDING: chỉ "Bắt đầu". ACTIVE: "Tạm dừng" + "Kết thúc". PAUSED: "Tiếp tục" (dùng lại route
// floor-start, xem handleFloorAction) + "Kết thúc" (không bắt buộc tiếp tục trước khi kết thúc).
function FloorStageCell({
  orderId, floorStage, bomOutOfDate, canManage, pending, onStart, onResume, onPause, onFinish, onResync,
}: {
  orderId: string | null
  floorStage: FloorStage | null
  bomOutOfDate: boolean | null
  canManage: boolean
  pending: boolean
  onStart: () => void
  onResume: () => void
  onPause: () => void
  onFinish: () => void
  onResync: () => void
}) {
  if (!orderId || !floorStage) {
    return <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
  }
  const meta = FLOOR_STAGE_META[floorStage]
  // "Nạp lại định mức" chỉ hiện khi floorStage=PENDING - khớp đúng điều kiện BE chặn (xưởng đã
  // bấm Bắt đầu thì API 409, xem ProductionOrdersService.resyncBom()) - không hiện nút sẽ chắc
  // chắn thất bại. bomOutOfDate=null (chưa có ProductionOrder) đã bị chặn ở nhánh orderId phía trên.
  const canResync = canManage && floorStage === 'PENDING' && bomOutOfDate === true
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>
        {meta.label}
      </span>
      {canManage && floorStage !== 'FINISHED' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
          {floorStage === 'PENDING' && (
            <button disabled={pending} onClick={onStart} style={floorActionBtn('#1d4ed8')}>Bắt đầu</button>
          )}
          {floorStage === 'ACTIVE' && (
            <button disabled={pending} onClick={onPause} style={floorActionBtn('#d97706')}>Tạm dừng</button>
          )}
          {floorStage === 'PAUSED' && (
            <button disabled={pending} onClick={onResume} style={floorActionBtn('#1d4ed8')}>Tiếp tục</button>
          )}
          <button disabled={pending} onClick={onFinish} style={floorActionBtn('#dc2626')}>Kết thúc</button>
          {canResync && (
            <button disabled={pending} onClick={onResync} style={floorActionBtn('#7c3aed')} title="Định mức sản phẩm đã đổi sau khi lệnh này được duyệt - nạp lại bản mới nhất">
              Nạp lại định mức
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Đơn lệnh quá hạn khi có deadline, đã qua hạn, và chưa hoàn thành — dùng chung cho bảng danh sách + trang chi tiết
// để tránh 2 cài đặt độc lập của cùng 1 quy tắc nghiệp vụ lệch nhau.
function isOrderOverdue(deadline: string | undefined, isDone: boolean): boolean {
  return !!deadline && new Date(deadline) < new Date() && !isDone
}

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface2)', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, borderTop: '1px solid var(--border)', verticalAlign: 'middle' }

type FilterStatus = 'all' | OrderStatus
const PAGE_SIZE = 20

// ─── Stage detail sub-components ──────────────────────────────────────────────

// Bố cục cột giống trang "Theo dõi mua hàng" (account mua hàng) — xem TheoDoiMuaHangPage.tsx.
// Hạn giao lấy chung từ deadline của lệnh SX (sync từ KHSX), không lưu riêng theo từng vật tư.
function PurchasingContent({ materials, deadline }: { materials: MaterialItem[]; deadline?: string }) {
  const thS: React.CSSProperties = { padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }
  if (materials.length === 0) {
    return <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--text3)' }}>Chưa có đề xuất mua vật tư nào cho lệnh này</div>
  }
  return (
    <div>
    {deadline && (
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
        Hạn giao vật tư: <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{format(new Date(deadline), 'dd/MM/yyyy')}</span>
      </div>
    )}
    <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thS}>Tên vật tư</th>
          <th style={{ ...thS, textAlign: 'right' }}>Tổng SL</th>
          <th style={thS}>ĐVT</th>
          <th style={{ ...thS, textAlign: 'right' }}>Đã mua</th>
          <th style={{ ...thS, textAlign: 'right' }}>Còn lại</th>
        </tr>
      </thead>
      <tbody>
        {materials.map((m, i) => {
          const remaining = Math.max(0, m.qty - m.boughtQty)
          return (
            <tr key={i}>
              <td style={{ ...tdS, fontWeight: 600 }}>{m.name}</td>
              <td style={{ ...tdS, textAlign: 'right' }}>{m.qty.toLocaleString('vi-VN')}</td>
              <td style={{ ...tdS, color: 'var(--text3)' }}>{m.unit}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: m.boughtQty > 0 ? '#16a34a' : 'var(--text3)' }}>{m.boughtQty.toLocaleString('vi-VN')}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: remaining > 0 ? '#d97706' : '#16a34a' }}>{remaining.toLocaleString('vi-VN')}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
    </div>
    </div>
  )
}

// Bảng mảnh chờ kiểm/đã kiểm — cùng cột với trang Chuyền kiểm thật của thủ kho thành phẩm
// (khotp@demo.com), chỉ xem (không có nút "Kiểm").
function ChuyenKiemContent({ chuyenKiem }: { chuyenKiem: StageDetails['chuyenKiem'] }) {
  const thS: React.CSSProperties = { padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }
  if (chuyenKiem.pieces.length === 0) {
    return <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--text3)' }}>Chưa tới lượt kiểm — đợi công đoạn Đan hoàn tất</div>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thS}>Mảnh</th>
          <th style={{ ...thS, textAlign: 'right' }}>Chờ thực thi</th>
          <th style={{ ...thS, textAlign: 'right' }}>Đã kiểm</th>
          <th style={{ ...thS, textAlign: 'right' }}>Còn lại</th>
        </tr>
      </thead>
      <tbody>
        {chuyenKiem.pieces.map(p => {
          const remaining = Math.max(0, p.totalQty - p.choThucThi - p.daKiemQty)
          return (
            <tr key={p.id}>
              <td style={{ ...tdS, fontWeight: 600 }}>{p.name}</td>
              <td style={{ ...tdS, textAlign: 'right', color: 'var(--text3)' }}>{p.choThucThi.toLocaleString('vi-VN')}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: p.daKiemQty > 0 ? '#16a34a' : 'var(--text3)' }}>{p.daKiemQty.toLocaleString('vi-VN')}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: remaining > 0 ? '#d97706' : '#16a34a' }}>{remaining.toLocaleString('vi-VN')}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
    </div>
  )
}

// 3 số tổng thùng — cùng số liệu với trang Đóng gói thật của thủ kho thành phẩm, chỉ xem.
function PackagingContent({ packaging }: { packaging: StageDetails['packaging'] }) {
  if (packaging.totalBoxes === 0) {
    return <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--text3)' }}>Chưa tới lượt đóng gói — đợi công đoạn Chuyền kiểm hoàn tất</div>
  }
  const remaining = Math.max(0, packaging.totalBoxes - packaging.daDongQty)
  const stats: { label: string; value: number; color: string }[] = [
    { label: 'Tổng thùng',   value: packaging.totalBoxes, color: 'var(--text)' },
    { label: 'Đã đóng gói',  value: packaging.daDongQty,  color: packaging.daDongQty > 0 ? '#16a34a' : 'var(--text3)' },
    { label: 'Còn lại',      value: remaining,             color: remaining > 0 ? '#d97706' : '#16a34a' },
  ]
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {stats.map(s => (
        <div key={s.label} style={{ flex: '1 1 140px', minWidth: 140, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{s.label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value.toLocaleString('vi-VN')}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Khung cơ khí: 3 tab con Phôi/Hàn/Sơn ─────────────────────────────────────
// Nhúng lại đúng bảng chi tiết (VatTuDetailBoard) dùng ở màn Lệnh sản xuất của phoi@/han@/son@demo.com,
// ở chế độ chỉ xem (không có cột nhập/xác nhận) — để KHSX xem được thông tin chi tiết như 3 account đó.

type FrameSubTab = 'PHOI' | 'HAN' | 'SON'

// Thời điểm nhập gần nhất trong 1 tập dòng vật tư — dùng để KHSX biết dữ liệu còn "nóng" hay không.
function latestInputAt(lines: ProcLine[]): string | null {
  return lines.reduce<string | null>((latest, l) => (l.lastInputAt && (!latest || l.lastInputAt > latest)) ? l.lastInputAt : latest, null)
}

interface StageLineStats { need: number; done: number; pct: number; lech: boolean; lastInputAt: string | null }

function aggLineStats(lines: ProcLine[]): StageLineStats {
  const { need, done } = lineTotals(lines)
  return { need, done, pct: pctOf(need, done), lech: lechOf(lines), lastInputAt: latestInputAt(lines) }
}

// Phôi: % = (đoạn đã cắt đạt + vật tư thành phẩm đã báo) / (định mức đoạn + vật tư thành phẩm cần), mỗi cỡ
// đoạn chặn trần theo định mức của chính nó (xem mapPhoiProgress). Không có khái niệm "lệch" ở Phôi.
function phoiStageStats(frame: StageDetails['frame']): StageLineStats {
  const vt = lineTotals(frame.phoiVtTpLines)
  const need = frame.phoiMaterials.reduce((s, m) => s + m.need, 0) + vt.need
  const done = frame.phoiMaterials.reduce((s, m) => s + m.done, 0) + Math.min(vt.done, vt.need)
  return { need, done, pct: pctOf(need, done), lech: false, lastInputAt: null }
}

// ─── Tab chuyển Phôi/Hàn/Sơn ──────────────────────────────────────────────────
// Trước đây là 3 card to (viền + progress bar + mô tả riêng từng thẻ) — trùng lặp với thanh tiến độ
// tổng ở trên. Giờ chỉ còn 1 hàng tab gọn (icon + nhãn + % + cờ lệch định mức nếu có), giống hệt
// pattern tab công đoạn chính (tabBtn) để nhất quán trong toàn trang.
function FrameStageTab({ cfg, stats, active, onClick }: {
  cfg: StageCfg; stats: StageLineStats; active: boolean; onClick: () => void
}) {
  const Icon = cfg.Icon
  const accent = stats.lech ? 'var(--red)' : stats.pct >= 100 ? 'var(--green)' : stats.pct > 0 ? 'var(--amber)' : 'var(--text3)'
  return (
    <button
      onClick={onClick}
      title={stats.lech ? `${cfg.label}: vật tư chưa cân đối — bấm để xem chi tiết` : `Xem chi tiết công đoạn ${cfg.label}`}
      style={tabBtn(active, accent)}
    >
      <Icon size={14} /> {cfg.label}
      {stats.lech && <AlertTriangle size={12} />}
      <span>{stats.pct}%</span>
    </button>
  )
}

// Phôi: bảng theo LOẠI SẮT (mỗi loại 1 dòng, gộp mọi đợt kho xuất), bấm mở ra từng cỡ đoạn - cùng số liệu
// "Cần / Đã cắt / Lỗi / Còn lại" (đơn vị ĐOẠN) với màn Lệnh sản xuất Phôi thật. Không có cờ "lệch": các loại
// sắt khác nhau không so sánh chéo được, mỗi loại tự có định mức riêng.
function PhoiMaterialBoard({ materials }: { materials: PhoiMaterialView[] }) {
  const cols: BoardColumn<PhoiMaterialView>[] = [
    { key: 'mat', header: 'Loại sắt', cell: m => (
      <div>
        <div style={{ fontWeight: 700 }}>{m.materialName}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.materialCode}</div>
      </div>
    ) },
    { key: 'issued', header: 'Kho đã xuất cả PI (cây)', align: 'right', cell: m => m.issuedBarCount.toLocaleString('vi-VN') },
    { key: 'steps', header: 'Công đoạn', cell: m => <span style={{ fontSize: 12, color: 'var(--text2)' }}>{m.steps.map(st => st.label).join(' → ')}</span> },
    { key: 'need', header: 'Cần', align: 'right', cell: m => m.need.toLocaleString('vi-VN') },
    { key: 'done', header: 'Đã xong (đạt)', align: 'right', cell: m => <span style={{ fontWeight: 700 }}>{m.done.toLocaleString('vi-VN')}</span> },
    { key: 'remain', header: 'Còn lại', align: 'right', cell: m => {
      const r = Math.max(0, m.need - m.done)
      return <span style={{ color: r > 0 ? 'var(--amber)' : 'var(--green)', fontWeight: 600 }}>{r.toLocaleString('vi-VN')}</span>
    } },
  ]
  const th: React.CSSProperties = { padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'right', textTransform: 'uppercase' }
  const td: React.CSSProperties = { padding: '6px 10px', fontSize: 12, textAlign: 'right', borderTop: '1px solid var(--border)' }
  return (
    <LenhSanXuatBoard
      title="Tiến độ Phôi theo loại sắt"
      subtitle="Phôi gồm Cắt và các công đoạn phụ (Uốn, Dập…) tùy loại sắt. Mỗi đoạn tính 1 lần cho mỗi công đoạn nó phải qua; “đạt” = đã làm trừ đoạn KCS chấm lỗi. Chi tiết từng công đoạn và cỡ đoạn hiện bên dưới mỗi loại sắt"
      columns={cols} rows={materials} rowKey={m => m.materialId}
      expandedRow={m => (
        <div style={{ padding: '4px 14px 14px', background: 'var(--surface2)' }}>
          {m.steps.map(st => (
            <div key={st.step} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                {st.label} · {st.done.toLocaleString('vi-VN')}/{st.need.toLocaleString('vi-VN')} đoạn
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left' }}>Cỡ đoạn</th><th style={th}>Cần</th><th style={th}>Đã làm</th><th style={th}>Lỗi</th><th style={th}>Còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {st.segments.map(s => (
                    <tr key={s.cutLengthMm}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{s.cutLengthMm.toLocaleString('vi-VN')} mm</td>
                      <td style={td}>{s.required.toLocaleString('vi-VN')}</td>
                      <td style={td}>{s.done.toLocaleString('vi-VN')}</td>
                      <td style={{ ...td, color: s.failed > 0 ? 'var(--red)' : 'var(--text3)', fontWeight: s.failed > 0 ? 700 : 400 }}>{s.failed > 0 ? s.failed.toLocaleString('vi-VN') : '—'}</td>
                      <td style={{ ...td, fontWeight: 600, color: s.remaining > 0 ? 'var(--amber)' : 'var(--green)' }}>{s.remaining.toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    />
  )
}

function FrameSubStages({ frame }: { frame: StageDetails['frame'] }) {
  const [tab, setTab] = useState<FrameSubTab>('PHOI')

  const tabs: { key: FrameSubTab; cfg: StageCfg; stats: StageLineStats }[] = [
    { key: 'PHOI', cfg: PHOI_CFG, stats: phoiStageStats(frame) },
    { key: 'HAN',  cfg: HAN_CFG,  stats: aggLineStats(frame.hanLines) },
    { key: 'SON',  cfg: SON_CFG,  stats: aggLineStats(frame.sonLines) },
  ]
  const activeTab = tabs.find(t => t.key === tab)!

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
        {tabs.map(t => (
          <FrameStageTab key={t.key} cfg={t.cfg} stats={t.stats} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
      </div>

      {activeTab.stats.lech && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--red)', marginBottom: 12 }}>
          <AlertTriangle size={13} /> {activeTab.cfg.label}: vật tư chưa cân đối, cần kiểm tra
        </div>
      )}

      {tab === 'PHOI' && (
        <>
          {frame.phoiUnassignedDone > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              PI này còn {frame.phoiUnassignedDone.toLocaleString('vi-VN')} đoạn đã làm từ trước khi Phôi ghi theo SKU — không thuộc SKU nào, chỉ tính ở mức PI.
            </div>
          )}
          {frame.phoiMaterials.length === 0 && frame.phoiVtTpLines.length === 0 && (
            <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--text3)' }}>Lệnh này chưa có định mức cắt sắt / vật tư thành phẩm nào</div>
          )}
          {frame.phoiMaterials.length > 0 && <PhoiMaterialBoard materials={frame.phoiMaterials} />}
          {frame.phoiVtTpLines.length > 0 && (
            <div style={{ marginTop: frame.phoiMaterials.length > 0 ? 18 : 0 }}>
              <VatTuDetailBoard
                lines={frame.phoiVtTpLines} cfg={VAT_TU_TP_CFG} readOnly showThucCo={false}
                title="Vật tư thành phẩm" subtitle="Phôi tự báo theo mảnh (vd chân nhôm) — chỉ xem"
                bannerLabel="Đồng bộ"
              />
            </div>
          )}
        </>
      )}
      {tab === 'HAN' && (
        <VatTuDetailBoard
          lines={frame.hanLines} cfg={HAN_CFG} readOnly
          title="Chi tiết hàn khung" subtitle="Tiến độ hàn ráp theo từng mảnh — chỉ xem"
          bannerLabel="Đồng bộ"
        />
      )}
      {tab === 'SON' && (
        <VatTuDetailBoard
          lines={frame.sonLines} cfg={SON_CFG} readOnly
          title="Chi tiết sơn phủ" subtitle="Tiến độ sơn theo loại sơn — chỉ xem"
          bannerLabel="Đồng bộ"
        />
      )}
    </div>
  )
}

// ─── Đan: chỉ hiện "Nhập đan" ──────────────────────────────────────────────────
// Dùng lại đúng component ManhSkuDetail (chế độ 'view') như "Theo dõi xuất đan"/"Theo dõi nhập đan"
// bên kho — đã lược bỏ 2 cấp PO/SKU vì đã ở đúng 1 lệnh. Không hiện "Xuất đan" riêng — chỉ "Nhập
// đan" là đủ để KHSX theo dõi công đoạn Đan.
function WeavingSubStages({ weaving, pointLabel }: { weaving: StageDetails['weaving']; pointLabel: (id: number) => string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Thống kê đan</span>
      </div>
      <ManhSkuDetail lines={weaving.lines} skuQty={weaving.skuQty} pointLabel={pointLabel} variant="view" />
    </div>
  )
}

// ─── Parallel stage helpers ───────────────────────────────────────────────────

const PARALLEL_STAGE_KEYS = new Set<MfgStage>(['FRAME', 'WEAVING', 'CHUYEN_KIEM', 'PACKAGING'])
// Công đoạn hiển thị kèm % (Mua hàng giờ cũng có % thật - audit N1).
const PERCENT_STAGE_KEYS = new Set<MfgStage>(['PURCHASING', 'FRAME', 'WEAVING', 'CHUYEN_KIEM', 'PACKAGING'])

// Các bước con của 1 công đoạn (dùng chung cho % / "không áp dụng" / "xong").
function subStatusesOf(key: MfgStage, details: StageDetails): SubStatus[] {
  if (key === 'FRAME')       return [details.frame.phoi, details.frame.han, details.frame.son]
  if (key === 'WEAVING')     return [details.weaving.xuatDan, details.weaving.nhapDan]
  if (key === 'CHUYEN_KIEM') return [details.chuyenKiem.daKiem]
  if (key === 'PACKAGING')   return [details.packaging.dongGoi]
  return []
}

// Công đoạn mà MỌI bước con đều "không áp dụng" cho lệnh này (vd không có mảnh đan).
function isStageNA(key: MfgStage, details: StageDetails): boolean {
  const subs = subStatusesOf(key, details)
  return subs.length > 0 && subs.every(s => s === 'na')
}

function getStagePercent(key: MfgStage, details: StageDetails): number {
  if (key === 'PURCHASING') return getPurchasingPercent(details.purchasing.materials)
  // % theo SỐ LƯỢNG THẬT (audit T1), cùng hàm với các tab con bên dưới nên hai nơi luôn khớp nhau. Công
  // đoạn có nhiều bước con (Khung cơ khí, Đan) = trung bình cộng % các bước còn áp dụng; bước 'na' bỏ qua,
  // cả công đoạn không áp dụng -> 100 (không kéo lệnh xuống).
  const subs = subStatusesOf(key, details)
  const pcts: number[] = []
  const add = (status: SubStatus, pct: number) => { if (status !== 'na') pcts.push(pct) }
  if (key === 'FRAME') {
    add(subs[0], phoiStageStats(details.frame).pct)
    add(subs[1], aggLineStats(details.frame.hanLines).pct)
    add(subs[2], aggLineStats(details.frame.sonLines).pct)
  } else if (key === 'WEAVING') {
    const t = weavingTotals(details.weaving.lines)
    add(subs[0], pctOf(t.need, t.issued))
    add(subs[1], pctOf(t.need, t.received))
  } else if (key === 'CHUYEN_KIEM') {
    const t = chuyenKiemTotals(details.chuyenKiem.pieces)
    add(subs[0], pctOf(t.need, t.done))
  } else if (key === 'PACKAGING') {
    add(subs[0], pctOf(details.packaging.totalBoxes, details.packaging.daDongQty))
  }
  if (pcts.length === 0) return 100
  const sum = pcts.reduce((a, b) => a + b, 0)
  return Math.max(sum > 0 ? 1 : 0, Math.floor(sum / pcts.length))
}

function isAllDone(details: StageDetails): boolean {
  const ok = (s: SubStatus) => s === 'done' || s === 'na'
  return (
    getPurchasingPercent(details.purchasing.materials) >= 100 &&
    (['FRAME', 'WEAVING', 'CHUYEN_KIEM', 'PACKAGING'] as MfgStage[]).every(k => subStatusesOf(k, details).every(ok))
  )
}

// Công đoạn song song (Frame/Weaving/ChuyenKiem/Packaging) đang là "điểm nghẽn" hiện tại của lệnh —
// công đoạn đầu tiên (theo thứ tự MFG_STAGES) có % > 0 và < 100; nếu không có công đoạn nào dở dang
// thì trả về công đoạn cuối cùng đã có tiến độ (đã xong, công đoạn kế tiếp chưa bắt đầu).
function getCurrentParallelStage(details: StageDetails): { stage: MfgStage; pct: number } | null {
  let last: { stage: MfgStage; pct: number } | null = null
  for (const s of MFG_STAGES) {
    if (!PARALLEL_STAGE_KEYS.has(s.key) || isStageNA(s.key, details)) continue
    const pct = getStagePercent(s.key, details)
    if (pct > 0) last = { stage: s.key, pct }
    if (pct > 0 && pct < 100) return { stage: s.key, pct }
  }
  return last
}

// Dùng cho cột "Công đoạn hiện tại" ở bảng danh sách — 1 nhãn + % duy nhất thay vì 2 cột
// Trạng thái/Tiến độ tách rời như trước.
function currentStageLabel(order: Pick<MfgOrder, 'status' | 'mfgStage'>, details: StageDetails): { label: string; icon: React.ReactNode; pct: number } {
  if (order.status === 'DONE') return { label: 'Hoàn thành', icon: <CheckCircle2 size={14} />, pct: 100 }
  if (order.mfgStage === 'PURCHASING') {
    const stage = MFG_STAGES.find(s => s.key === 'PURCHASING')!
    return { label: stage.label, icon: stage.icon, pct: getPurchasingPercent(details.purchasing.materials) }
  }
  const active = getCurrentParallelStage(details)
  const stage = MFG_STAGES.find(s => s.key === (active?.stage ?? 'FRAME'))!
  return { label: stage.label, icon: stage.icon, pct: active?.pct ?? 0 }
}

// ─── Stage detail card ────────────────────────────────────────────────────────

function StageDetailCard({
  stage,
  isActive,
  details,
  orderDeadline,
  pointLabel,
}: {
  stage: typeof MFG_STAGES[number]
  isActive: boolean
  details: StageDetails
  orderDeadline?: string
  pointLabel: (id: number) => string
}) {
  const statusColor = isActive ? 'var(--amber)' : 'var(--green)'

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text2)' }}>
          {stage.icon}
          <span style={{ fontSize: 13, fontWeight: 700 }}>{stage.label}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>
          {isActive
            ? PERCENT_STAGE_KEYS.has(stage.key) ? `${getStagePercent(stage.key, details)}%` : 'Đang thực hiện'
            : 'Hoàn thành'}
        </span>
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--surface)' }}>
        {isStageNA(stage.key, details) && (
          <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--text3)' }}>Công đoạn này không áp dụng cho lệnh này (sản phẩm không có việc ở bước này)</div>
        )}
        {!isStageNA(stage.key, details) && stage.key === 'PURCHASING' && (
          <PurchasingContent materials={details.purchasing.materials} deadline={orderDeadline} />
        )}
        {!isStageNA(stage.key, details) && stage.key === 'FRAME' && (
          <FrameSubStages frame={details.frame} />
        )}
        {!isStageNA(stage.key, details) && stage.key === 'WEAVING' && (
          <WeavingSubStages weaving={details.weaving} pointLabel={pointLabel} />
        )}
        {!isStageNA(stage.key, details) && stage.key === 'CHUYEN_KIEM' && (
          <ChuyenKiemContent chuyenKiem={details.chuyenKiem} />
        )}
        {!isStageNA(stage.key, details) && stage.key === 'PACKAGING' && (
          <PackagingContent packaging={details.packaging} />
        )}
      </div>
    </div>
  )
}

// ─── Progress tracker ─────────────────────────────────────────────────────────

// Tracker vừa hiển thị tiến độ vừa đóng vai trò "filter" chọn công đoạn xem chi tiết (thay cho
// dãy tab riêng "Chi tiết từng công đoạn" trước đây) — bấm vào 1 công đoạn đã tới (có trong
// reachedStages) để chuyển selectedStage. Công đoạn đang chọn không dùng thêm màu nào (tránh
// đụng ngữ nghĩa xanh lá/cam/xám của trạng thái) — chỉ to hơn + đổ bóng nhẹ để nổi lên.
function MfgStageTracker({
  currentStage,
  allDone = false,
  stagePercents,
  reachedStages,
  selectedStage,
  onSelectStage,
}: {
  currentStage?: MfgStage
  allDone?: boolean
  stagePercents?: Partial<Record<MfgStage, number>>
  reachedStages?: Set<MfgStage>
  selectedStage?: MfgStage | null
  onSelectStage?: (stage: MfgStage) => void
}) {
  const currentIdx = allDone
    ? MFG_STAGES.length
    : currentStage
      ? MFG_STAGES.findIndex(s => s.key === currentStage)
      : -1

  // 5 bước × minWidth 64 không vừa điện thoại dọc - cho cuộn ngang thay vì ép chữ đè lên nhau.
  return (
    <div style={{ overflowX: 'auto', paddingTop: 4 }}>
    <div style={{ display: 'flex', alignItems: 'center', minWidth: 440 }}>
      {MFG_STAGES.map((stage, idx) => {
        const pct        = stagePercents?.[stage.key]
        const done        = allDone || (pct !== undefined ? pct >= 100 : idx < currentIdx)
        const active      = !done && (pct !== undefined ? pct > 0 : idx === currentIdx)
        const clickable   = !!onSelectStage && !!reachedStages?.has(stage.key)
        const isSelected  = selectedStage === stage.key
        // Không dùng thêm màu nào — vòng tròn giữ nguyên màu trạng thái (xanh lá/cam/xám).
        // Bước đang chọn "nổi" lên bằng transform: scale + đổ bóng, KHÔNG đổi width/height thật
        // (transform không chiếm thêm chỗ trong layout) — tránh làm dịch layout các bước còn lại
        // khi alignItems:'center' của hàng cha canh lại theo chiều cao (từng bị lỗi khi đổi
        // width/height trực tiếp).
        const color       = done ? 'var(--green)' : active ? 'var(--amber)' : 'var(--border)'
        const Icon        = STAGE_TRACKER_ICONS[stage.key]

        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: idx < MFG_STAGES.length - 1 ? '1 1 0' : undefined }}>
            <div
              onClick={clickable ? () => onSelectStage!(stage.key) : undefined}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 64, cursor: clickable ? 'pointer' : 'default' }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: color, color: done || active ? '#fff' : 'var(--text3)',
                transform: isSelected ? 'scale(1.3)' : 'scale(1)',
                boxShadow: isSelected ? '0 3px 8px rgba(0,0,0,0.28)' : undefined,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}>
                {done ? <CheckCircle2 size={13} /> : <Icon size={13} />}
              </div>
              <div style={{ fontSize: 11, fontWeight: active || isSelected ? 700 : 600, color: active ? 'var(--amber)' : done ? 'var(--text2)' : 'var(--text3)', whiteSpace: 'nowrap' }}>
                {stage.label}{active && pct !== undefined && PERCENT_STAGE_KEYS.has(stage.key) ? ` · ${pct}%` : ''}
              </div>
            </div>
            {idx < MFG_STAGES.length - 1 && (
              <div style={{ flex: 1, height: 2, marginBottom: 18, background: done ? 'var(--green)' : 'var(--border)' }} />
            )}
          </div>
        )
      })}
    </div>
    </div>
  )
}

// ─── Detail page ──────────────────────────────────────────────────────────────

function ThongKeDetailPage({ order, details, onBack, pointLabel }: { order: MfgOrder; details: StageDetails; onBack: () => void; pointLabel: (id: number) => string }) {
  const isMobile  = useIsMobile()
  const allDone   = isAllDone(details)
  const isDone    = order.status === 'DONE' || allDone
  const isOverdue = isOrderOverdue(order.deadline, isDone)
  const meta      = STATUS_META[isDone ? 'DONE' : 'PRODUCING']

  // Stage cards to show
  const reachedCards: { stage: typeof MFG_STAGES[number]; isActive: boolean }[] = []

  if (isDone) {
    MFG_STAGES.forEach(stage => reachedCards.push({ stage, isActive: false }))
  } else if (order.status === 'PRODUCING' && order.mfgStage) {
    if (PARALLEL_STAGE_KEYS.has(order.mfgStage)) {
      reachedCards.push({ stage: MFG_STAGES.find(s => s.key === 'PURCHASING')!, isActive: getStagePercent('PURCHASING', details) < 100 })
      for (const stage of MFG_STAGES) {
        if (!PARALLEL_STAGE_KEYS.has(stage.key)) continue
        const pct = getStagePercent(stage.key, details)
        if (pct > 0) reachedCards.push({ stage, isActive: pct < 100 })
      }
    } else {
      const currentIdx = MFG_STAGES.findIndex(s => s.key === order.mfgStage)
      MFG_STAGES.forEach((stage, idx) => {
        if (idx <= currentIdx) reachedCards.push({ stage, isActive: idx === currentIdx })
      })
    }
  }

  // Luôn đúng 1 công đoạn được xem chi tiết tại một thời điểm (thay vì xếp chồng mọi card công đoạn
  // đã tới, có thể rất dài khi PO đã Hoàn thành) — chọn bằng cách bấm thẳng vào công đoạn đã tới trên
  // thanh "Trạng thái sản xuất" (MfgStageTracker), không còn dãy tab riêng bên dưới. Mặc định chọn
  // công đoạn đang thực hiện; nếu đã xong hết thì mặc định chọn công đoạn cuối cùng.
  const [selectedStage, setSelectedStage] = useState<MfgStage | null>(
    // Công đoạn "không áp dụng" không bao giờ là thẻ mặc định (chỉ có dòng "không áp dụng" để xem).
    reachedCards.find(c => c.isActive)?.stage.key
      ?? [...reachedCards].reverse().find(c => !isStageNA(c.stage.key, details))?.stage.key
      ?? reachedCards[reachedCards.length - 1]?.stage.key ?? null,
  )
  const selectedCard = reachedCards.find(c => c.stage.key === selectedStage) ?? null
  const reachedStages = new Set(reachedCards.map(c => c.stage.key))

  const stagePercents: Partial<Record<MfgStage, number>> | undefined =
    order.mfgStage && PARALLEL_STAGE_KEYS.has(order.mfgStage)
      ? {
          PURCHASING:  getStagePercent('PURCHASING',  details),
          FRAME:       getStagePercent('FRAME',       details),
          WEAVING:     getStagePercent('WEAVING',     details),
          CHUYEN_KIEM: getStagePercent('CHUYEN_KIEM', details),
          PACKAGING:   getStagePercent('PACKAGING',   details),
        }
      : undefined

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isMobile ? 14 : 20, flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}
        >
          <ArrowLeft size={15} />
          Quay lại danh sách
        </button>
        <span style={{ color: 'var(--text3)', fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>Chi tiết lệnh</span>
      </div>

      {/* Header card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: isMobile ? 14 : '16px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: isMobile ? 17 : 20, wordBreak: 'break-word', color: '#1d4ed8', letterSpacing: '0.02em' }}>{order.code}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}>PI: {order.piCode}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{order.productName}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Mã xưởng: <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{order.sku}</span></div>
          </div>
          <span style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
            {meta.label}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 28px', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text3)' }}>
          <span>Khách hàng: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{order.customer}</span></span>
          <span>Ngày tạo: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{format(new Date(order.approvedAt), 'dd/MM/yyyy')}</span></span>
          <span>
            Hạn giao: <span style={{ fontWeight: 600, color: isOverdue ? '#dc2626' : 'var(--text)' }}>
              {order.deadline ? format(new Date(order.deadline), 'dd/MM/yyyy') : '—'}{isOverdue ? ' · Quá hạn' : ''}
            </span>
          </span>
        </div>
      </div>

      {/* Production status */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: isMobile ? 14 : '16px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Trạng thái sản xuất</div>

        {isDone
          ? <MfgStageTracker allDone reachedStages={reachedStages} selectedStage={selectedStage} onSelectStage={setSelectedStage} />
          : <MfgStageTracker currentStage={order.mfgStage} stagePercents={stagePercents} reachedStages={reachedStages} selectedStage={selectedStage} onSelectStage={setSelectedStage} />}

        {selectedCard && (
          <div style={{ marginTop: 20 }}>
            <StageDetailCard stage={selectedCard.stage} isActive={selectedCard.isActive} details={details} orderDeadline={order.deadline} pointLabel={pointLabel} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── List page ────────────────────────────────────────────────────────────────

// Trạng thái lệnh sản xuất (PI) tối thiểu cần để quyết định 1 SKU đã "vào sản xuất" hay còn "lên kế
// hoạch". productionOrderId đã có sẵn thẳng trên item (BE ghi lúc duyệt, xem
// production-invoices.service.ts createFromApproval) - dùng trực tiếp để tra tiến độ Hàn/Sơn/Đan
// theo batch, KHÔNG cần dò lại qua resolveProductionOrderId()/poInfoMap như trước (đã bỏ, xem
// buildBatchProgressData). Các field mfgProductId/productVariant/salesOrder*/deliveryDeadline/
// decidedAt/requestedAt chỉ dùng khi item được duyệt mà KHÔNG có Sku (PlanForm) tương ứng — xem
// buildSyntheticSku().
type FloorStage = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'FINISHED'
interface PIApprovalItem {
  id: string
  mfgProductId: string
  productionOrderId?: string | null
  /** QLSX kiểm soát qua nút Bắt đầu/Kết thúc (2026-08-31) - null khi chưa có ProductionOrder. */
  floorStage?: FloorStage | null
  /** true = định mức đã ghim cho SKU này KHÁC bản ACTIVE hiện tại - hiện nút "Nạp lại định mức"
   *  (2026-09-21, Việc 3b). Cùng idiom floorStage - null khi chưa có ProductionOrder. */
  bomOutOfDate?: boolean | null
  prodApproval?: { status?: string }
  quantity?: number
  salesOrderId?: string
  salesOrderCode?: string
  productVariant?: { mfgProduct?: { name?: string; factoryCode?: string } }
  deliveryDeadline?: string
  decidedAt?: string
  requestedAt?: string
}
interface PIStatusRow { id: string; code: string; status: string; items?: PIApprovalItem[] }

// 1 dòng đã duyệt trong "Bảng thống kê" - định danh CHUẨN (piId/itemId/orderId/poCode/piCode/
// deliveryDeadline) lấy THẲNG từ chính ProductionInvoiceItem đang duyệt, không suy ngược qua Sku
// nữa (Sku chỉ còn dùng để lấy định mức/vật tư hiển thị, xem buildOrderRow). Chính xác hơn cách
// cũ (poInfoMap dò theo mfgProductId, "lấy ProductionOrder đầu tiên tìm thấy" - có thể sai nếu 1
// sản phẩm có nhiều lệnh) vì ở đây picked đúng 1-1 theo chính item đang xét.
interface ApprovedRow {
  pf: Sku
  skuQty: number
  piId: string
  itemId: string
  orderId: string | null
  poCode: string | null
  piCode: string
  deliveryDeadline?: string
  floorStage: FloorStage | null
  bomOutOfDate: boolean | null
}

// SKU nào cũng được duyệt qua đúng 1 ProductionInvoiceItem, nhưng không phải SKU nào cũng có bản
// ghi Sku (PlanForm) đi kèm — Sku chỉ tồn tại khi KHSX tự tay tạo qua "Lệnh sản xuất mới" (POST
// /skus). Nếu PI/Item được tạo/duyệt qua đường khác (vd Admin), ProductionOrder vẫn được BE tự
// sinh thật khi Sếp duyệt, nhưng KHÔNG có Sku nào khớp — trước đây "Bảng thống kê" chỉ đọc từ
// skusData nên các lệnh này biến mất hoàn toàn dù đã duyệt xong. Dựng 1 Sku "giả" tối thiểu từ
// chính PI + Item đã duyệt để lệnh vẫn lên danh sách (thiếu mỗi phần định mức/vật tư do KHSX nhập
// tay - các fetch* bên trên đã tự trả rỗng khi không có gì, không crash).
function buildSyntheticSku(pi: PIStatusRow, item: PIApprovalItem, customerName: string | undefined): Sku {
  return {
    id: `pi-item:${pi.id}:${item.id}`,
    exportOrderId: item.salesOrderId ?? null,
    mfgProductId: item.mfgProductId,
    status: 'APPROVED',
    piCode: pi.code,
    productionInvoiceId: pi.id,
    customerName: customerName ?? null,
    createdAt: item.decidedAt ?? item.requestedAt ?? new Date().toISOString(),
    exportOrder: item.salesOrderCode
      ? { id: item.salesOrderId ?? '', poNumber: item.salesOrderCode, deliveryDate: item.deliveryDeadline }
      : undefined,
    mfgProduct: {
      id: item.mfgProductId,
      factoryCode: item.productVariant?.mfgProduct?.factoryCode ?? '—',
      name: item.productVariant?.mfgProduct?.name ?? '',
    },
  }
}

// ─── Lớp 1: tiến độ theo PI (gộp các SKU) ────────────────────────────────────────────────────────
// "Tổng hợp lệnh SX" thống kê 2 lớp (2026-09-21): lớp 1 = PI (lệnh sản xuất), lớp 2 = từng SKU trong PI. Số của
// PI = cộng dồn số lượng THẬT của các SKU (không lấy trung bình phần trăm), riêng Phôi dùng số cả PI (gồm cả
// phần đợt cắt cũ chưa gắn SKU). Dựng StageDetails gộp rồi dùng lại đúng các hàm % / "không áp dụng" / "xong"
// của lớp SKU để 2 lớp luôn cùng một cách tính.

interface PiRow {
  piId: string
  piCode: string
  rows: { order: MfgOrder; details: StageDetails }[]
  order: { status: OrderStatus; mfgStage?: MfgStage }
  details: StageDetails
  deadline?: string        // sớm nhất trong các SKU
  overdue: boolean         // có ít nhất 1 SKU quá hạn
  customers: string
  poCodes: string
  floorCounts: Record<FloorStage, number>
}

function combineSubStatus(list: SubStatus[]): SubStatus {
  const a = list.filter(s => s !== 'na')
  if (a.length === 0) return 'na'
  if (a.every(s => s === 'done')) return 'done'
  return a.some(s => s !== 'pending') ? 'in-progress' : 'pending'
}

function aggregateDetails(items: StageDetails[], phoiProgress: BePhoiProgressItem[] | null, phoiVtTpKnown: boolean): StageDetails {
  const phoiMaterials = mapPhoiProgress(phoiProgress ?? [], null)
  const phoiVtTpLines = items.flatMap(d => d.frame.phoiVtTpLines)
  const vt = lineTotals(phoiVtTpLines)
  const phoiNeed = phoiMaterials.reduce((a, m) => a + m.need, 0) + vt.need
  const phoiDone = phoiMaterials.reduce((a, m) => a + m.done, 0) + vt.done
  return {
    purchasing: items[0].purchasing, // đề xuất mua gộp theo PI - mọi SKU cùng 1 danh sách
    frame: {
      phoi: subStatusOf(phoiNeed, phoiDone, phoiProgress !== null && phoiVtTpKnown),
      han: combineSubStatus(items.map(d => d.frame.han)),
      son: combineSubStatus(items.map(d => d.frame.son)),
      phoiMaterials, phoiVtTpLines,
      phoiUnassignedDone: unassignedCutOf(phoiProgress ?? []),
      hanLines: items.flatMap(d => d.frame.hanLines),
      sonLines: items.flatMap(d => d.frame.sonLines),
    },
    weaving: {
      xuatDan: combineSubStatus(items.map(d => d.weaving.xuatDan)),
      nhapDan: combineSubStatus(items.map(d => d.weaving.nhapDan)),
      lines: items.flatMap(d => d.weaving.lines),
      skuQty: items.reduce((a, d) => a + d.weaving.skuQty, 0),
    },
    chuyenKiem: {
      daKiem: combineSubStatus(items.map(d => d.chuyenKiem.daKiem)),
      pieces: items.flatMap(d => d.chuyenKiem.pieces),
    },
    packaging: {
      dongGoi: combineSubStatus(items.map(d => d.packaging.dongGoi)),
      totalBoxes: items.reduce((a, d) => a + d.packaging.totalBoxes, 0),
      daDongQty: items.reduce((a, d) => a + d.packaging.daDongQty, 0),
    },
  }
}

function buildPiRows(approvedRows: ApprovedRow[], orderRows: { order: MfgOrder; details: StageDetails }[], batch: BatchProgressData | null): PiRow[] {
  const byPi = new Map<string, { row: ApprovedRow; item: { order: MfgOrder; details: StageDetails } }[]>()
  approvedRows.forEach((row, i) => {
    const arr = byPi.get(row.piId) ?? []
    arr.push({ row, item: orderRows[i] })
    byPi.set(row.piId, arr)
  })
  return Array.from(byPi.entries()).map(([piId, list]): PiRow => {
    const rows = list.map(l => l.item)
    const details = aggregateDetails(
      rows.map(r => r.details),
      batch?.phoiProgressByPi[piId] ?? null,
      !!batch && !batch.failed.includes('production-batch-plan(PHOI)'),
    )
    const done = rows.every(r => r.order.status === 'DONE')
    const purchPct = getPurchasingPercent(details.purchasing.materials)
    const anyExecProgress = Array.from(PARALLEL_STAGE_KEYS).some(k => !isStageNA(k, details) && getStagePercent(k, details) > 0)
    const deadlines = rows.map(r => r.order.deadline).filter((d): d is string => !!d).sort()
    const floorCounts: Record<FloorStage, number> = { PENDING: 0, ACTIVE: 0, PAUSED: 0, FINISHED: 0 }
    for (const r of rows) if (r.order.floorStage) floorCounts[r.order.floorStage]++
    const uniq = (vals: string[]) => Array.from(new Set(vals.filter(v => v && v !== '—')))
    return {
      piId,
      piCode: list[0].row.piCode,
      rows,
      order: { status: done ? 'DONE' : 'PRODUCING', mfgStage: done ? undefined : (purchPct < 100 && !anyExecProgress ? 'PURCHASING' : 'FRAME') },
      details,
      deadline: deadlines[0],
      overdue: rows.some(r => isOrderOverdue(r.order.deadline, r.order.status === 'DONE')),
      customers: uniq(rows.map(r => r.order.customer)).join(', ') || '—',
      poCodes: uniq(rows.map(r => r.order.code)).join(', ') || '—',
      floorCounts,
    }
  })
}

// Tóm tắt trạng thái xưởng của cả PI (đếm số SKU theo từng trạng thái).
function PiFloorSummary({ counts }: { counts: Record<FloorStage, number> }) {
  const order: FloorStage[] = ['ACTIVE', 'PAUSED', 'PENDING', 'FINISHED']
  const parts = order.filter(k => counts[k] > 0)
  if (parts.length === 0) return <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {parts.map(k => (
        <span key={k} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: FLOOR_STAGE_META[k].bg, color: FLOOR_STAGE_META[k].color, whiteSpace: 'nowrap' }}>
          {counts[k]} {FLOOR_STAGE_META[k].label.toLowerCase()}
        </span>
      ))}
    </div>
  )
}

// Thẻ 1 dòng (PI hoặc SKU) thay cho dòng bảng trên điện thoại: tiêu đề + công đoạn hiện tại + lưới số liệu + chân thẻ.
function MobileRowCard({ onClick, title, subtitle, stage, variance, meta, footer }: {
  onClick: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  stage: { label: string; icon: React.ReactNode; pct: number }
  variance?: boolean
  meta: { label: string; value: React.ReactNode }[]
  footer?: React.ReactNode
}) {
  return (
    <div className="card" role="button" tabIndex={0} onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{ padding: '12px 14px', cursor: 'pointer' }}>
      <div style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, wordBreak: 'break-word' }}>{subtitle}</div>}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
          {stage.icon} {stage.label}
          {variance && <AlertTriangle size={12} color="var(--red)" />}
        </div>
        <ProgressBar value={stage.pct} max={100} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10, fontSize: 13 }}>
        {meta.map(m => (
          <div key={m.label} style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--text3)', fontSize: 10 }}>{m.label}</div>
            <div style={{ wordBreak: 'break-word' }}>{m.value}</div>
          </div>
        ))}
      </div>
      {footer && <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>{footer}</div>}
    </div>
  )
}

function DeadlineText({ deadline, overdue, overdueLabel }: { deadline?: string; overdue: boolean; overdueLabel: string }) {
  return (
    <span style={{ color: overdue ? '#dc2626' : undefined, fontWeight: overdue ? 700 : undefined }}>
      {deadline ? format(new Date(deadline), 'dd/MM/yyyy') : '—'}
      {overdue && <span style={{ display: 'block', fontSize: 11 }}>{overdueLabel}</span>}
    </span>
  )
}

export default function ThongKePagePlan() {

  const { data: skusData, isLoading } = useFetch<Sku[]>(() => api.getSkus(), [])
  const { data: pisData, refetch: refetchPis } = useFetch<PIStatusRow[]>(() => api.getProductionInvoices(), [])
  const { data: weavingPointsData } = useFetch<WeavingPointLite[]>(() => (api as any).getWeavingPoints(), [])
  const { proposals } = useInspection()
  // Mã khách hàng cho các lệnh KHÔNG có Sku (PlanForm) đi kèm — xem buildSyntheticSku(). Sku thật
  // đã tự có customerName do KHSX nhập tay lúc tạo, không cần map này.
  const { data: salesOrdersData } = useFetch<{ id: string; customerName: string }[]>(() => api.getSalesOrders(), [])
  const customerByOrderId = useMemo(() => new Map((salesOrdersData ?? []).map(o => [o.id, o.customerName])), [salesOrdersData])

  // Nguồn "sự thật" của 1 dòng lệnh là ProductionInvoiceItem đã được SẾP DUYỆT (tự động sinh
  // ProductionOrder ngay lúc duyệt, xem comment buildSyntheticSku) — KHÔNG phải Sku (PlanForm):
  // Sku chỉ tồn tại khi KHSX tự tay tạo qua "Lệnh sản xuất mới" (POST /skus), nên trước đây lọc
  // thẳng theo skusData khiến lệnh nào duyệt qua đường khác (vd Admin) biến mất khỏi bảng dù
  // ProductionOrder đã có thật. Match từng item đã duyệt với đúng Sku của nó (nếu có) theo cặp
  // PI+mfgProduct để giữ nguyên định mức/vật tư KHSX đã nhập; item không có Sku khớp vẫn phải lên
  // danh sách (dựng Sku giả) — mỗi item đã duyệt = đúng 1 dòng, không gộp theo PI dù nhiều SKU của
  // cùng 1 PI (gộp) đều xuất hiện tách riêng.
  const skuByPiAndProduct = useMemo(() => {
    const m = new Map<string, Sku>()
    for (const pf of skusData ?? []) {
      if (pf.status === 'DRAFT' || !pf.productionInvoiceId) continue
      m.set(`${pf.productionInvoiceId}:${pf.mfgProductId}`, pf)
    }
    return m
  }, [skusData])
  const skuByProduct = useMemo(() => {
    const m = new Map<string, Sku>()
    for (const pf of skusData ?? []) {
      if (pf.status === 'DRAFT') continue
      if (!m.has(pf.mfgProductId)) m.set(pf.mfgProductId, pf)
    }
    return m
  }, [skusData])
  const approvedRows = useMemo(() => {
    const rows: ApprovedRow[] = []
    for (const pi of pisData ?? []) {
      for (const item of pi.items ?? []) {
        if (item.prodApproval?.status !== 'APPROVED') continue
        const pf = skuByPiAndProduct.get(`${pi.id}:${item.mfgProductId}`)
          ?? skuByProduct.get(item.mfgProductId)
          ?? buildSyntheticSku(pi, item, item.salesOrderId ? customerByOrderId.get(item.salesOrderId) : undefined)
        rows.push({
          pf,
          skuQty: item.quantity ?? 0,
          piId: pi.id,
          itemId: item.id,
          orderId: item.productionOrderId ?? null,
          poCode: item.salesOrderCode ?? null,
          piCode: pi.code,
          deliveryDeadline: item.deliveryDeadline,
          floorStage: item.floorStage ?? null,
          bomOutOfDate: item.bomOutOfDate ?? null,
        })
      }
    }
    return rows
  }, [pisData, skuByPiAndProduct, skuByProduct, customerByOrderId])
  const weavingPoints = useMemo(() => weavingPointsData ?? [], [weavingPointsData])
  const pointLabel = (id: number) => {
    const p = weavingPoints.find(w => w.id === id)
    return p?.fullName ? `${p.code} (${p.fullName})` : (p?.code ?? `#${id}`)
  }

  // 6 request CỐ ĐỊNH cho cả trang (xem buildBatchProgressData) thay vì tới 6×N như trước - đây là
  // async call DUY NHẤT còn lại của toàn màn, buildOrderRow() giờ hoàn toàn đồng bộ.
  // Tải lại CHỈ khi danh sách dòng thật sự đổi (batchKey), không phải mỗi lần approvedRows đổi tham chiếu (các
  // nguồn skus/PI/đơn hàng về lệch nhau làm approvedRows dựng lại nhiều lần -> tải trùng 3 vòng). Trong lúc
  // dữ liệu chưa khớp danh sách hiện tại (vd lần tải đầu chạy khi danh sách còn rỗng), coi là ĐANG TẢI - trước
  // đây dùng nhầm dữ liệu rỗng đó cho các lệnh thật nên có lúc Chuyền kiểm bị tính "không áp dụng" và trang
  // chi tiết chọn sai công đoạn (tái hiện được ~1/5 lần mở).
  const batchKey = useMemo(() => batchKeyOf(approvedRows), [approvedRows])
  const { data: batchDataRaw, isLoading: batchLoading } = useFetch(
    () => buildBatchProgressData(approvedRows),
    [batchKey],
  )
  const batchFresh = !!batchDataRaw && batchDataRaw.key === batchKey
  const batchData = batchFresh ? batchDataRaw : null
  const rowsLoading = batchLoading || !batchFresh
  const orderRows = useMemo(
    () => approvedRows.map(row => buildOrderRow(row, proposals, batchData ?? EMPTY_BATCH_DATA)),
    [approvedRows, proposals, batchData],
  )

  const [filter, setFilter]         = useState<FilterStatus>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedPiId, setSelectedPiId] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)

  // Chỉ QLSX (mfgRole=PRODUCTION_MANAGER) mới thấy nút Bắt đầu/Kết thúc - Boss/KHSX dùng chung
  // component này nhưng chỉ xem badge trạng thái xưởng, không có quyền thao tác (khớp
  // @RequireRole(BUSINESS_ROLES.PRODUCTION_MANAGER) ở BE production-orders.controller.ts).
  const { user } = useAuth()
  const canManageFloor = user?.mfgRole === 'PRODUCTION_MANAGER'
  // Điện thoại (< 640px): thẻ thay bảng ở cả 2 lớp danh sách PI/SKU - cùng idiom Sales/Mua hàng.
  const isMobile = useIsMobile()
  const [floorPending, setFloorPending] = useState<Set<string>>(new Set())

  // 4 hành động đều hỏi lại xác nhận trước khi gọi API (FLOOR_ACTION_CONFIRM, 2026-09-01) - bấm
  // Huỷ ở confirm() thì dừng luôn, không setFloorPending/không gọi API. 'start'/'resume' cùng gọi
  // 1 route floor-start (BE coi 2 việc là một, xem ProductionOrdersService.startFloor) - tách 2
  // action riêng ở FE chỉ để hiện đúng nội dung confirm ("Bắt đầu" khác "Tiếp tục").
  const FLOOR_ACTION_ERROR: Record<'start' | 'resume' | 'pause' | 'finish', string> = {
    start: 'Lỗi bắt đầu lệnh', resume: 'Lỗi tiếp tục lệnh', pause: 'Lỗi tạm dừng lệnh', finish: 'Lỗi kết thúc lệnh',
  }
  const handleFloorAction = async (orderId: string, action: 'start' | 'resume' | 'pause' | 'finish') => {
    if (!confirm(FLOOR_ACTION_CONFIRM[action])) return
    setFloorPending(s => new Set(s).add(orderId))
    try {
      if (action === 'start' || action === 'resume') await api.startProductionOrderFloor(orderId)
      else if (action === 'pause') await api.pauseProductionOrderFloor(orderId)
      else await api.finishProductionOrderFloor(orderId)
      refetchPis()
    } catch (err) {
      alert(errMsg(err, FLOOR_ACTION_ERROR[action]))
    } finally {
      setFloorPending(s => { const next = new Set(s); next.delete(orderId); return next })
    }
  }

  // Việc 3b (2026-09-21, changelog-2026-09-11-bom-revision-ghim-cu-canh-bao.md mục 8) - "Nạp lại
  // định mức" chỉ hiện khi FloorStageCell đã tự lọc bomOutOfDate=true + floorStage=PENDING, nhưng
  // BE vẫn tự kiểm lại toàn bộ 4 điều kiện (đơn gọi trực tiếp API/đổi trạng thái ngay lúc click) -
  // nút này không phải nguồn xác thực, chỉ tránh bấm vào chỗ chắc chắn thất bại. `reason` bắt
  // buộc (BE 400 nếu rỗng) nên hỏi bằng prompt() thay vì confirm() - cùng mức nhẹ UI với các hành
  // động khác trên bảng này (không có modal riêng nào ở đây).
  const handleResyncBom = async (orderId: string) => {
    const reason = window.prompt(
      'Vì sao nạp lại định mức cho lệnh này? (Sếp/QLSX đọc lại được sau này)',
    )
    if (reason === null) return
    if (!reason.trim()) { alert('Phải nhập lý do.'); return }
    setFloorPending(s => new Set(s).add(orderId))
    try {
      await api.resyncProductionOrderBom(orderId, reason.trim())
      refetchPis()
    } catch (err) {
      alert(errMsg(err, 'Lỗi nạp lại định mức'))
    } finally {
      setFloorPending(s => { const next = new Set(s); next.delete(orderId); return next })
    }
  }

  // Bảng SKU (lớp 2) - giữ nguyên các cột cũ của bảng thống kê theo SKU, nút Bắt đầu/Kết thúc (QLSX) nằm ở đây.
  const renderFloorCell = (o: MfgOrder) => (
    <FloorStageCell
      orderId={o.orderId}
      floorStage={o.floorStage}
      bomOutOfDate={o.bomOutOfDate}
      canManage={canManageFloor}
      pending={!!o.orderId && floorPending.has(o.orderId)}
      onStart={() => o.orderId && handleFloorAction(o.orderId, 'start')}
      onResume={() => o.orderId && handleFloorAction(o.orderId, 'resume')}
      onPause={() => o.orderId && handleFloorAction(o.orderId, 'pause')}
      onFinish={() => o.orderId && handleFloorAction(o.orderId, 'finish')}
      onResync={() => o.orderId && handleResyncBom(o.orderId)}
    />
  )

  const renderSkuTable = (rows: { order: MfgOrder; details: StageDetails }[]) => isMobile ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(({ order: o, details }) => (
        <MobileRowCard
          key={o.id}
          onClick={() => setSelectedId(o.id)}
          title={o.productName || o.sku}
          subtitle={o.sku}
          stage={currentStageLabel(o, details)}
          variance={o.hasVariance}
          meta={[
            { label: 'Mã PO', value: <span style={{ fontFamily: 'monospace' }}>{o.code}</span> },
            { label: 'Khách hàng', value: o.customer },
            { label: 'Hạn giao', value: <DeadlineText deadline={o.deadline} overdue={isOrderOverdue(o.deadline, o.status === 'DONE')} overdueLabel="Quá hạn" /> },
          ]}
          footer={renderFloorCell(o)}
        />
      ))}
    </div>
  ) : (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={th}>SKU / Sản phẩm</th>
            <th style={th}>Mã PO</th>
            <th style={th}>Khách hàng</th>
            <th style={{ ...th, width: 220 }}>Công đoạn hiện tại</th>
            <th style={th}>Hạn giao</th>
            <th style={th}>Xưởng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ order: o, details }) => {
            const isDone    = o.status === 'DONE'
            const isOverdue = isOrderOverdue(o.deadline, isDone)
            const stageInfo = currentStageLabel(o, details)
            return (
              <tr
                key={o.id}
                onClick={() => setSelectedId(o.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(o.id) } }}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '' }}
              >
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{o.productName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{o.sku}</div>
                </td>
                <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text2)' }}>{o.code}</td>
                <td style={{ ...td, color: 'var(--text2)' }}>{o.customer}</td>
                <td style={{ ...td, width: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                    {stageInfo.icon} {stageInfo.label}
                    {o.hasVariance && <AlertTriangle size={12} color="var(--red)" />}
                  </div>
                  <ProgressBar value={stageInfo.pct} max={100} />
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: isOverdue ? '#dc2626' : undefined, fontWeight: isOverdue ? 700 : undefined }}>
                  {o.deadline ? format(new Date(o.deadline), 'dd/MM/yyyy') : '—'}
                  {isOverdue && <div style={{ fontSize: 11, color: '#dc2626' }}>Quá hạn</div>}
                </td>
                <td style={td}>{renderFloorCell(o)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )


  const piRows = useMemo(() => buildPiRows(approvedRows, orderRows, batchData), [approvedRows, orderRows, batchData])

  const q = search.trim().toLowerCase()
  const filtered = piRows
    .filter(p => filter === 'all' || p.order.status === filter)
    .filter(p => !q || [p.piCode, ...p.rows.flatMap(({ order }) => [order.code, order.sku, order.productName, order.customer])].some(v => v.toLowerCase().includes(q)))

  const counts = {
    all:       piRows.length,
    PRODUCING: piRows.filter(p => p.order.status === 'PRODUCING').length,
    DONE:      piRows.filter(p => p.order.status === 'DONE').length,
    OVERDUE:   piRows.filter(p => p.overdue).length,
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe  = Math.min(page, pageCount)
  const pageItems = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)

  // Nguồn tải lỗi -> báo rõ, vì phần đó đang hiện "chưa bắt đầu" do KHÔNG BIẾT chứ không phải do chưa làm.
  const failedBanner = batchData && batchData.failed.length > 0 ? (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>
      <AlertTriangle size={15} /> Không tải được một phần số liệu tiến độ ({batchData.failed.join(', ')}) — các công đoạn liên quan đang hiện tạm là “chưa bắt đầu”, không phải số thật. Hãy tải lại trang.
    </div>
  ) : null

  // Lớp 3 (chi tiết 1 SKU) -> quay về lớp 2 (danh sách SKU của PI đang xem), không văng ra tận lớp 1.
  const selectedRow = selectedId != null ? orderRows.find(({ order }) => order.id === selectedId) ?? null : null
  if (selectedRow) {
    return <>{failedBanner}<ThongKeDetailPage order={selectedRow.order} details={selectedRow.details} onBack={() => setSelectedId(null)} pointLabel={pointLabel} /></>
  }

  // Lớp 2: các SKU của 1 PI - mỗi dòng có tiến độ + nút Bắt đầu/Kết thúc (QLSX) riêng của SKU.
  const selectedPi = selectedPiId != null ? piRows.find(p => p.piId === selectedPiId) ?? null : null
  if (selectedPi) {
    const piDone = selectedPi.order.status === 'DONE'
    const piMeta = STATUS_META[selectedPi.order.status]
    const parallel = !!selectedPi.order.mfgStage && PARALLEL_STAGE_KEYS.has(selectedPi.order.mfgStage)
    const piStagePercents: Partial<Record<MfgStage, number>> | undefined = parallel
      ? {
          PURCHASING:  getStagePercent('PURCHASING',  selectedPi.details),
          FRAME:       getStagePercent('FRAME',       selectedPi.details),
          WEAVING:     getStagePercent('WEAVING',     selectedPi.details),
          CHUYEN_KIEM: getStagePercent('CHUYEN_KIEM', selectedPi.details),
          PACKAGING:   getStagePercent('PACKAGING',   selectedPi.details),
        }
      : undefined
    return (
      <div>
        {failedBanner}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isMobile ? 14 : 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedPiId(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}
          >
            <ArrowLeft size={15} />
            Quay lại danh sách PI
          </button>
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>Chi tiết PI</span>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: isMobile ? 14 : '16px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: isMobile ? 17 : 20, wordBreak: 'break-word', color: '#1d4ed8', letterSpacing: '0.02em' }}>{selectedPi.piCode}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, wordBreak: 'break-word' }}>{selectedPi.rows.length} SKU · PO: {selectedPi.poCodes}</div>
            </div>
            <span style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: piMeta.bg, color: piMeta.color, border: `1px solid ${piMeta.border}`, whiteSpace: 'nowrap' }}>
              {piMeta.label}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 28px', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text3)' }}>
            <span>Khách hàng: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{selectedPi.customers}</span></span>
            <span>
              Hạn giao sớm nhất: <span style={{ fontWeight: 600, color: selectedPi.overdue ? '#dc2626' : 'var(--text)' }}>
                {selectedPi.deadline ? format(new Date(selectedPi.deadline), 'dd/MM/yyyy') : '—'}{selectedPi.overdue ? ' · Có SKU quá hạn' : ''}
              </span>
            </span>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: isMobile ? 14 : '16px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Tiến độ cả PI</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: selectedPi.details.frame.phoiUnassignedDone > 0 ? 6 : 14 }}>Cộng dồn số lượng thật của {selectedPi.rows.length} SKU — bấm 1 SKU bên dưới để xem tiến độ riêng từng SKU.</div>
          {selectedPi.details.frame.phoiUnassignedDone > 0 && (
            <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 14 }}>
              Lưu ý: có {selectedPi.details.frame.phoiUnassignedDone.toLocaleString('vi-VN')} đoạn Phôi đã làm từ trước khi ghi theo SKU (chưa gán SKU). Số Phôi của cả PI có tính các đoạn này, còn từng SKU thì không — nên tổng các SKU có thể thấp hơn số cả PI cho tới khi Phôi gán SKU cho các đợt cũ.
            </div>
          )}
          {piDone
            ? <MfgStageTracker allDone />
            : <MfgStageTracker currentStage={selectedPi.order.mfgStage} stagePercents={piStagePercents} />}
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Tiến độ từng SKU ({selectedPi.rows.length})</div>
        {renderSkuTable(selectedPi.rows)}
      </div>
    )
  }

  // Lớp 1: danh sách PI.
  return (
    <div>
      {failedBanner}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tổng hợp lệnh SX</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Tổng {counts.all} PI · Đang sản xuất {counts.PRODUCING} · Hoàn thành {counts.DONE}
          {counts.OVERDUE > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}> · ⚠ Quá hạn {counts.OVERDUE}</span>}
        </p>
      </div>

      {/* Filter + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['all', 'Tất cả'], ['PRODUCING', 'Đang sản xuất'], ['DONE', 'Hoàn thành']] as [FilterStatus, string][]).map(([key, label]) => (
            <button key={key} onClick={() => { setFilter(key); setPage(1) }}
              style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                background: filter === key ? '#1d4ed8' : 'var(--surface2)',
                color: filter === key ? '#fff' : 'var(--text)',
              }}>
              {label} <span style={{ opacity: 0.75 }}>({key === 'all' ? counts.all : counts[key as OrderStatus]})</span>
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', width: isMobile ? '100%' : 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Tìm mã PI, mã PO, SKU, sản phẩm, khách hàng..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      </div>

      {/* Table (thẻ trên điện thoại) */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(isLoading || rowsLoading) ? (
            <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>Không có PI nào</div>
          ) : pageItems.map(p => (
            <MobileRowCard
              key={p.piId}
              onClick={() => setSelectedPiId(p.piId)}
              title={<span style={{ fontFamily: 'monospace' }}>{p.piCode}</span>}
              subtitle={p.rows.length + ' SKU · ' + p.customers}
              stage={currentStageLabel(p.order, p.details)}
              variance={p.rows.some(r => r.order.hasVariance)}
              meta={[
                { label: 'Mã PO', value: <span style={{ fontFamily: 'monospace' }}>{p.poCodes}</span> },
                { label: 'Hạn giao sớm nhất', value: <DeadlineText deadline={p.deadline} overdue={p.overdue && p.order.status !== 'DONE'} overdueLabel="Có SKU quá hạn" /> },
              ]}
              footer={<PiFloorSummary counts={p.floorCounts} />}
            />
          ))}
        </div>
      ) : (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Mã PI</th>
              <th style={th}>Số SKU</th>
              <th style={th}>Mã PO</th>
              <th style={th}>Khách hàng</th>
              <th style={{ ...th, width: 220 }}>Công đoạn hiện tại</th>
              <th style={th}>Hạn giao (sớm nhất)</th>
              <th style={th}>Xưởng</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading || rowsLoading) ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</td></tr>
            ) : pageItems.map(p => {
              const isDone    = p.order.status === 'DONE'
              const stageInfo = currentStageLabel(p.order, p.details)
              return (
                <tr
                  key={p.piId}
                  onClick={() => setSelectedPiId(p.piId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPiId(p.piId) } }}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '' }}
                >
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{p.piCode}</td>
                  <td style={td}>{p.rows.length}</td>
                  <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text2)' }}>{p.poCodes}</td>
                  <td style={{ ...td, color: 'var(--text2)' }}>{p.customers}</td>
                  <td style={{ ...td, width: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                      {stageInfo.icon} {stageInfo.label}
                      {p.rows.some(r => r.order.hasVariance) && <AlertTriangle size={12} color="var(--red)" />}
                    </div>
                    <ProgressBar value={stageInfo.pct} max={100} />
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: p.overdue ? '#dc2626' : undefined, fontWeight: p.overdue ? 700 : undefined }}>
                    {p.deadline ? format(new Date(p.deadline), 'dd/MM/yyyy') : '—'}
                    {p.overdue && !isDone && <div style={{ fontSize: 11, color: '#dc2626' }}>Có SKU quá hạn</div>}
                  </td>
                  <td style={td}><PiFloorSummary counts={p.floorCounts} /></td>
                </tr>
              )
            })}
            {!isLoading && !rowsLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                  Không có PI nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
          <span>Hiển thị {pageItems.length}/{filtered.length} PI</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={pageSafe <= 1}
              style={{ ...btnSecondary, padding: '5px 8px', display: 'flex', opacity: pageSafe <= 1 ? 0.5 : 1, cursor: pageSafe <= 1 ? 'default' : 'pointer' }}
            >
              <ChevronLeft size={14} />
            </button>
            <span>Trang {pageSafe}/{pageCount}</span>
            <button
              onClick={() => setPage(p => Math.min(pageCount, p + 1))}
              disabled={pageSafe >= pageCount}
              style={{ ...btnSecondary, padding: '5px 8px', display: 'flex', opacity: pageSafe >= pageCount ? 0.5 : 1, cursor: pageSafe >= pageCount ? 'default' : 'pointer' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
