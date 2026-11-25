/**
 * Adapter màn quét QR tại máy (2026-10-13) - BE `src/modules/floor` (changelog BE
 * changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 22-23). Mã QR dán ở máy là link
 * `/floor?ws=<qrToken>`; PI KHÔNG nằm trong mã - BE tự lấy PI đang chạy của tổ.
 */
import { http } from './core/http'
import type { BePhoiProgressItem, BeSteelBalance } from './steel-issues-api'

/** Kiểu steelBalance dùng chung (định nghĩa ở steel-issues-api.ts) - giữ tên cũ để chỗ import cũ không vỡ. */
export type { BeSteelBalance }
import type { BeProductionBatchPlan } from './production-batches-api'
import type { MaterialChoice } from '../types/sku'
import type { SolverMachine } from '../types/admin'

export type FloorStage = 'PHOI' | 'HAN' | 'SON'
export type WorkstationKind = 'CUT' | 'STEP' | 'PIECE' | 'STEEL_RECEIVE'

export interface BeWorkstationBrief {
  id: string
  code: string
  name: string
  stage: FloorStage
  kind: WorkstationKind
  processStep: string | null
  /** Loại máy cắt (chỉ máy CUT; 13/11/2026). Thiếu/null = BE cũ hoặc không phải máy cắt. */
  cutMachineType?: SolverMachine | null
  /** Xưởng đặt máy (13/11/2026); null = chưa khai. */
  workshopName?: string | null
}

export interface BeScanOrder {
  productionOrderId: string
  poNumber: string
  sku: string
  productName: string
  quantity: number
  floorStage: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'FINISHED'
}

export interface BeScanSegment {
  segmentSpecId: string
  cutLengthMm: number
  required: number
  /**
   * Số ĐƯỢC TÍNH ở màn quét / Sản lượng (P1, 18/11/2026) = thô - lỗi - thiếu (BE 17/11 là thô - lỗi).
   * Khác `done` ở API phoi-progress (steel-issues-api.ts): ở đó done = đã báo - thiếu, vẫn gồm lỗi.
   */
  done: number
  /** KCS chấm lỗi (BE 17/11/2026). Optional: BE cũ chưa trả. */
  failed?: number
  /** Số công nhân đã báo (số thô, chưa trừ lỗi / thiếu). Optional: BE cũ chưa trả. */
  reportedQty?: number
  /** Số cần theo định mức, chưa cộng phần phải cắt bù (P1). Optional: BE cũ chưa trả. */
  baseRequired?: number
  /** Số phải cắt thêm vì KCS chấm "Bỏ, cắt lại" ở công đoạn sau (P1). Required = baseRequired + extraNeed. */
  extraNeed?: number
  /** KCS ghi thiếu (P1): đã trừ, không tính lỗi, không cần làm bù. */
  shortQty?: number
  /** Báo thêm được tối đa bao nhiêu ngay lúc này (P1) = max(0, min(còn cần, còn đoạn thực có)); Cắt = max(0, còn cần). */
  maxNow?: number
  /** Số đoạn thực có chưa dùng ở công đoạn trước (P1); null / thiếu với Cắt. */
  physicalLeft?: number | null
  byOrder: {
    productionOrderId: string | null
    required: number
    done: number
    failed?: number
    reportedQty?: number
    baseRequired?: number
    extraNeed?: number
    shortQty?: number
    maxNow?: number
    physicalLeft?: number | null
  }[]
}

export interface BeScanMaterial {
  materialId: string
  materialCode: string
  materialName: string
  hasReceivedSteel: boolean
  segments: BeScanSegment[]
}

export interface BeScanPieceItem {
  pieceId: string
  pieceCode: string
  pieceName: string
  plannedQty: number
  awaitingQcQty: number
  passedQty: number
  /** Đã báo, KCS chưa chấm (mọi người trong tổ). Từ P1 KCS tự chấm, không còn bước QLSX gửi KCS. */
  openQty: number
  /** Báo thêm được tối đa (P1) = max(0, cần - đạt - chờ - mở). Optional: BE cũ chưa trả. */
  maxNow?: number
  /** KCS chấm lỗi cộng dồn (BE trả ở màn quét máy PIECE; passedQty đã trừ lỗi). */
  failedQty?: number
  /** KCS ghi thiếu cộng dồn (P1; passedQty đã trừ thiếu). */
  shortQty?: number
}

export interface BeScanPi {
  productionInvoiceId: string
  code: string
  orders: BeScanOrder[]
  /** CUT/STEP */
  materials?: BeScanMaterial[]
  /** PIECE - theo productionOrderId */
  piecePlans?: Record<string, { items: BeScanPieceItem[] }>
}

