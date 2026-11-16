/**
 * Luật thuần cho việc đổi xưởng cơ khí của lệnh (16/11/2026): CHỈ KHSX (và Admin xử lý sự cố) đổi xưởng; QLSX không đổi.
 * Dùng chung ở "Lệnh sản xuất mới" (LenhSXPage) và "Tổng hợp lệnh SX" (ThongKePagePlan). BE vẫn là nơi chặn thật (403 / 409).
 */

interface UserLike {
  role?: string | null
  isProductPlanner?: boolean | null
}

/** KHSX hoặc Admin mới thấy nút đổi xưởng. */
export function canChangeWorkshop(user: UserLike | null | undefined): boolean {
  return !!user && (user.role === 'ADMIN' || user.isProductPlanner === true)
}

/** Trạng thái duyệt mà lệnh còn đổi xưởng được (mọi SKU phải thuộc nhóm này). */
const CHANGEABLE_STATUSES = ['WAITING_QLSX', 'WAITING_BOSS', 'APPROVED']

/**
 * - `none`: không hiện gì (có SKU chưa gửi / bị từ chối / chưa có SKU).
 * - `blocked`: đổi được về trạng thái nhưng lệnh đã xuất sắt / vật tư -> hiện chữ WORKSHOP_LOCKED_TEXT.
 * - `allowed`: hiện nút "Đổi xưởng".
 */
export type WorkshopChangeAction = 'none' | 'blocked' | 'allowed'

// Cờ hasMaterialIssue gộp cả sắt lẫn vật tư định mức (BE 409 nói đúng loại) - chữ nêu cả hai để không ghi sai lý do.
export const WORKSHOP_LOCKED_TEXT = 'Đã xuất sắt / vật tư — không đổi xưởng được'

export function workshopChangeAction(
  statuses: (string | null | undefined)[],
  hasMaterialIssue: boolean | null | undefined,
): WorkshopChangeAction {
  if (statuses.length === 0) return 'none'
  if (!statuses.every((s) => !!s && CHANGEABLE_STATUSES.includes(s))) return 'none'
  return hasMaterialIssue ? 'blocked' : 'allowed'
}

/** Lấy trạng thái duyệt của các SKU trong lệnh (dạng `items[].prodApproval.status`). */
export function itemApprovalStatuses(items: { prodApproval?: { status?: string | null } | null }[] | null | undefined): (string | null)[] {
  return (items ?? []).map((it) => it.prodApproval?.status ?? null)
}

export interface PendingMoveLike {
  id: string
  code: string
  fromWarehouseName: string
  toWarehouseName: string
}

export const PENDING_MOVES_MAX_ROWS = 5

/** Dữ liệu khung cảnh báo phiếu chuyển chưa nhận: tiêu đề, tối đa 5 dòng, phần còn lại gộp "và N phiếu khác". */
export function buildPendingMovesWarning(moves: PendingMoveLike[]) {
  const shown = moves.slice(0, PENDING_MOVES_MAX_ROWS).map((m) => ({
    id: m.id,
    code: m.code,
    route: `${m.fromWarehouseName} → ${m.toWarehouseName}`,
  }))
  const rest = moves.length - shown.length
  return {
    title: `Lệnh còn ${moves.length} phiếu chuyển hàng chưa nhận`,
    rows: shown,
    moreText: rest > 0 ? `và ${rest} phiếu khác` : null,
  }
}
