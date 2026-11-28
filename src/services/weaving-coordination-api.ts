/**
 * Điều phối đan (25/11/2026, docs THIET-KE-DIEU-PHOI-DAN, Đ1-Đ3) - BE module `weaving-coordination`. HỢP ĐỒNG với BE
 * src/modules/weaving-coordination/*.ts - đổi 2 bên cùng lúc.
 *  - GET  /weaving-coordination/config      công tắc DIEU_PHOI_DAN_ENABLED (mọi tài khoản đăng nhập).
 *  - GET  /weaving-coordination/board       bảng theo dõi điểm đan × lệnh × mảnh (chỉ xem) + ô tổng.
 *  - GET  /weaving-coordination/follow-ups  lịch sử ghi chú (theo điểm đan / đúng 1 dòng).
 *  - POST /weaving-coordination/follow-ups  ghi chú + lời hẹn trả (chỉ Điều phối đan / Admin).
 * Đọc có `enabled`: false thì FE không hiện màn mới. Danh sách điểm đan vẫn ở weaving-points-api.ts.
 */
import { http } from './core/http'

export type WeavingRowStatus = 'LATE' | 'DUE_SOON' | 'ON_TRACK' | 'NO_DEADLINE' | 'DONE'
export type WeavingPromiseStatus = 'NONE' | 'OPEN' | 'REMINDED' | 'KEPT' | 'SUPERSEDED'

export interface WeavingPromise {
  followUpId: string
  promisedQty: number
  /** 'YYYY-MM-DD' */
  promisedDate: string
  status: WeavingPromiseStatus
  /** Số đã về thêm kể từ lúc hẹn. */
  returnedSince: number
  createdAt: string
}

export interface WeavingBoardRow {
  key: string
  /** Câu 17 (28/11/2026): lệnh đã huỷ mà điểm đan còn giữ hàng (đã trả hết thì BE ẩn dòng). */
  cancelled?: boolean
  weavingPointId: string
  weavingPointCode: string
  weavingPointName: string
  productionOrderId: string
  poNumber: string
  salesOrderCode: string | null
  lsxCode: string | null
  piCode: string | null
  productName: string | null
  pieceId: string
  pieceCode: string
  pieceName: string
  sent: number
  returned: number
  held: number
  /** Mốc "Nhập đan" ('YYYY-MM-DD'), null = chưa đặt. */
  dueDate: string | null
  daysLeft: number | null
  status: WeavingRowStatus
  lastIssuedAt: string | null
  lastReceivedAt: string | null
  latestPromise: WeavingPromise | null
  followUpCount: number
}

export interface WeavingBoardPoint {
  id: string
  code: string
  name: string
  contactPerson: string | null
  phone: string | null
  isActive: boolean
  held: number
  openRows: number
  lateRows: number
}

export interface WeavingBoard {
  enabled: boolean
  today: string
  tiles: { piecesOut: number; openRows: number; overdueRows: number; promisesDueToday: number }
  points: WeavingBoardPoint[]
  rows: WeavingBoardRow[]
}

export interface WeavingFollowUp {
  id: string
  weavingPointId: string
  productionOrderId: string
  pieceId: string
  poNumber: string
  pieceName: string
  content: string
  promisedQty: number | null
  promisedDate: string | null
  promiseStatus: WeavingPromiseStatus
  heldAtCreate: number
  returnedAtCreate: number
  remindedAt: string | null
  closedAt: string | null
  createdById: string
  createdByName: string
  createdAt: string
}

export interface CreateWeavingFollowUpInput {
  weavingPointId: string
  productionOrderId: string
  pieceId: string
  content: string
  promisedQty?: number
  promisedDate?: string
}

const qs = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const getDieuPhoiDanConfig = () => http.get<{ enabled: boolean }>('/weaving-coordination/config')

export const getWeavingBoard = (filter: { weavingPointId?: string; status?: WeavingRowStatus } = {}) =>
  http.get<WeavingBoard>(`/weaving-coordination/board${qs(filter)}`)

export const getWeavingFollowUps = (filter: { weavingPointId?: string; productionOrderId?: string; pieceId?: string }) =>
  http.get<{ enabled: boolean; items: WeavingFollowUp[] }>(`/weaving-coordination/follow-ups${qs(filter)}`)

export const createWeavingFollowUp = (input: CreateWeavingFollowUpInput) =>
  http.post<WeavingFollowUp>('/weaving-coordination/follow-ups', input)
