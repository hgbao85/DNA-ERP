import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Factory, PackageCheck, Search, ShoppingCart, Wrench, type LucideIcon } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useAuth } from '../../../context/AuthContext'
import { errMsg } from '../../../utils/errors'
import * as api from '../../../services/api'
import { useInspection, type PurchaseProposal } from '../../../context/InspectionContext'
import type { Sku } from '../../../types/sku'
import LenhSanXuatBoard, { type BoardColumn } from '../../../components/sanxuat/LenhSanXuatBoard'
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
    piOrderCount: number
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
  return need > 0 ? Math.min(100, Math.floor(Math.min(done, need) / need * 100)) : 0
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
interface PhoiMaterialView {
  materialId: string; materialCode: string; materialName: string; issuedBarCount: number
  segments: PhoiSegmentView[]
  need: number; done: number
}

function mapPhoiProgress(items: BePhoiProgressItem[]): PhoiMaterialView[] {
  return items.map(it => {
    const segments = it.segments.map(s => {
      // "Đạt" = đã cắt trừ lỗi KCS (lỗi cộng dồn, Phôi bù bằng cách cắt thêm); chặn trần theo định mức để
      // cắt dư ở cỡ này không bù cho cỡ khác còn thiếu.
      const good = Math.min(s.required, Math.max(0, s.done - s.failed))
      return { cutLengthMm: s.cutLengthMm, required: s.required, done: s.done, failed: s.failed, good, remaining: Math.max(0, s.required - (s.done - s.failed)) }
    })
    return {
      materialId: it.materialId, materialCode: it.materialCode, materialName: it.materialName, issuedBarCount: it.issuedBarCount,
      segments,
      need: segments.reduce((a, s) => a + s.required, 0),
      done: segments.reduce((a, s) => a + s.good, 0),
    }
  })
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
}
const EMPTY_BATCH_DATA: BatchProgressData = {
  phoiProgressByPi: {}, phoiVtTpPlanByOrder: {}, hanPlanByOrder: {}, sonPlanByOrder: {},
  weavingPlanByOrder: {}, transferCheckByItem: {}, packagingByItem: {}, failed: [],
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
  return { phoiProgressByPi, phoiVtTpPlanByOrder, hanPlanByOrder, sonPlanByOrder, weavingPlanByOrder, transferCheckByItem, packagingByItem, failed }
}