export interface BeSteelToReceive {
  steelIssueId: string
  productionInvoiceId: string
  piCode: string
  materialCode: string
  materialName: string
  barCount: number
  barLengthMm: number
  issuedAt: string
  issuedByName: string | null
}

/** Lệnh Hàn / Sơn tự chọn trên màn quét (GET /floor/scan/:token, 23/11/2026). */
export interface BeStagePi {
  productionInvoiceId: string
  code: string
  deadline: string | null
  /** Số mảnh tổ còn thiếu của lệnh. */
  missingPieces: number
}

export interface BeScanContext {
  workstation: BeWorkstationBrief
  /** Từ 23/11/2026 BE luôn trả null / [] (bỏ hàng đợi); giữ trường để bản FE cũ không vỡ - màn mới không đọc. */
  runningPi?: { productionInvoiceId: string; code: string } | null
  reworkPis?: { productionInvoiceId: string; code: string; endedAt: string | null }[]
  /** Hàn / Sơn (23/11/2026): lệnh tổ làm được ở xưởng của máy, hạn giao tăng dần rồi mã lệnh. Phôi trả []. Thiếu = BE cũ. */
  stagePis?: BeStagePi[]
  pi?: BeScanPi | null
  steelToReceive?: BeSteelToReceive[]
  /** Chỉ máy cắt: dòng chia của máy theo thứ tự cắt (14/11/2026). rows rỗng = máy chưa được chia việc. */
  machineWork?: { rows: BeCutAllocationRow[]; barsDoneEst: number; barsLeftEst: number; status: CutMachineStatus }
  /** Lệnh báo được nhờ bảng chia (14/11/2026): máy cắt = lệnh có dòng trên máy; máy công đoạn tổ Phôi = lệnh có dòng chia ở xưởng. */
  allocationPis?: { productionInvoiceId: string; code: string }[]
}

export interface ScanReportInput {
  productionInvoiceId: string
  productionOrderId: string
  materialId?: string
  segments?: { segmentSpecId: string; qty: number }[]
  pieceId?: string
  qty?: number
}

export type MyOutputState = 'OPEN' | 'AWAITING_QC' | 'QC_DONE' | 'REMOVED'

export interface BeMyOutputRow {
  id: string
  kind: 'CUT' | 'STEP' | 'PIECE'
  createdAt: string
  piCode: string | null
  step: string | null
  workstation: { code: string; name: string } | null
  state: MyOutputState
  reversed: { reason: string | null; at: string; byName: string | null } | null
  lines: {
    qty: number
    segment: { cutLengthMm: number; materialCode: string } | null
    piece: { code: string; name: string } | null
  }[]
  /** Số KCS đã chấm của cả đợt (P1). null = chưa chấm. Optional: BE cũ chưa trả. */
  kcs?: null | { failedQty: number; shortQty: number }
  /** Mã đợt KCS chấm ('CUT:<id>' / 'STEP:<id>' / 'BATCH:<id>', P1 19/11) - gom nhãn "KCS chấm cả đợt". null = chưa gom
   *  đợt; optional: BE cũ chưa trả. */
  batchKey?: string | null
}

const key = (idempotencyKey: string) => ({ headers: { 'Idempotency-Key': idempotencyKey } })

export function getScanContext(qrToken: string, productionInvoiceId?: string) {
  const q = productionInvoiceId ? `?productionInvoiceId=${encodeURIComponent(productionInvoiceId)}` : ''
  return http.get<BeScanContext>(`/floor/scan/${encodeURIComponent(qrToken)}${q}`)
}

export function postScanReport(qrToken: string, data: ScanReportInput, idempotencyKey: string) {
  return http.post<unknown>(`/floor/scan/${encodeURIComponent(qrToken)}/reports`, data, key(idempotencyKey))
}

export function receiveSteelByScan(qrToken: string, steelIssueId: string, receivedBarCount: number) {
  return http.post<unknown>(
    `/floor/scan/${encodeURIComponent(qrToken)}/steel-issues/${steelIssueId}/receive`,
    { receivedBarCount },
  )
}

export function getMyOutput(from?: string, to?: string) {
  const p = new URLSearchParams()
  if (from) p.set('from', from)
  if (to) p.set('to', to)
  const q = p.toString()
  return http.get<BeMyOutputRow[]>(`/floor/my-output${q ? `?${q}` : ''}`)
}

// ─── QLSX: "Báo cáo sản lượng đạt KCS" (2026-10-15) ───────────────────────────

