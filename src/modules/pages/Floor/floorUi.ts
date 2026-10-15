/**
 * Phần logic thuần của màn quét công nhân (tách khỏi FloorScanApp để kiểm thử): phân loại lỗi và kết luận
 * khi nhận sắt. Giai đoạn 1 cải thiện UX (changelog BE docs/changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 31-32).
 */

import { ApiError } from '../../../services/core/apiError'
import type { BeMyOutputRow } from '../../../services/floor-api'

export interface ErrorInfo {
  /** `warn` = chưa gửi được vì mạng (số còn nguyên, gửi lại được); `err` = máy chủ từ chối / lỗi khác. */
  tone: 'warn' | 'err'
  text: string
  /** Không có phản hồi từ máy chủ (mất mạng, quá thời gian chờ). */
  offline: boolean
}

/**
 * Phân loại lỗi để công nhân biết phải làm gì: MẤT MẠNG thì số vẫn còn, có mạng bấm lại (BE chống cộng 2 lần nhờ
 * Idempotency-Key); MÁY CHỦ TỪ CHỐI thì đọc lý do (đã là tiếng Việt từ BE) rồi sửa. `withNumbers` = đang
 * gửi số công nhân vừa nhập (nhắc "số còn nguyên"), không đúng với đăng nhập/tải dữ liệu.
 */
export function describeError(e: unknown, withNumbers = false): ErrorInfo {
  if (e instanceof ApiError) {
    if (e.statusCode === 0) {
      return {
        tone: 'warn',
        offline: true,
        text: withNumbers
          ? 'Chưa gửi được vì mất kết nối. Số bạn nhập vẫn còn nguyên - có mạng thì bấm lưu lại, sẽ không bị cộng 2 lần.'
          : 'Mất kết nối - kiểm tra mạng rồi thử lại.',
      }
    }
    if (e.statusCode === 429) {
      return { tone: 'err', offline: false, text: 'Bạn thao tác quá nhanh - đợi khoảng 1 phút rồi thử lại.' }
    }
    return { tone: 'err', offline: false, text: e.message }
  }
  return { tone: 'err', offline: false, text: 'Có lỗi, thử lại' }
}

export type ReceiveVerdict =
  | { kind: 'empty' }
  | { kind: 'exact'; diff: 0 }
  | { kind: 'short' | 'over'; diff: number }

/** So số cây công nhân đếm với số kho xuất: `empty` chưa nhập; `exact` đủ; `short`/`over` lệch (diff = đếm − xuất). */
export function receiveVerdict(countText: string, issued: number): ReceiveVerdict {
  if (countText.trim() === '') return { kind: 'empty' }
  const diff = Number(countText) - issued
  if (diff === 0) return { kind: 'exact', diff: 0 }
  return { kind: diff < 0 ? 'short' : 'over', diff }
}

/**
 * Số VƯỢT kế hoạch nếu báo thêm `add` khi đã làm `done` trên số cần `required` (0 = chưa vượt). Dùng ở bảng xác nhận
 * trước khi lưu để công nhân đếm lại số quá tay (gõ thừa số 0...). QLSX vẫn thấy cảnh báo vượt ở màn kiểm.
 */
export function overBy(required: number, done: number, add: number): number {
  return Math.max(0, done + add - required)
}

// ─── "Sản lượng của tôi": khoảng thời gian + cộng theo ngày ──────────────────

export type OutputRange = '7d' | 'month' | 'lastMonth'

export const RANGE_LABEL: Record<OutputRange, string> = { '7d': '7 ngày qua', month: 'Tháng này', lastMonth: 'Tháng trước' }

/**
 * Khoảng thời gian (giờ máy công nhân = giờ VN) cho "Sản lượng của tôi". "7 ngày qua" tính theo NGÀY LỊCH (từ đầu ngày
 * cách đây 6 ngày) để không cắt đôi một ngày làm việc; tháng này đến bây giờ; tháng trước trọn tháng.
 */
export function rangeBounds(range: OutputRange, now: Date = new Date()): { from: Date; to: Date; label: string } {
  if (range === '7d') {
    return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), to: now, label: '7 ngày qua' }
  }
  const first = new Date(now.getFullYear(), now.getMonth() - (range === 'lastMonth' ? 1 : 0), 1)
  const to = range === 'month' ? now : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, -1)
  return { from: first, to, label: `tháng ${first.getMonth() + 1}/${first.getFullYear()}` }
}

/** yyyy-mm-dd theo giờ máy - khoá gom các lần báo cùng ngày. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface OutputTotal {
  /** CAT / UON / DAP / ... (công đoạn trên đoạn sắt) hoặc PIECE (mảnh Hàn/Sơn). */
  op: string
  qty: number
}

const OP_ORDER = ['CAT', 'UON', 'DAP', 'DUC_LO', 'TAN', 'TOP_DAU', 'XE', 'STEP', 'PIECE']

/**
 * Cộng số đã báo theo LOẠI VIỆC, bỏ lần báo đã bị QLSX đảo. KHÔNG cộng chung Cắt với Uốn... (cùng 1 đoạn đi qua nhiều
 * công đoạn, cộng lại là đếm đôi) và không trộn đoạn với mảnh.
 */
export function outputTotals(rows: BeMyOutputRow[]): OutputTotal[] {
  const sum = new Map<string, number>()
  for (const r of rows) {
    if (r.reversed) continue
    const op = r.kind === 'CUT' ? 'CAT' : r.kind === 'STEP' ? (r.step ?? 'STEP') : 'PIECE'
    sum.set(op, (sum.get(op) ?? 0) + r.lines.reduce((t, l) => t + l.qty, 0))
  }
  const rank = (op: string) => { const i = OP_ORDER.indexOf(op); return i < 0 ? OP_ORDER.length : i }
  return [...sum.entries()].map(([op, qty]) => ({ op, qty })).sort((a, b) => rank(a.op) - rank(b.op))
}

/** "08:05" - giờ hiện cho công nhân biết lần báo đã được máy chủ ghi lúc nào. */
export function hhmm(d: Date = new Date()): string {
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
