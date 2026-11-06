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
  /** Trong số bị từ chối, bao nhiêu yêu cầu là yêu cầu bị chặn (lệnh đã cắt phôi / Kết thúc / huỷ). */
  rejectBlockedCount: number
  /** Có ít nhất 1 yêu cầu bị từ chối -> bắt buộc lý do. */
  needsReason: boolean
  /** Lý do điền sẵn khi MỌI yêu cầu bị từ chối đều là yêu cầu bị chặn; '' nếu không có gợi ý. */
  suggestedReason: string
}

/** Phần A – Đợt 9 phần 2 (Q9-3): yêu cầu CHỜ mà BE báo Sếp không duyệt được (lệnh đã bắt đầu cắt phôi / Kết thúc / huỷ), chỉ từ chối được. BE cũ chưa trả blockedReason -> coi như không chặn. */
export function isBlocked(r: DeadlineChangeRequestDto): boolean {
  return r.status === 'PENDING' && !!r.blockedReason && r.blockedReason.trim().length > 0
}

/** Yêu cầu chờ mà Sếp duyệt được (không bị chặn). */
export function approvablePending(batch: DeadlineChangeBatchDto): DeadlineChangeRequestDto[] {
  return pendingRequests(batch).filter(r => !isBlocked(r))
}

/** Lô còn ít nhất 1 yêu cầu duyệt được không. */
export function canApproveAny(batch: DeadlineChangeBatchDto): boolean {
  return approvablePending(batch).length > 0
}

/** Lựa chọn mặc định khi mở lô: mọi yêu cầu chờ trừ yêu cầu bị chặn. */
export function defaultSelection(batch: DeadlineChangeBatchDto): Set<string> {
  return new Set(approvablePending(batch).map(r => r.id))
}

/** Lý do điền sẵn khi mọi yêu cầu sẽ bị từ chối đều là yêu cầu bị chặn. */
export const BLOCKED_REJECT_REASON = 'Lệnh đã bắt đầu sản xuất (cắt phôi)'

function buildPlan(pending: DeadlineChangeRequestDto[], approveIds: string[]): DecisionPlan {
  const ids = new Set(approveIds)
  const rejected = pending.filter(r => !ids.has(r.id))
  const blocked = rejected.filter(isBlocked).length
  return {
    approveRequestIds: approveIds,
    approveCount: approveIds.length,
    rejectCount: rejected.length,
    rejectBlockedCount: blocked,
    needsReason: rejected.length > 0,
    suggestedReason: rejected.length > 0 && blocked === rejected.length ? BLOCKED_REJECT_REASON : '',
  }
}

/** Kế hoạch khi bấm "Duyệt": yêu cầu được chọn -> duyệt, yêu cầu chờ không chọn -> từ chối. Yêu cầu bị chặn LUÔN bị từ chối (kể cả lỡ nằm trong `selected`). `partial=false`: duyệt hết yêu cầu duyệt được. */
export function planApprove(batch: DeadlineChangeBatchDto, selected: ReadonlySet<string>, partial: boolean): DecisionPlan {
  const pending = pendingRequests(batch)
  const ok = pending.filter(r => !isBlocked(r))
  const ids = (partial ? ok.filter(r => selected.has(r.id)) : ok).map(r => r.id)
  return buildPlan(pending, ids)
}

/** Kế hoạch khi bấm "Từ chối…": từ chối cả lô. */
export function planRejectAll(batch: DeadlineChangeBatchDto): DecisionPlan {
  return buildPlan(pendingRequests(batch), [])
}

/** " (1 yêu cầu của lệnh đã bắt đầu sản xuất, không duyệt được)" hoặc chuỗi rỗng. */
function blockedNote(plan: DecisionPlan): string {
  return plan.rejectBlockedCount > 0 ? ` (${plan.rejectBlockedCount} yêu cầu của lệnh đã bắt đầu sản xuất, không duyệt được)` : ''
}

/** Mô tả trong hộp nhập lý do. */
export function reasonDescription(plan: DecisionPlan): string {
  const hint = `Nhập lý do để Kế hoạch SX biết (ít nhất ${MIN_REASON_LENGTH} ký tự).`
  if (plan.approveCount === 0) return `Cả lô giữ mốc cũ, xưởng chạy như trước. ${hint}`
  const unchecked = plan.rejectCount - plan.rejectBlockedCount
  const who = plan.rejectBlockedCount > 0 && unchecked > 0 ? 'yêu cầu bỏ chọn và yêu cầu không duyệt được'
    : plan.rejectBlockedCount > 0 ? 'yêu cầu không duyệt được (lệnh đã bắt đầu cắt phôi)' : 'yêu cầu bỏ chọn'
  return `${plan.rejectCount} ${who} sẽ bị từ chối và giữ mốc cũ. ${hint}`
}

export function reasonValid(reason: string): boolean {
  return reason.trim().length >= MIN_REASON_LENGTH
}

/** Câu kết quả sau khi quyết xong. */
export function resultMessage(plan: DecisionPlan): string {
  if (plan.approveCount > 0 && plan.rejectCount > 0) return `Đã duyệt ${plan.approveCount} yêu cầu, từ chối ${plan.rejectCount} yêu cầu${blockedNote(plan)}.`
  if (plan.approveCount > 0) return `Đã duyệt ${plan.approveCount} yêu cầu. Mốc mới có hiệu lực, Mua hàng, QLSX và Kho sẽ được báo.`
  return `Đã từ chối ${plan.rejectCount} yêu cầu${blockedNote(plan)}. Giữ mốc cũ, Kế hoạch SX nhận được lý do.`
}

/** Câu xác nhận ngắn trước khi duyệt. */
export function confirmApproveText(plan: DecisionPlan): string {
  return plan.rejectCount > 0
    ? `Duyệt ${plan.approveCount} yêu cầu, từ chối ${plan.rejectCount} yêu cầu${blockedNote(plan)}?`
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