/** Loại việc trong báo cáo: CAT..XE đếm ĐOẠN (theo cỡ), PHOI/HAN/SON đếm MẢNH. */
export type StatOp = 'CAT' | 'UON' | 'DAP' | 'DUC_LO' | 'TAN' | 'TOP_DAU' | 'XE' | 'NHAN' | 'PHOI' | 'HAN' | 'SON'
export type StatsGroupBy = 'day' | 'month' | 'year'

export interface BeStatRow {
  /** Khoá kỳ theo giờ VN: 'YYYY-MM-DD' | 'YYYY-MM' | 'YYYY'. */
  bucket: string
  op: StatOp
  /** null = đợt cũ chưa ghi người làm (trước QR) hoặc đợt công đoạn phụ gom nhiều người. */
  workerId: string | null
  workerName: string | null
  /** Cỡ đoạn + loại sắt ("185mm · Sắt phi 4") hoặc tên mảnh. */
  label: string
  passed: number
  failed: number
}

export interface BeStatPending {
  op: StatOp
  /** Người làm (cùng quy ước BeStatRow) - mỗi (loại việc, người) một dòng. */
  workerId: string | null
  workerName: string | null
  notSent: number
  awaitingQc: number
}

export interface BeFloorStats {
  range: { from: string; to: string; groupBy: StatsGroupBy; timezone: string }
  buckets: string[]
  rows: BeStatRow[]
  /** Đã báo mà KCS chưa duyệt, tính đến bây giờ (không theo kỳ). */
  pending: BeStatPending[]
  generatedAt: string
}

/**
 * Số ĐÃ KCS duyệt của CHÍNH người đăng nhập (công nhân xem "Sản lượng của tôi"). BE lấy id từ token - không có tham số công
 * nhân, nên công nhân A không xem được số của công nhân B.
 */
export function getMyStats(p: { from: string; to: string; groupBy: StatsGroupBy }) {
  const q = new URLSearchParams({ from: p.from, to: p.to, groupBy: p.groupBy })
  return http.get<BeFloorStats>(`/floor/my-stats?${q.toString()}`)
}

// ─── QLSX: màn "Sản lượng xưởng" (2026-10-13) ────────────────────────────────

export interface BeWorkstation extends BeWorkstationBrief {
  qrToken: string
  isActive: boolean
  createdAt: string
  /** Xưởng đặt máy (13/11/2026); null/thiếu = chưa khai. */
  workshopId?: string | null
}

export interface CreateWorkstationInput {
  code: string
  /** 21/11/2026: màn bỏ ô Tên gọi - không gửi thì BE lấy tên = mã. */
  name?: string
  stage: FloorStage
  kind: WorkstationKind
  processStep?: string
  /** Xưởng đặt máy (id). */
  workshopId?: string
  /** Chỉ cho máy cắt; BE mặc định laser nếu thiếu. */
  cutMachineType?: SolverMachine
}

export interface UpdateWorkstationInput {
  /** 21/11/2026: đổi mã ngắn in trên tem (tên đổi theo mã). */
  code?: string
  name?: string
  isActive?: boolean
  /** null = bỏ xưởng. */
  workshopId?: string | null
  /** Chỉ máy cắt. */
  cutMachineType?: SolverMachine
}

export interface BeFloorWorker {
  id: string
  username: string
  firstName: string
  lastName: string
  fullName: string | null
  stage: FloorStage | null
  isActive: boolean
  createdAt: string
  /** SET = công nhân tự đặt PIN; ADMIN_SET = PIN do QLSX đặt (tài khoản cũ); PENDING = chờ đặt PIN lần đầu; EXPIRED = quá hạn. */
  pinState: 'SET' | 'ADMIN_SET' | 'PENDING' | 'EXPIRED'
  pinClaimExpiresAt: string | null
  pinSetAt: string | null
  /** Còn khoá tạm (nhập sai PIN quá 5 lần) đến giờ này; null = không khoá. */
  lockedUntil: string | null
}

/** Ngăn số của tiến độ (BE floor-progress.util): reported = passed + awaiting + open = Σ min(Đã báo − Lỗi, Cần). */
export interface BeFloorProgressBuckets {
  required: number
  reported: number
  passed: number
  awaiting: number
  open: number
  failed: number
}

/** Tiến độ tổ trên PI đang chạy (2026-10-19): Phôi = Cắt + công đoạn phụ + mảnh Phôi, cùng % với "Tổng hợp lệnh SX". */
export interface BeFloorProgress extends BeFloorProgressBuckets {
  percent: number
  complete: boolean
  /** `step`: 'CAT' | công đoạn phụ (UON/DAP/...) | 'PIECE' (mảnh/vật tư thành phẩm). */
  breakdown: (BeFloorProgressBuckets & { step: string; percent: number })[]
  missing: {
    /** Số dòng (cỡ đoạn × công đoạn / mảnh) còn thiếu. */
    lines: number
    /** Phôi: số loại sắt còn thiếu; trong đó `materialsNotReceived` loại Phôi chưa nhận đợt sắt nào. */
    materials: number
    materialsNotReceived: number
    /** Số mảnh / vật tư thành phẩm còn thiếu. */
    pieces: number
  }
}

