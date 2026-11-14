/**
 * Adapter màn quét QR tại máy (2026-10-13) - BE `src/modules/floor` (changelog BE
 * changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 22-23). Mã QR dán ở máy là link
 * `/floor?ws=<qrToken>`; PI KHÔNG nằm trong mã - BE tự lấy PI đang chạy của tổ.
 */
import { http } from './core/http'
import type { BePhoiProgressItem } from './steel-issues-api'
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
  done: number
  byOrder: { productionOrderId: string | null; required: number; done: number }[]
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
  /** Đã báo nhưng QLSX chưa gửi KCS (mọi người trong tổ). */
  openQty: number
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

export interface BeScanContext {
  workstation: BeWorkstationBrief
  runningPi?: { productionInvoiceId: string; code: string } | null
  reworkPis?: { productionInvoiceId: string; code: string; endedAt: string | null }[]
  pi?: BeScanPi | null
  steelToReceive?: BeSteelToReceive[]
  /** Chỉ máy cắt: dòng chia của máy theo thứ tự cắt (14/11/2026). rows rỗng = máy chưa được chia việc. */
  machineWork?: { rows: BeCutAllocationRow[]; barsDoneEst: number; barsLeftEst: number; status: CutMachineStatus }
  /** Lệnh báo được nhờ bảng chia (14/11/2026), ngoài runningPi / reworkPis: máy cắt = lệnh có dòng trên máy; máy công đoạn tổ Phôi = lệnh có dòng chia ở xưởng. */
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
  name: string
  stage: FloorStage
  kind: WorkstationKind
  processStep?: string
  /** Xưởng đặt máy (id). */
  workshopId?: string
  /** Chỉ cho máy cắt; BE mặc định laser nếu thiếu. */
  cutMachineType?: SolverMachine
}

