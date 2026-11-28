/**
 * Giao nhận giữa tổ (24/11/2026, docs THIET-KE-GIAO-NHAN-GIUA-TO) - BE module `stage-handover`.
 *  - Thủ kho: GET /stage-handover/plan (kho đang làm) - kho Phôi giao đoạn cho Hàn / Sơn (kind SEGMENT), kho Hàn (xưởng có kho Sơn)
 *    giao mảnh đã hàn cho Sơn (kind FRAME). Lập phiếu bằng phiếu XK có sẵn (dòng SEGMENT_HANDOVER / FRAME_HANDOVER).
 *  - QLSX: GET /stage-handover/board (theo dõi), GET/POST /stage-handover/overrides (mở chặn có lý do).
 * Mọi trả lời có `enabled` (công tắc STAGE_HANDOVER_ENABLED của BE): false thì FE không hiện tab / cột mới.
 */
import { http } from './core/http'

export type HandoverKind = 'SEGMENT' | 'FRAME'
export type HandoverStage = 'HAN' | 'SON'
export type OverrideStage = 'PHOI' | HandoverStage

export interface HandoverWarehouse { id: string; code: string; name: string; kind: string }

/** 1 lệnh có hàng ở kho (danh sách chip). */
export interface HandoverPlanPi {
  productionInvoiceId: string
  code: string
  lenhCode: string
  inStockQty: number
  availableQty: number
  draftQty: number
}

export interface SegmentPlanStage {
  stage: HandoverStage
  requiredQty: number
  handedOverQty: number
  draftQty: number
}

/** 1 mã đoạn của lệnh ở kho Phôi. */
export interface SegmentPlanRow {
  segmentSpecId: string
  segmentSteps: string
  materialCode: string
  cutLengthMm: number
  stepsLabel: string
  label: string
  stages: SegmentPlanStage[]
  requiredQty: number
  /** Đoạn Phôi đạt KCS của lệnh đã vào kho Phôi. */
  passedQty: number
  handedOverQty: number
  draftQty: number
  ownHeldQty: number
  surplusQty: number
  inStockQty: number
  /** Giao được = còn giữ + dư − đang trên phiếu chờ ký. */
  availableQty: number
}

/** 1 (SKU, mảnh) của lệnh ở kho Hàn. */
export interface FramePlanRow {
  productionOrderId: string
  sku: string
  pieceId: string
  pieceCode: string
  pieceName: string
  requiredQty: number
  /** Mảnh Hàn đạt KCS đã ghi vào kho Hàn. */
  passedQty: number
  handedOverQty: number
  draftQty: number
  /** Tồn mảnh ở kho Hàn (theo mã mảnh, chung mọi lệnh). */
  inStockQty: number
  availableQty: number
  /** Đầu kỳ ngày bật (28/11/2026): khung chờ Sơn thủ kho Hàn đã nhập; null = chưa nhập. */
  openingWaitingQty?: number | null
}

export interface HandoverPlanList {
  enabled: boolean
  kind: HandoverKind
  warehouse: HandoverWarehouse
  pis: HandoverPlanPi[]
}

export interface HandoverPlanDetail<R> {
  enabled: boolean
  kind: HandoverKind
  warehouse: HandoverWarehouse
  productionInvoiceId: string
  code: string
  lenhCode: string
  rows: R[]
}

export function getHandoverPlanList(kind: HandoverKind): Promise<HandoverPlanList> {
  return http.get<HandoverPlanList>(`/stage-handover/plan?kind=${kind}`)
}

export function getSegmentPlan(productionInvoiceId: string): Promise<HandoverPlanDetail<SegmentPlanRow>> {
  return http.get<HandoverPlanDetail<SegmentPlanRow>>(
    `/stage-handover/plan?kind=SEGMENT&productionInvoiceId=${encodeURIComponent(productionInvoiceId)}`,
  )
}

export function getFramePlan(productionInvoiceId: string): Promise<HandoverPlanDetail<FramePlanRow>> {
  return http.get<HandoverPlanDetail<FramePlanRow>>(
    `/stage-handover/plan?kind=FRAME&productionInvoiceId=${encodeURIComponent(productionInvoiceId)}`,
  )
}

// ─── QLSX ──────────────────────────────────────────────────────────────────────

export interface HandoverBoardPi {
  productionInvoiceId: string
  code: string
  lenhCode: string
  blockedPieceCount: number
  /** Đoạn Phôi đạt KCS còn ở kho Phôi chờ giao. */
  awaitingHandoverQty: number
  /** Đã giao chưa làm (Hàn + Sơn). */
  handedNotUsedQty: number
  steelBlocked: boolean
}

export interface HandoverBoardList { enabled: boolean; pis: HandoverBoardPi[] }

export interface BoardPhoiSegment {
  segmentSpecId: string
  segmentSteps: string
  label: string
  requiredQty: number
  passedQty: number
  inKhoPhoiQty: number
  handedOverQty: number
  draftQty: number
}

export interface BoardSteel {
  materialId: string
  materialCode: string
  receivedBarCount: number
  usableMm: number
  reportedMm: number
  overrideMm: number
  limitMm: number
  blocked: boolean
}

