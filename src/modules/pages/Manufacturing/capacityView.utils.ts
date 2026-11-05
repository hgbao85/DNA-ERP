// Phần A – Đợt 3 (YC10): hàm thuần cho tab "Năng lực" (CapacityView). Ngày luôn là chuỗi 'YYYY-MM-DD' (ngày VN).
import type { CapacityRow, CapacityWarning } from '../../../services/production-capacity-api'

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** Ngày hôm nay theo giờ máy (máy người dùng ở VN) dạng 'YYYY-MM-DD'. */
export function todayKey(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

/** Cộng/trừ ngày trên chuỗi 'YYYY-MM-DD' (tính theo UTC nên không lệch múi giờ/giờ mùa hè). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export const ddmm = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}`

/** 'T2'..'T7' / 'CN' của 'YYYY-MM-DD'. */
export function weekdayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** Số cont kiểu VN: 1 số lẻ (1,3); 0 -> '0'. */
export function fmtCont(n: number): string {
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

/** Số cont tối đa 2 số lẻ khi cần phân biệt (trần 1,25...). */
export function fmtCap(n: number): string {
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export interface CapacityGroup {
  key: string
  groupName: string
  rows: CapacityRow[]
}

/** Gom các dòng liền nhau cùng nhóm (xưởng/kho) - giữ thứ tự BE trả. */
export function groupRows(rows: CapacityRow[]): CapacityGroup[] {
  const out: CapacityGroup[] = []
  for (const r of rows) {
    const key = `${r.groupKind}:${r.groupCode}`
    const last = out[out.length - 1]
    if (last && last.key === key) last.rows.push(r)
    else out.push({ key, groupName: r.groupName, rows: [r] })
  }
  return out
}

/** Lời cảnh báo: bỏ trùng câu, cắt `max` câu đầu; phần còn lại báo số lượng để "xem thêm". */
export function limitWarnings(warnings: CapacityWarning[], max: number): { shown: string[]; rest: number } {
  const msgs = [...new Set(warnings.map((w) => w.message))]
  return { shown: msgs.slice(0, max), rest: Math.max(0, msgs.length - max) }
}
