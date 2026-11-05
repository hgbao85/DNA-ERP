/**
 * Phần A – Đợt 3 (YC10): adapter năng lực 1,3 cont/ngày - FE ⇄ BE module `production-capacity`. HỢP ĐỒNG với BE
 * `src/modules/production-capacity/production-capacity.types.ts` - đổi 2 bên cùng lúc. Năng lực chỉ để CẢNH BÁO, không khoá.
 * Ngày luôn là 'YYYY-MM-DD' (ngày VN).
 */
import { http } from './core/http'

export type CapacityStage = 'PHOI' | 'HAN' | 'SON' | 'NHAP_DAN' | 'CHUYEN_KIEM' | 'DONG_GOI'
export type CapacityGroupKind = 'WORKSHOP' | 'WAREHOUSE'
export type CapacityMode = 'CONT_PER_DAY' | 'DAYS_PER_CONT'

export interface CapacityOrderLoad {
  itemId: string
  piId: string
  /** Mã lệnh hiển thị (số LSX, chưa có thì mã PI). */
  displayCode: string
  skuCode: string
  /** Cont của lệnh trong đúng ngày này. */
  cont: number
  /** Khoảng ngày của công đoạn. */
  from: string
  to: string
}

export interface CapacityDayCell {
  day: string
  cont: number
  orders: CapacityOrderLoad[]
  /** CONT_PER_DAY: vượt năng lực; DAYS_PER_CONT: từ 2 lệnh cùng chiếm ngày. */
  over: boolean
}

/** 1 nhóm (xưởng/kho) × 1 công đoạn, đủ mọi ngày trong [from, to]. */
export interface CapacityRow {
  groupKind: CapacityGroupKind
  groupCode: string
  groupName: string
  stage: CapacityStage
  stageLabel: string
  mode: CapacityMode
  /** Trần cont/ngày; null với xưởng DAYS_PER_CONT (kiểm chồng lệnh). */
  capacity: number | null
  days: CapacityDayCell[]
}

export interface CapacityWarning {
  groupKind: CapacityGroupKind
  groupCode: string
  groupName: string
  stage: CapacityStage
  stageLabel: string
  day: string
  cont: number
  capacity: number | null
  itemIds: string[]
  message: string
}

export interface CapacityMissingLoadCont {
  itemId: string
  displayCode: string
  skuCode: string
}

export interface CapacityBoard {
  from: string
  to: string
  capacityContPerDay: number
  daysPerContPhuocAn: number
  rows: CapacityRow[]
  warnings: CapacityWarning[]
  missingLoadCont: CapacityMissingLoadCont[]
}

export type CapacityCheckStageKey =
  | 'PHOI_START'
  | 'FRAME_PHOI'
  | 'FRAME_HAN'
  | 'FRAME_SON'
  | 'WEAVING'
  | 'TRANSFER_CHECK'
  | 'PACKAGING_START'
  | 'PACKAGING'

export interface CapacityCheckItemInput {
  itemId: string
  /** Xưởng đang chọn (hộp QLSX); bỏ trống = xưởng đã lưu; dòng chưa có xưởng thì BE không xét Phôi/Hàn/Sơn. */
  workshopId?: string | null
  /** Kho đóng gói đang chọn; bỏ trống = kho đã lưu. */
  warehouseCode?: string | null
  /** Mốc đang sửa 'YYYY-MM-DD'; thiếu khoá nào thì BE dùng ngày đã lưu. */
  stages?: Partial<Record<CapacityCheckStageKey, string>>
}

export interface CapacityCheckResult {
  warnings: CapacityWarning[]
  missingLoadCont: CapacityMissingLoadCont[]
}

/** Bảng năng lực [from, to] (mặc định BE: hôm nay + 13 ngày). */
export async function getCapacityBoard(from?: string, to?: string): Promise<CapacityBoard> {
  const params: Record<string, string> = {}
  if (from) params.from = from
  if (to) params.to = to
  return http.get<CapacityBoard>('/production-capacity', { params })
}

/** Thử mốc / xưởng-kho đang chọn (chưa lưu) - chỉ trả cảnh báo dính tới các dòng gửi lên. */
export async function checkCapacity(items: CapacityCheckItemInput[]): Promise<CapacityCheckResult> {
  return http.post<CapacityCheckResult>('/production-capacity/check', { items })
}