export interface BoardStagePiece {
  productionOrderId: string
  sku: string
  pieceId: string
  pieceCode: string
  pieceName: string
  mode: 'SEGMENT' | 'FRAME' | null
  plannedQty: number
  reportedQty: number
  maxNow: number
  receivedQty: number | null
  usedQty: number | null
  receivedLeft: number | null
  overrideQty: number
  effectiveMaxNow: number
  blocked: boolean
}

export interface BoardPoolRow {
  segmentSpecId: string
  segmentSteps: string
  label: string
  receivedQty: number
  overrideQty: number
  usedQty: number
  /** Đã giao chưa làm (âm = làm vượt số đã nhận). */
  leftQty: number
  inStageWarehouseQty: number
}

export interface BoardStage {
  stage: HandoverStage
  warehouseCode: string | null
  pieces: BoardStagePiece[]
  pool: BoardPoolRow[]
}

export interface HandoverOverride {
  id: string
  productionInvoiceId: string
  productionOrderId: string | null
  stage: OverrideStage
  pieceId: string | null
  materialId: string | null
  qty: number
  unit: string
  reason: string
  createdById: string
  createdAt: string
  createdByName?: string | null
  pieceCode?: string | null
  pieceName?: string | null
  materialCode?: string | null
  /** OVERRIDE = QLSX mở chặn; OPENING_DONE / OPENING_WAITING = đầu kỳ ngày bật (28/11/2026). */
  kind?: HandoverOverrideKind
}

export type HandoverOverrideKind = 'OVERRIDE' | 'OPENING_DONE' | 'OPENING_WAITING'

/** Đầu kỳ ngày bật giao nhận (câu 2, chốt 28/11/2026 cách 1). */
export interface HandoverOpening {
  enabled: boolean
  done: boolean
  doneAt: string | null
  doneByName: string | null
  doneCount: number
  waitingCount: number
}

export function getHandoverOpening(): Promise<HandoverOpening> {
  return http.get<HandoverOpening>('/stage-handover/opening')
}

/** QLSX bấm 1 lần ngay sau khi bật: số đã báo Hàn / Sơn trước ngày bật thành "đã nhận đầu kỳ". */
export function createHandoverOpeningDone(): Promise<{ created: number; lenh: number }> {
  return http.post<{ created: number; lenh: number }>('/stage-handover/opening/done')
}

export interface OpeningWaitingRow {
  productionInvoiceId: string | null
  lenhCode: string
  productionOrderId: string
  sku: string
  pieceId: string
  pieceCode: string
  pieceName: string
  hanReportedQty: number
  hanPassedQty: number
  sonReportedQty: number
  /** Gợi ý = Hàn đạt KCS − Sơn đã báo (thủ kho vẫn đếm thật). */
  suggestedQty: number
  openingWaitingQty: number | null
}

export interface OpeningWaitingPlan {
  enabled: boolean
  /** false = kho đang làm không phải kho Hàn của xưởng có kho Sơn - không có bước này. */
  applicable: boolean
  warehouseCode?: string
  rows: OpeningWaitingRow[]
}

export function getOpeningWaitingPlan(): Promise<OpeningWaitingPlan> {
  return http.get<OpeningWaitingPlan>('/stage-handover/opening/waiting-plan')
}

/** Thủ kho Hàn nhập số khung Hàn đạt đang chờ ở tổ Sơn - mỗi SKU, mảnh 1 lần. */
export function createOpeningWaiting(input: { productionOrderId: string; pieceId: string; qty: number }): Promise<HandoverOverride> {
  return http.post<HandoverOverride>('/stage-handover/opening/waiting', input)
}

export interface HandoverBoardDetail {
  enabled: boolean
  productionInvoiceId: string
  code: string
  lenhCode: string
  phoi: { warehouseCode: string; segments: BoardPhoiSegment[]; steel: BoardSteel[] }
  stages: BoardStage[]
  overrides: HandoverOverride[]
}

export function getHandoverBoard(): Promise<HandoverBoardList> {
  return http.get<HandoverBoardList>('/stage-handover/board')
}

export function getHandoverBoardDetail(productionInvoiceId: string): Promise<HandoverBoardDetail> {
  return http.get<HandoverBoardDetail>(`/stage-handover/board?productionInvoiceId=${encodeURIComponent(productionInvoiceId)}`)
}

export function getHandoverOverrides(productionInvoiceId: string): Promise<HandoverOverride[]> {
  return http.get<HandoverOverride[]>(`/stage-handover/overrides?productionInvoiceId=${encodeURIComponent(productionInvoiceId)}`)
}

export interface CreateHandoverOverrideInput {
  productionInvoiceId: string
  stage: OverrideStage
  /** HAN / SON */
  productionOrderId?: string
  pieceId?: string
  /** PHOI */
  materialId?: string
  /** HAN / SON: số mảnh (nguyên). PHOI: số mm. */
  qty: number
  reason: string
}

export function createHandoverOverride(input: CreateHandoverOverrideInput): Promise<HandoverOverride> {
  return http.post<HandoverOverride>('/stage-handover/overrides', input)
}