/** GET /floor/stage-progress/:stage/:piId - ngăn "còn thiếu gì" của thẻ PI: tiến độ + đúng dữ liệu gốc BE đã dùng để tính. */
export interface BeStageDetail {
  productionInvoiceId: string
  piCode: string
  stage: FloorStage
  progress: BeFloorProgress
  orders: { productionOrderId: string; poNumber: string; productName: string; wireMaterial?: MaterialChoice | null; cushionMaterial?: MaterialChoice | null }[]
  /** Chỉ tổ Phôi (null với Hàn/Sơn). */
  phoi: BePhoiProgressItem[] | null
  /** batch-plan của tổ theo từng SKU (khoá = productionOrderId). */
  plans: Record<string, BeProductionBatchPlan>
}

/** Một dòng GET /floor/stage-progress (23/11/2026): lệnh của tổ + tiến độ tóm tắt. */
export interface BeStageProgressRow {
  productionInvoiceId: string
  code: string
  deadline: string | null
  percent: number
  missingPieces: number
  /** Tổ đã đủ số. */
  complete: boolean
  /** Thời điểm xong Phôi (ISO); null = chưa xong / không phải Phôi. */
  phoiDoneAt: string | null
}

export interface BeReviewReport {
  floorReportId: string
  createdAt: string
  reportedByName: string | null
  workstation: { code: string; name: string } | null
  lines: { qty: number; cutLengthMm: number | null; piece: { code: string; name: string } | null }[]
  reversed: { reason: string | null; at: string; byName: string | null } | null
}

interface ReviewRef {
  pi: { productionInvoiceId: string; code: string } | null
  order: { productionOrderId: string; poNumber: string; sku: string } | null
}

/** Mỗi cỡ đoạn của đợt: số trong đợt này + số cần / đã làm của SKU (required = 0: không rõ) + phần vượt. */
export interface BeSegmentProgress {
  cutLengthMm: number
  qty: number
  required: number
  /** Số ĐƯỢC TÍNH của SKU (P1) = thô - lỗi - thiếu. Khác `done` của API phoi-progress (đã báo - thiếu, gồm lỗi). */
  done: number
  /** KCS chấm lỗi (BE 17/11/2026). Optional: BE cũ chưa trả. */
  failed?: number
  /** Số công nhân đã báo, số thô (BE 17/11/2026). KHÔNG lấy từ done. Optional: BE cũ chưa trả. */
  reportedQty?: number
  /** Số cần theo định mức chưa cộng phần cắt bù (P1). required = baseRequired + extraNeed. */
  baseRequired?: number
  /** Số phải cắt thêm vì KCS chấm "Bỏ, cắt lại" ở công đoạn sau (P1). */
  extraNeed?: number
  /** KCS ghi thiếu (P1). */
  shortQty?: number
  /** Báo thêm được tối đa lúc này (P1). */
  maxNow?: number
  over: number
}

/** Lý do dòng đang mở chưa chấm được (P1): lệnh dừng / kết thúc, hoặc dữ liệu cũ chưa gắn SKU ở PI nhiều SKU. */
export type BeReviewBlockedReason = 'LENH_DUNG' | 'CHUA_GAN_SKU'

/** Trường chung của mọi dòng trong danh sách đợt đang mở (P1). Optional: BE cũ chưa trả. */
interface ReviewRowExtra {
  /** PI còn SKU đang chạy (QLSX đã bấm "Bắt đầu" và chưa "Kết thúc"). */
  piActive?: boolean
  /** null = chấm được. */
  blockedReason?: BeReviewBlockedReason | null
}

export interface BeReviewCutBundle extends ReviewRef, ReviewRowExtra {
  cutBundleId: string
  material: { materialId: string; code: string; name: string }
  openedByName: string | null
  createdAt: string
  /** Lần báo còn hiệu lực đầu tiên chưa chấm - "chờ bao lâu" tính từ đây. */
  waitingSince: string
  segments: { cutLengthMm: number; qty: number }[]
  progress: BeSegmentProgress[]
  steelBalance: BeSteelBalance | null
  reports: BeReviewReport[]
}

