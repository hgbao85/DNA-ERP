// Phần A – Đợt 9 (YC2): hàm thuần cho màn Sếp duyệt đổi mốc lệnh SX (DuyetDoiMocPage). Không gọi API, không đụng React.
import type { DeadlineChangeBatchDto, DeadlineChangeRequestDto, DeadlineFieldChange } from '../../../services/deadline-changes-api'

/** Lý do từ chối tối thiểu (ký tự, sau khi cắt khoảng trắng). */
export const MIN_REASON_LENGTH = 3

/** 'YYYY-MM-DD' (hoặc ISO có giờ) -> 'dd/mm'; null/rỗng -> 'chưa có'. */
export function fmtDay(v: string | null | undefined): string {
  if (!v) return 'chưa có'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  return m ? `${m[3]}/${m[2]}` : v
}

/** "Phôi 10/11 → 13/11". */
export function changeText(c: DeadlineFieldChange): string {
  return `${c.label} ${fmtDay(c.from)} → ${fmtDay(c.to)}`
}

/** ISO -> 'dd/mm/yyyy HH:mm' theo giờ Việt Nam (UTC+7, không phụ thuộc múi giờ máy). */
export function fmtDateTimeVN(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  const d = new Date(t + 7 * 3600 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

export function sourceLabel(source: DeadlineChangeBatchDto['source']): string {
  return source === 'EXCEL' ? 'Excel' : 'Sửa tay'
}

/** Cũ nhất trước (theo lúc gửi); không đổi mảng gốc. */
export function sortOldestFirst(batches: DeadlineChangeBatchDto[]): DeadlineChangeBatchDto[] {
  return [...batches].sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime())
}

/** Các yêu cầu còn chờ của lô (chỉ những yêu cầu này quyết được). */
export function pendingRequests(batch: DeadlineChangeBatchDto): DeadlineChangeRequestDto[] {
  return batch.requests.filter(r => r.status === 'PENDING')
}

/** Số SKU khác nhau trong lô (đếm theo dòng SKU). */
export function skuCount(batch: DeadlineChangeBatchDto): number {
  return new Set(batch.requests.map(r => r.itemId)).size
}

export interface DecisionPlan {
  approveRequestIds: string[]
  approveCount: number
  rejectCount: number
  /** Có ít nhất 1 yêu cầu bị từ chối -> bắt buộc lý do. */
  needsReason: boolean
}

/** Kế hoạch khi bấm "Duyệt": yêu cầu được chọn -> duyệt, yêu cầu chờ không chọn -> từ chối. `partial=false`: luôn duyệt hết. */
export function planApprove(batch: DeadlineChangeBatchDto, selected: ReadonlySet<string>, partial: boolean): DecisionPlan {
  const pending = pendingRequests(batch)
  const ids = partial ? pending.filter(r => selected.has(r.id)).map(r => r.id) : pending.map(r => r.id)
  return { approveRequestIds: ids, approveCount: ids.length, rejectCount: pending.length - ids.length, needsReason: pending.length - ids.length > 0 }
}

/** Kế hoạch khi bấm "Từ chối…": từ chối cả lô. */
export function planRejectAll(batch: DeadlineChangeBatchDto): DecisionPlan {
  const n = pendingRequests(batch).length
  return { approveRequestIds: [], approveCount: 0, rejectCount: n, needsReason: true }
}

export function reasonValid(reason: string): boolean {
  return reason.trim().length >= MIN_REASON_LENGTH
}

/** Câu kết quả sau khi quyết xong. */
export function resultMessage(plan: DecisionPlan): string {
  if (plan.approveCount > 0 && plan.rejectCount > 0) return `Đã duyệt ${plan.approveCount} yêu cầu, từ chối ${plan.rejectCount} yêu cầu.`
  if (plan.approveCount > 0) return `Đã duyệt ${plan.approveCount} yêu cầu. Mốc mới có hiệu lực, Mua hàng, QLSX và Kho sẽ được báo.`
  return `Đã từ chối ${plan.rejectCount} yêu cầu. Giữ mốc cũ, Kế hoạch SX nhận được lý do.`
}

/** Câu xác nhận ngắn trước khi duyệt. */
export function confirmApproveText(plan: DecisionPlan): string {
  return plan.rejectCount > 0
    ? `Duyệt ${plan.approveCount} yêu cầu và từ chối ${plan.rejectCount} yêu cầu bỏ chọn?`
    : `Duyệt ${plan.approveCount} yêu cầu đổi mốc? Mốc mới có hiệu lực ngay và Mua hàng, QLSX, Kho sẽ được báo.`
}

export function statusText(s: DeadlineChangeRequestDto['status']): string {
  switch (s) {
    case 'APPROVED': return 'Đã duyệt'
    case 'REJECTED': return 'Từ chối'
    case 'CANCELLED': return 'KHSX đã huỷ'
    default: return 'Chờ duyệt'
  }
}
