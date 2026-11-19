/**
 * Topic realtime làm thay đổi số việc chờ (badge menu) - tách khỏi useWorkQueue.ts để test được (hàm thuần).
 *
 * P1 (18/11/2026): KCS tự thấy đợt công nhân vừa báo, nên số đỏ "KCS Phôi / Hàn / Sơn" đổi theo sự kiện 'floor'
 * (mỗi lần công nhân Lưu / QLSX Hủy). Phòng 'floor' chỉ KCS và QLSX được nối; QLSX đã có /floor/summary riêng
 * nên KHÔNG nghe thêm 'floor' ở đây (tránh gọi /me/work-queue mỗi lần công nhân báo, AC4).
 */
export const WORK_QUEUE_TOPICS = [
  'warehouse-transfers',
  'purchase-proposals',
  'steel-issues',
  'production-batches',
  'qc-reviews',
  'stock',
  'skus',
  'production-invoices',
  'cutting-proposals',
  'sales-orders',
  'packaging-issues',
  'production-orders',
] as const

export const KCS_WORK_QUEUE_TOPICS = [...WORK_QUEUE_TOPICS, 'floor'] as const

/** Gom các sự kiện dồn dập (công nhân báo liên tục) thành 1 lần tải lại số đỏ. */
export const WORK_QUEUE_DEBOUNCE_MS = 3000

export function isKcsAccount(p: { mfgRole?: string | null; roles?: readonly string[] | null }): boolean {
  return p.mfgRole === 'KCS' || (p.roles ?? []).includes('KCS_STAFF')
}

/** KCS (mfgRole 'KCS' hoặc có vai KCS_STAFF) nghe thêm 'floor'; mọi vai khác giữ danh sách cũ. */
export function workQueueTopics(p: { mfgRole?: string | null; roles?: readonly string[] | null }): readonly string[] {
  return isKcsAccount(p) ? KCS_WORK_QUEUE_TOPICS : WORK_QUEUE_TOPICS
}