export interface BeReviewStepGroup extends ReviewRef, ReviewRowExtra {
  material: { materialId: string; code: string; name: string }
  step: string
  /** Công nhân của nhóm (mỗi người 1 nhóm); null = đợt cũ chưa biết người. */
  workerId: string | null
  workerName: string | null
  waitingSince: string
  segments: { cutLengthMm: number; qty: number }[]
  progress: BeSegmentProgress[]
  reports: BeReviewReport[]
}

export interface BeReviewPieceBatch extends ReviewRef, ReviewRowExtra {
  productionBatchId: string
  stage: FloorStage
  piece: { code: string; name: string }
  reportedQty: number
  openedByName: string | null
  openedAt: string
  waitingSince: string
  /** Số cần / đã báo (mọi người, mọi trạng thái) của mảnh này trong SKU; required = 0: không rõ. */
  progress: {
    required: number
    /** Đã tính = đạt + chờ chấm + đang mở (chưa chặn trần). */
    reported: number
    over: number
    /** Báo thêm được tối đa = max(0, cần - đạt - chờ - mở) (P1). Optional: BE cũ chưa trả. */
    maxNow?: number
  }
  reports: BeReviewReport[]
}

/**
 * Pat (công đoạn của mảnh) - chỉ stage = PHOI; không có sổ báo (không Hủy được từng lần) nên waitingSince = createdAt sớm nhất
 * của dòng chưa gom (P1). pieceId nằm NGOÀI (BE: `pieceId` + `piece: { code, name }`), cần cho nút Chốt.
 */
export interface BeReviewPieceStepGroup extends ReviewRef, ReviewRowExtra {
  productionOrderId: string
  pieceId: string
  piece: { code: string; name: string }
  step: string
  waitingSince: string
  /** Σ số chưa chốt của nhóm. */
  qty: number
  reportedByNames: string[]
  /** Theo đúng công đoạn này của mảnh trong SKU: done = đã báo - lỗi - thiếu; maxNow = max(0, required - done). */
  progress: { required: number; reportedQty: number; done: number; failed: number; shortQty: number; over: number; maxNow: number }
}

/**
 * Chân nhôm / vật tư không gắn mảnh - chỉ stage = PHOI (P1). Không có `order` (cấp PI): khoá để chốt là
 * productionInvoiceId + recipeId + step. Không có sổ báo.
 */
export interface BeReviewMaterialYieldGroup extends ReviewRowExtra {
  productionInvoiceId: string
  recipeId: string
  pi: ReviewRef['pi']
  material: { materialId: string; code: string; name: string }
  step: string
  waitingSince: string
  /** Σ số chưa chốt của nhóm. */
  qty: number
  reportedByNames: string[]
  /** done = Σ báo - lỗi - thiếu (đã gồm cả lần đang chờ); maxNow = max(0, required - done). */
  progress: { required: number; done: number; over: number; maxNow: number }
}

export interface BeFloorReview {
  cutBundles: BeReviewCutBundle[]
  stepGroups: BeReviewStepGroup[]
  pieceBatches: BeReviewPieceBatch[]
  /** Chỉ khi stage = PHOI (P1); BE cũ không trả. */
  pieceStepGroups?: BeReviewPieceStepGroup[]
  /** Chỉ khi stage = PHOI (P1); BE cũ không trả. */
  materialYieldGroups?: BeReviewMaterialYieldGroup[]
  /** PI của tổ đang có đợt chờ KCS mà không còn SKU nào chạy (P1, MF2). KCS tô xám dòng AWAITING_QC của các PI này và khoá nút Chấm. BE cũ không trả. */
  stoppedPis?: { productionInvoiceId: string; code: string }[]
  /** Id lệnh SX đã huỷ. Câu 4 (anh Nhân 24/11/2026): KCS vẫn chấm nốt đợt của các lệnh này - FE chỉ bỏ xám + gắn nhãn. BE cũ không trả. */
  cancelledOrderIds?: string[]
}

export interface BeFloorSummaryStage {
  /** Đợt đang mở có sổ báo, trừ dòng có blockedReason. */
  open: number
  /** Đợt KCS đang chấm (AWAITING_QC của 5 bảng, trừ PI dừng) - P1. Optional: BE cũ chưa trả. */
  awaitingKcs?: number
  /** Đợt chờ KCS chấm quá 4 giờ - P1. Optional: BE cũ chưa trả. */
  stale?: number
}

export interface BeFloorSummary {
  PHOI: BeFloorSummaryStage
  HAN: BeFloorSummaryStage
  SON: BeFloorSummaryStage
}

export interface BeFloorSettings {
  /** Địa chỉ gốc in lên tem QR (vd https://erpdna.vercel.app); null = dùng địa chỉ trình duyệt đang mở. Admin đặt ở Cấu hình hệ thống - QLSX chỉ đọc. */
  publicUrl: string | null
}

