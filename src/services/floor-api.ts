/**
 * Adapter màn quét QR tại máy (2026-10-13) - BE `src/modules/floor` (changelog BE
 * changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 22-23). Mã QR dán ở máy là link
 * `/floor?ws=<qrToken>`; PI KHÔNG nằm trong mã - BE tự lấy PI đang chạy của tổ.
 */
import { http } from './core/http'

export type FloorStage = 'PHOI' | 'HAN' | 'SON'
export type WorkstationKind = 'CUT' | 'STEP' | 'PIECE' | 'STEEL_RECEIVE'

export interface BeWorkstationBrief {
  id: string
  code: string
  name: string
  stage: FloorStage
  kind: WorkstationKind
  processStep: string | null
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
export type StatOp = 'CAT' | 'UON' | 'DAP' | 'DUC_LO' | 'TAN' | 'TOP_DAU' | 'XE' | 'PHOI' | 'HAN' | 'SON'
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
}

export interface CreateWorkstationInput {
  code: string
  name: string
  stage: FloorStage
  kind: WorkstationKind
  processStep?: string
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
  progress: { required: number; reported: number; percent: number; complete: boolean } | null
  /** Chỉ true ở dòng DONE đóng gần nhất của tổ và "Mở lại" làm được (PI đang chạy chưa có lần báo nào). */
  canReopen: boolean
}

export interface BeQueueCandidate {
  productionInvoiceId: string
  code: string
  deadline: string | null
  orderCount: number
  activeOrderCount: number
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

  queue: (stage?: FloorStage) => http.get<BeQueueEntry[]>(`/floor/queue${stage ? `?stage=${stage}` : ''}`),
  queueCandidates: (stage: FloorStage) => http.get<BeQueueCandidate[]>(`/floor/queue/candidates?stage=${stage}`),
  enqueue: (stage: FloorStage, productionInvoiceId: string) =>
    http.post<BeQueueEntry[]>('/floor/queue', { stage, productionInvoiceId }),
  reorder: (stage: FloorStage, entryIds: string[]) => http.post<BeQueueEntry[]>(`/floor/queue/${stage}/reorder`, { entryIds }),
  advance: (stage: FloorStage) => http.post<BeQueueEntry[]>(`/floor/queue/${stage}/advance`),
  /** Hoàn tác "Chuyển PI tiếp" nhầm - mở lại PI vừa đóng, trả PI đang chạy (chưa ai báo) về đầu hàng đợi. */
  reopen: (stage: FloorStage) => http.post<BeQueueEntry[]>(`/floor/queue/${stage}/reopen`),
  removeEntry: (id: string) => http.del<BeQueueEntry[]>(`/floor/queue/${id}`),

  workstations: () => http.get<BeWorkstation[]>('/floor/workstations'),
  createWorkstation: (d: CreateWorkstationInput) => http.post<BeWorkstation>('/floor/workstations', d),
  updateWorkstation: (id: string, d: { name?: string; isActive?: boolean }) =>
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
}