function buildFrame(
  phoiProgress: BePhoiProgressItem[] | null, vtTpPlan: BeProductionBatchPlan | null,
  hanPlan: BeProductionBatchPlan | null, sonPlan: BeProductionBatchPlan | null, piOrderCount: number,
): StageDetails['frame'] {
  const phoiMaterials = mapPhoiProgress(phoiProgress ?? [])
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
    phoiMaterials, phoiVtTpLines, piOrderCount, hanLines, sonLines,
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
    frame: { phoi: 'pending', han: 'pending', son: 'pending', phoiMaterials: [], phoiVtTpLines: [], piOrderCount: 1, hanLines: [], sonLines: [] },
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
    frame: buildFrame(phoiProgress, vtTpPlan, hanPlan, sonPlan, row.piOrderCount),
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
  orderId, floorStage, canManage, pending, onStart, onResume, onPause, onFinish,
}: {
  orderId: string | null
  floorStage: FloorStage | null
  canManage: boolean
  pending: boolean
  onStart: () => void
  onResume: () => void
  onPause: () => void
  onFinish: () => void
}) {
  if (!orderId || !floorStage) {
    return <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
  }
  const meta = FLOOR_STAGE_META[floorStage]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color, whiteSpace: 'nowrap' }}>
        {meta.label}
      </span>
      {canManage && floorStage !== 'FINISHED' && (
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
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
    { key: 'issued', header: 'Kho đã xuất (cây)', align: 'right', cell: m => m.issuedBarCount.toLocaleString('vi-VN') },
    { key: 'need', header: 'Cần (đoạn)', align: 'right', cell: m => m.need.toLocaleString('vi-VN') },
    { key: 'done', header: 'Đã cắt đạt (đoạn)', align: 'right', cell: m => <span style={{ fontWeight: 700 }}>{m.done.toLocaleString('vi-VN')}</span> },
    { key: 'remain', header: 'Còn lại (đoạn)', align: 'right', cell: m => {
      const r = Math.max(0, m.need - m.done)
      return <span style={{ color: r > 0 ? 'var(--amber)' : 'var(--green)', fontWeight: 600 }}>{r.toLocaleString('vi-VN')}</span>
    } },
  ]
  const th: React.CSSProperties = { padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'right', textTransform: 'uppercase' }
  const td: React.CSSProperties = { padding: '6px 10px', fontSize: 12, textAlign: 'right', borderTop: '1px solid var(--border)' }
  return (
    <LenhSanXuatBoard
      title="Tiến độ cắt theo loại sắt"
      subtitle="Đoạn đã cắt so với định mức của lệnh, cộng dồn mọi đợt kho xuất — “đạt” = đã cắt trừ đoạn KCS chấm lỗi. Chi tiết từng cỡ đoạn hiện ngay bên dưới mỗi loại sắt"
      columns={cols} rows={materials} rowKey={m => m.materialId}
      expandedRow={m => (
        <div style={{ padding: '4px 14px 14px', background: 'var(--surface2)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Cỡ đoạn</th><th style={th}>Cần</th><th style={th}>Đã cắt</th><th style={th}>Lỗi</th><th style={th}>Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {m.segments.map(s => (
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
          {frame.piOrderCount > 1 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              Phôi cắt sắt chung cho cả PI ({frame.piOrderCount} lệnh) — số liệu dưới đây là của cả PI, không tách riêng từng lệnh.
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
  return Math.floor(pcts.reduce((a, b) => a + b, 0) / pcts.length)
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
function currentStageLabel(order: MfgOrder, details: StageDetails): { label: string; icon: React.ReactNode; pct: number } {
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

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
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
  )
}

// ─── Detail page ──────────────────────────────────────────────────────────────

function ThongKeDetailPage({ order, details, onBack, pointLabel }: { order: MfgOrder; details: StageDetails; onBack: () => void; pointLabel: (id: number) => string }) {
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
    reachedCards.find(c => c.isActive)?.stage.key ?? reachedCards[reachedCards.length - 1]?.stage.key ?? null,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
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
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 20, color: '#1d4ed8', letterSpacing: '0.02em' }}>{order.code}</div>
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
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 24px', marginBottom: 20 }}>
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
  /** Số item ĐÃ DUYỆT cùng PI (>1: Phôi dùng chung cho các lệnh, xem StageDetails.frame.piOrderCount). */
  piOrderCount: number
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

export default function ThongKePagePlan() {
  const { data: skusData, isLoading } = useFetch<Sku[]>(() => api.getSkus(), [])
  const { data: pisData, refetch: refetchPis } = useFetch<PIStatusRow[]>(() => api.getProductionInvoices(), [])
  const { data: weavingPointsData } = useFetch<WeavingPointLite[]>(() => (api as any).getWeavingPoints(), [])
  const { proposals } = useInspection()
  // Tên khách hàng cho các lệnh KHÔNG có Sku (PlanForm) đi kèm — xem buildSyntheticSku(). Sku thật
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
          piOrderCount: (pi.items ?? []).filter(i => i.prodApproval?.status === 'APPROVED').length,
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
  const { data: batchData, isLoading: rowsLoading } = useFetch(
    () => buildBatchProgressData(approvedRows),
    [approvedRows],
  )
  const orderRows = useMemo(
    () => approvedRows.map(row => buildOrderRow(row, proposals, batchData ?? EMPTY_BATCH_DATA)),
    [approvedRows, proposals, batchData],
  )

  const [filter, setFilter]         = useState<FilterStatus>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)

  // Chỉ QLSX (mfgRole=PRODUCTION_MANAGER) mới thấy nút Bắt đầu/Kết thúc - Boss/KHSX dùng chung
  // component này nhưng chỉ xem badge trạng thái xưởng, không có quyền thao tác (khớp
  // @RequireRole(BUSINESS_ROLES.PRODUCTION_MANAGER) ở BE production-orders.controller.ts).
  const { user } = useAuth()
  const canManageFloor = user?.mfgRole === 'PRODUCTION_MANAGER'
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

  const q = search.trim().toLowerCase()
  const filtered = orderRows
    .filter(({ order }) => filter === 'all' || order.status === filter)
    .filter(({ order }) => !q || [order.code, order.sku, order.productName, order.customer].some(v => v.toLowerCase().includes(q)))

  const counts = {
    all:       orderRows.length,
    PRODUCING: orderRows.filter(({ order }) => order.status === 'PRODUCING').length,
    DONE:      orderRows.filter(({ order }) => order.status === 'DONE').length,
    OVERDUE:   orderRows.filter(({ order }) => isOrderOverdue(order.deadline, order.status === 'DONE')).length,
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

  const selectedRow = selectedId != null ? orderRows.find(({ order }) => order.id === selectedId) ?? null : null
  if (selectedRow) {
    return <>{failedBanner}<ThongKeDetailPage order={selectedRow.order} details={selectedRow.details} onBack={() => setSelectedId(null)} pointLabel={pointLabel} /></>
  }

  return (
    <div>
      {failedBanner}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tổng hợp lệnh SX</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Tổng {counts.all} · Đang sản xuất {counts.PRODUCING} · Hoàn thành {counts.DONE}
          {counts.OVERDUE > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}> · ⚠ Quá hạn {counts.OVERDUE}</span>}
        </p>
      </div>

      {/* Filter + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
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
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Tìm mã PO, SKU, sản phẩm, khách hàng..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Mã PI</th>
              <th style={th}>Mã PO</th>
              <th style={th}>SKU / Sản phẩm</th>
              <th style={th}>Khách hàng</th>
              <th style={{ ...th, width: 220 }}>Công đoạn hiện tại</th>
              <th style={th}>Hạn giao</th>
              <th style={th}>Xưởng</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading || rowsLoading) ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</td></tr>
            ) : pageItems.map(({ order: o, details }) => {
              const isDone     = o.status === 'DONE'
              const isOverdue  = isOrderOverdue(o.deadline, isDone)
              const stageInfo  = currentStageLabel(o, details)
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
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{o.piCode}</td>
                  <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text2)' }}>{o.code}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{o.productName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{o.sku}</div>
                  </td>
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
                  <td style={td}>
                    <FloorStageCell
                      orderId={o.orderId}
                      floorStage={o.floorStage}
                      canManage={canManageFloor}
                      pending={!!o.orderId && floorPending.has(o.orderId)}
                      onStart={() => o.orderId && handleFloorAction(o.orderId, 'start')}
                      onResume={() => o.orderId && handleFloorAction(o.orderId, 'resume')}
                      onPause={() => o.orderId && handleFloorAction(o.orderId, 'pause')}
                      onFinish={() => o.orderId && handleFloorAction(o.orderId, 'finish')}
                    />
                  </td>
                </tr>
              )
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                  Không có lệnh nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
          <span>Hiển thị {pageItems.length}/{filtered.length} dòng</span>
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