/** Bảng chia sắt cho máy cắt (13/11/2026) - BE `/floor/cut-allocation`; mọi route đều trả cùng bảng này. */
export type CutSegmentStep = 'UON' | 'DAP' | 'DUC_LO' | 'TAN'
export type CutAllocClass = 'TU_DONG' | 'LASER'

/** EMPTY = chưa có dòng · IDLE = máy rảnh (đã cắt hết) · LOW = còn ≤ 20 cây · BUSY = còn nhiều. */
export type CutMachineStatus = 'EMPTY' | 'IDLE' | 'LOW' | 'BUSY'

export interface BeCutAllocationMachine {
  id: string
  code: string
  name: string
  cutMachineType: SolverMachine
  totalBars: number
  rowCount: number
  plannedSegments: number
  /** Đoạn đã báo qua QR tại máy - XẤP XỈ (cộng theo cặp lệnh + loại sắt đang có trên máy). */
  reportedSegments: number
  /** Số cây ƯỚC đã cắt / còn lại (C2, 14/11/2026). */
  barsDoneEst: number
  barsLeftEst: number
  status: CutMachineStatus
}

export interface BeCutAllocationSegment {
  cutLengthMm: number
  countPerBar: number
  steps: CutSegmentStep[]
  pieceNames: string[]
}

export interface BeCutAllocationRow {
  id: string
  workstationId: string
  seq: number
  isManual: boolean
  productionInvoiceId: string
  piCode: string
  /** Ngày dạng YYYY-MM-DD (giờ VN). */
  priority: { phoiStart: string | null; bookingDue: string | null; deadline: string | null }
  cuttingProposalId: string
  patternId: string
  patternIndex: number
  patternBarCount: number
  materialId: string
  materialCode: string
  materialLabel: string
  barLengthMm: number | null
  lineMachine: SolverMachine | null
  machineClass: CutAllocClass
  barCount: number
  /** Số cây ƯỚC đã cắt của dòng (≤ barCount). */
  barsDoneEst: number
  segments: BeCutAllocationSegment[]
  punchedSegments: { cutLengthMm: number; countPerBar: number }[] | null
  bundles: Record<string, number> | null
  wastePerBarMm: number | null
  lineSurplus: { cutLengthMm: number; surplus: number }[]
  hasBend: boolean
  /** Kiểu cắt theo bó (Sếp chốt 14/11): không tách, không đổi số cây, đổi máy chỉ khi máy hư. */
  isBundle: boolean
  /** Id các máy BE chấp nhận cho dòng này; BE cũ chưa trả thì FE dùng luật dự phòng. */
  allowedMachineIds?: string[]
}

export interface BeCutAllocationUnallocated {
  productionInvoiceId: string
  piCode: string
  materialId: string
  materialLabel: string
  bars: number
  /** true = lệnh có ≥ 1 SKU đang chạy ở xưởng này. BE cũ chưa trả thì coi là true (undefined !== false). */
  started?: boolean
}

export interface BeCutAllocationWaiting {
  productionInvoiceId: string
  piCode: string
  materialId: string
  materialLabel: string
  requiredBars: number
  availableBars: number
  shortBars: number
  /** Số cây đang giữ cho lệnh ở kho xưởng khác (lệnh vừa đổi xưởng, chờ chuyển kho). */
  heldElsewhereBars?: number
  /** Như `BeCutAllocationUnallocated.started`. */
  started?: boolean
}

export interface BeCutAllocationBoard {
  workshop: { id: string; code: string; name: string; laserAllowed: boolean }
  machines: BeCutAllocationMachine[]
  rows: BeCutAllocationRow[]
  unallocated: BeCutAllocationUnallocated[]
  waiting: BeCutAllocationWaiting[]
  staleCount: number
  warnings: string[]
}

export type CutAllocationMode = 'append' | 'redo'

/** Lý do điều chuyển trên bảng chia (14/11/2026). */
export type CutAllocationReason = 'MACHINE_BROKEN' | 'OTHER'
export type CutAllocationLogAction = 'ADD' | 'SPLIT' | 'MOVE' | 'BARS' | 'REMOVE' | 'AUTO_PULL'

export interface BeCutAllocationLogEntry {
  id: string
  createdAt: string
  action: CutAllocationLogAction
  reason: CutAllocationReason | null
  note: string | null
  isBundle: boolean
  barCount: number
  previousBarCount: number | null
  productionInvoiceId: string
  piCode: string
  materialLabel: string | null
  fromMachine: { id: string; name: string } | null
  toMachine: { id: string; name: string } | null
  createdByName: string | null
}