export interface UpdateWorkstationInput {
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

export type FloorQueueStatus = 'QUEUED' | 'RUNNING' | 'DONE'

export interface BeQueueEntry {
  id: string
  stage: FloorStage
  productionInvoiceId: string
  piCode: string
  position: number
  status: FloorQueueStatus
  queuedAt: string
  startedAt: string | null
  startedByName: string | null
  endedAt: string | null
  endedByName: string | null
  hasActiveFloor: boolean
  progress: BeFloorProgress | null
  /** Chỉ true ở dòng DONE đóng gần nhất của tổ và "Mở lại" làm được (PI đang chạy chưa có lần báo nào). */
  canReopen: boolean
  /** Xưởng của hàng đợi (14/11/2026); Sơn theo nơi sơn. */
  workshopId: string | null
  workshopName: string | null
  /** Xưởng của chính lệnh - khác xưởng hàng đợi khi lệnh sơn nhờ (lệnh Phước An trong hàng đợi Sơn của Phú An). */
  piWorkshopName?: string | null
}

/** Nhãn "Lệnh của …" chỉ khi lệnh thuộc xưởng khác xưởng của hàng đợi (ô chọn xưởng đã ghi xưởng hàng đợi). */
export function otherWorkshopLabel(e: Pick<BeQueueEntry, 'workshopName' | 'piWorkshopName'>): string | null {
  return e.piWorkshopName && e.piWorkshopName !== e.workshopName ? `Lệnh của ${e.piWorkshopName}` : null
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

/** GET /floor/queue/:stage/detail/:piId - ngăn "còn thiếu gì" của thẻ PI: tiến độ + đúng dữ liệu gốc BE đã dùng để tính. */
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

export interface BeQueueCandidate {
  productionInvoiceId: string
  code: string
  deadline: string | null
  orderCount: number
  activeOrderCount: number
  workshopId: string | null
  workshopName: string | null
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
  done: number
  over: number
}

/** Sắt vào – đoạn ra của 1 loại sắt cả PI (mm): đoạn đã báo vượt sắt đã nhận bao nhiêu. */
export interface BeSteelBalance {
  receivedBarCount: number
  usableMm: number
  reportedMm: number
  overMm: number
}

export interface BeReviewCutBundle extends ReviewRef {
  cutBundleId: string
  material: { materialId: string; code: string; name: string }
  openedByName: string | null
  createdAt: string
  /** Lần báo còn hiệu lực đầu tiên chưa gửi KCS - "chờ bao lâu" tính từ đây. */
  waitingSince: string
  segments: { cutLengthMm: number; qty: number }[]
  progress: BeSegmentProgress[]
  steelBalance: BeSteelBalance | null
  reports: BeReviewReport[]
}

export interface BeReviewStepGroup extends ReviewRef {
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

export interface BeReviewPieceBatch extends ReviewRef {
  productionBatchId: string
  stage: FloorStage
  piece: { code: string; name: string }
  reportedQty: number
  openedByName: string | null
  openedAt: string
  waitingSince: string
  /** Số cần / đã báo (mọi người, mọi trạng thái) của mảnh này trong SKU; required = 0: không rõ. */
  progress: { required: number; reported: number; over: number }
  reports: BeReviewReport[]
}

export interface BeFloorReview {
  cutBundles: BeReviewCutBundle[]
  stepGroups: BeReviewStepGroup[]
  pieceBatches: BeReviewPieceBatch[]
}

export interface BeFloorSummary {
  PHOI: { open: number }
  HAN: { open: number }
  SON: { open: number }
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
  summary: () => http.get<BeFloorSummary>('/floor/summary'),
  review: (stage: FloorStage, productionInvoiceId?: string) =>
    http.get<BeFloorReview>(`/floor/review?stage=${stage}${productionInvoiceId ? `&productionInvoiceId=${productionInvoiceId}` : ''}`),
  /** Số đạt/lỗi KCS đã chốt theo khoảng ngày (giờ VN); `from`/`to` dạng YYYY-MM-DD. */
  stats: (p: { from: string; to: string; groupBy: StatsGroupBy; stage?: FloorStage }) => {
    const q = new URLSearchParams({ from: p.from, to: p.to, groupBy: p.groupBy })
    if (p.stage) q.set('stage', p.stage)
    return http.get<BeFloorStats>(`/floor/stats?${q.toString()}`)
  },
  sendCutBundle: (id: string) => http.post<unknown>(`/floor/review/cut-bundles/${id}/send-kcs`),
  sendProductionBatch: (id: string) => http.post<unknown>(`/floor/review/production-batches/${id}/send-kcs`),
  sendStepGroup: (g: {
    productionInvoiceId: string
    materialId: string
    step: string
    productionOrderId: string
    workerId: string | null
  }) => http.post<unknown>('/floor/review/step-groups/send-kcs', g),
  reverse: (floorReportId: string, reason: string) =>
    http.post<unknown>(`/floor/reports/${floorReportId}/reverse`, { reason }),

  // Hàng đợi theo xưởng (14/11/2026): QLSX gắn xưởng thì BE tự lấy xưởng của họ; người không gắn xưởng gửi xưởng đang xem.
  queue: (stage?: FloorStage, workshopId?: string | null) => {
    const q = new URLSearchParams()
    if (stage) q.set('stage', stage)
    if (workshopId) q.set('workshopId', workshopId)
    const qs = q.toString()
    return http.get<BeQueueEntry[]>(`/floor/queue${qs ? `?${qs}` : ''}`)
  },
  stageDetail: (stage: FloorStage, productionInvoiceId: string) =>
    http.get<BeStageDetail>(`/floor/queue/${stage}/detail/${productionInvoiceId}`),
  queueCandidates: (stage: FloorStage, workshopId?: string | null) =>
    http.get<BeQueueCandidate[]>(`/floor/queue/candidates?stage=${stage}${workshopId ? `&workshopId=${encodeURIComponent(workshopId)}` : ''}`),
  enqueue: (stage: FloorStage, productionInvoiceId: string) =>
    http.post<BeQueueEntry[]>('/floor/queue', { stage, productionInvoiceId }),
  reorder: (stage: FloorStage, entryIds: string[], workshopId?: string | null) =>
    http.post<BeQueueEntry[]>(`/floor/queue/${stage}/reorder`, { entryIds, workshopId: workshopId || undefined }),
  advance: (stage: FloorStage, workshopId?: string | null) =>
    http.post<BeQueueEntry[]>(`/floor/queue/${stage}/advance`, { workshopId: workshopId || undefined }),
  /** Hoàn tác "Chuyển PI tiếp" nhầm - mở lại PI vừa đóng, trả PI đang chạy (chưa ai báo) về đầu hàng đợi. */
  reopen: (stage: FloorStage, workshopId?: string | null) =>
    http.post<BeQueueEntry[]>(`/floor/queue/${stage}/reopen`, { workshopId: workshopId || undefined }),
  removeEntry: (id: string) => http.del<BeQueueEntry[]>(`/floor/queue/${id}`),

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