export interface BeCutAllocationLogByOrder {
  productionInvoiceId: string
  piCode: string
  moves: number
  splits: number
  machineBrokenMoves: number
}

/** Năng suất máy cắt (đợt C4a, chỉ đọc): đo từ giờ công nhân báo qua QR, chưa áp luật chia. */
export interface BeCutMachineStats {
  workshop: { id: string; code: string; name: string }
  range: { from: string; to: string; timezone: 'Asia/Ho_Chi_Minh' }
  method: {
    lunchBreak: { from: '11:30'; to: '13:00' }
    maxGapMinutes: number
    minRateMinutes: number
    defaultBarLengthMm: number
    blade: { laser: number; tu_dong: number }
    trim: { laser: number; tu_dong: number }
  }
  machines: Array<{ id: string; code: string; name: string; machineType: 'laser' | 'tu_dong'; isActive: boolean }>
  days: Array<{
    machineId: string; day: string; reports: number; firstAt: string; lastAt: string
    segments: number; meters: number; bars: number; rateBars: number; rateMinutes: number; barsPerHour: number | null
    materials: Array<{ materialId: string; label: string; bars: number }>
  }>
  byMachine: Array<{ machineId: string; daysWithData: number; totalBars: number; barsPerDayAvg: number; barsPerDayMedian: number; barsPerHour: number | null }>
  byMachineType: Array<{ machineType: 'laser' | 'tu_dong'; machines: number; machineDays: number; barsPerDayAvg: number; barsPerDayMedian: number; barsPerHour: number | null }>
  byMaterial: Array<{ machineType: 'laser' | 'tu_dong'; materialId: string; label: string; bars: number; rateBars: number; rateMinutes: number; barsPerHour: number | null }>
  generatedAt: string
}

export interface BeCutAllocationLog {
  entries: BeCutAllocationLogEntry[]
  byOrder: BeCutAllocationLogByOrder[]
}

export const floorAdmin = {
  settings: () => http.get<BeFloorSettings>('/floor/settings'),
  /** Chỉ vai QLSX (KCS gọi sẽ 403 "cần: PRODUCTION_MANAGER"); KCS lấy số chờ từ GET /me/work-queue (kcsPhoi / kcsHan / kcsSon). */
  summary: () => http.get<BeFloorSummary>('/floor/summary'),
  review: (stage: FloorStage, productionInvoiceId?: string) =>
    http.get<BeFloorReview>(`/floor/review?stage=${stage}${productionInvoiceId ? `&productionInvoiceId=${productionInvoiceId}` : ''}`),
  /** Số đạt/lỗi KCS đã chốt theo khoảng ngày (giờ VN); `from`/`to` dạng YYYY-MM-DD. */
  stats: (p: { from: string; to: string; groupBy: StatsGroupBy; stage?: FloorStage }) => {
    const q = new URLSearchParams({ from: p.from, to: p.to, groupBy: p.groupBy })
    if (p.stage) q.set('stage', p.stage)
    return http.get<BeFloorStats>(`/floor/stats?${q.toString()}`)
  },
  /** @deprecated Từ P1 KCS tự chấm; BE trả 403 "Từ nay KCS tự chấm ... QLSX không cần gửi KCS nữa". Chỉ giữ cho tới khi màn hình bỏ chỗ gọi. */
  sendCutBundle: (id: string) => http.post<unknown>(`/floor/review/cut-bundles/${id}/send-kcs`),
  /** @deprecated Xem sendCutBundle. */
  sendProductionBatch: (id: string) => http.post<unknown>(`/floor/review/production-batches/${id}/send-kcs`),
  /** @deprecated Xem sendCutBundle. */
  sendStepGroup: (g: {
    productionInvoiceId: string
    materialId: string
    step: string
    productionOrderId: string
    workerId: string | null
  }) => http.post<unknown>('/floor/review/step-groups/send-kcs', g),
  /** Sản lượng theo lệnh của tổ (23/11/2026). QLSX gắn xưởng: BE tự lấy xưởng của họ; tài khoản tổ chỉ xem tổ mình. */
  stageProgress: (stage: FloorStage, workshopId?: string | null, productionInvoiceIds?: string[]) => {
    const q = new URLSearchParams({ stage })
    if (workshopId) q.set('workshopId', workshopId)
    // Có danh sách id thì BE trả đúng các lệnh đó (không áp cửa sổ 7 ngày); tối đa 200 id mỗi lần gọi.
    if (productionInvoiceIds && productionInvoiceIds.length > 0) q.set('productionInvoiceIds', productionInvoiceIds.join(','))
    return http.get<BeStageProgressRow[]>(`/floor/stage-progress?${q.toString()}`)
  },
  stageDetail: (stage: FloorStage, productionInvoiceId: string) =>
    http.get<BeStageDetail>(`/floor/stage-progress/${stage}/${productionInvoiceId}`),

  workstations: () => http.get<BeWorkstation[]>('/floor/workstations'),
  createWorkstation: (d: CreateWorkstationInput) => http.post<BeWorkstation>('/floor/workstations', d),
  updateWorkstation: (id: string, d: UpdateWorkstationInput) =>
    http.patch<BeWorkstation>(`/floor/workstations/${id}`, d),
  regenerateToken: (id: string) => http.post<BeWorkstation>(`/floor/workstations/${id}/regenerate-token`),

  workers: () => http.get<BeFloorWorker[]>('/floor/workers'),
  /** Không có PIN: công nhân tự đặt ở lần đăng nhập đầu (QLSX không biết PIN). */
  createWorker: (d: { username: string; firstName: string; lastName: string; stage: FloorStage }) =>
    http.post<BeFloorWorker>('/floor/workers', d),
  updateWorker: (id: string, d: { firstName?: string; lastName?: string; stage?: FloorStage; isActive?: boolean }) =>
    http.patch<BeFloorWorker>(`/floor/workers/${id}`, d),
  /** Cho đặt lại PIN: xoá PIN cũ, công nhân tự đặt PIN mới ở lần đăng nhập kế. */
  resetWorkerPin: (id: string) => http.post<BeFloorWorker>(`/floor/workers/${id}/reset-pin`),
  unlockWorker: (id: string) => http.post<BeFloorWorker>(`/floor/workers/${id}/unlock`),

  // ─── Chia máy cắt (13/11/2026): `workshopId` chỉ cần với QLSX chung; QLSX có xưởng thì BE tự lấy xưởng của họ ───
  getCutAllocation: (workshopId?: string | null) =>
    http.get<BeCutAllocationBoard>(`/floor/cut-allocation${workshopId ? `?workshopId=${encodeURIComponent(workshopId)}` : ''}`),
  autoCutAllocation: (d: { workshopId?: string | null; mode: CutAllocationMode }) =>
    http.post<BeCutAllocationBoard>('/floor/cut-allocation/auto', { workshopId: d.workshopId || undefined, mode: d.mode }),
  addCutAllocation: (d: { workshopId?: string | null; productionInvoiceId: string; materialId: string }) =>
    http.post<BeCutAllocationBoard>('/floor/cut-allocation/add', {
      workshopId: d.workshopId || undefined, productionInvoiceId: d.productionInvoiceId, materialId: d.materialId,
    }),
  updateCutAllocation: (id: string, d: { workstationId?: string; barCount?: number; reason?: CutAllocationReason; note?: string }) =>
    http.patch<BeCutAllocationBoard>(`/floor/cut-allocation/${id}`, d),
  splitCutAllocation: (id: string, d: { barCount: number; workstationId: string; reason?: CutAllocationReason; note?: string }) =>
    http.post<BeCutAllocationBoard>(`/floor/cut-allocation/${id}/split`, d),
  reorderCutAllocation: (d: { workstationId: string; rowIds: string[] }) =>
    http.post<BeCutAllocationBoard>('/floor/cut-allocation/reorder', d),
  deleteCutAllocation: (id: string) => http.del<BeCutAllocationBoard>(`/floor/cut-allocation/${id}`),
  /** Lịch sử chia tay (mặc định 30 ngày); `from`/`to` dạng YYYY-MM-DD. */
  getCutAllocationLog: (p: { workshopId?: string | null; productionInvoiceId?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams()
    if (p.workshopId) q.set('workshopId', p.workshopId)
    if (p.productionInvoiceId) q.set('productionInvoiceId', p.productionInvoiceId)
    if (p.from) q.set('from', p.from)
    if (p.to) q.set('to', p.to)
    const qs = q.toString()
    return http.get<BeCutAllocationLog>(`/floor/cut-allocation/log${qs ? `?${qs}` : ''}`)
  },
  /** Năng suất máy cắt (chỉ đọc). QLSX gắn xưởng: bỏ trống workshopId hoặc đúng xưởng mình; QLSX chung: bắt buộc. */
  getCutMachineStats: (p: { workshopId?: string | null; from?: string; to?: string }) => {
    const q = new URLSearchParams()
    if (p.workshopId) q.set('workshopId', p.workshopId)
    if (p.from) q.set('from', p.from)
    if (p.to) q.set('to', p.to)
    const qs = q.toString()
    return http.get<BeCutMachineStats>(`/floor/stats/cut-machines${qs ? `?${qs}` : ''}`)
  },
}
