/** Logic thuần của khối "Sản lượng theo lệnh" ở Khung hàn / Mảnh chờ đan (23/11/2026). Không đụng React. */
import type { BeStageProgressRow } from '../../../services/floor-api'

const fmt = (n: number) => n.toLocaleString('vi-VN')

/** "Hạn 05/12" theo giờ Việt Nam; không có hạn / sai định dạng thì null. */
export function deadlineText(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `Hạn ${d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}`
}

/**
 * "Đủ số" hoặc "còn thiếu 12 mảnh" cạnh mỗi lệnh. Phôi đếm chung đoạn cắt (mỗi công đoạn tính 1 lần) và mảnh nên `unit` =
 * "đoạn / mảnh".
 */
export function stageMissingText(r: Pick<BeStageProgressRow, 'complete' | 'missingPieces'>, unit = 'mảnh'): string {
  return r.complete ? 'Đủ số' : `còn thiếu ${fmt(Math.max(0, r.missingPieces))} ${unit}`
}

/** Câu khi tổ không có lệnh nào (Hàn / Sơn). */
export function stageEmptyText(stage: 'HAN' | 'SON'): string {
  return stage === 'HAN'
    ? 'Tổ Hàn chưa có lệnh nào làm được: chưa có mảnh Phôi đạt KCS, hoặc quản lý chưa cho làm sản phẩm.'
    : 'Tổ Sơn chưa có lệnh nào làm được: chưa có khung Hàn đạt KCS, hoặc quản lý chưa cho làm sản phẩm.'
}

/** Hạn giao còn ≤ chừng này ngày thì báo "sắp tới hạn" (màu cam). */
export const DEADLINE_SOON_DAYS = 3

export type DeadlineTone = 'normal' | 'soon' | 'late'
export interface DeadlineInfo {
  /** "25/12" theo giờ Việt Nam. */
  date: string
  tone: DeadlineTone
  /** Số ngày đã quá hạn (chỉ khi tone = late). */
  lateDays: number
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/**
 * Hạn giao của lệnh: còn ≤ 3 ngày (kể cả hôm nay) -> `soon` (cam); quá hạn -> `late` (đỏ + chữ "quá hạn"); còn lại `normal`.
 * Không có hạn / sai định dạng -> null (không ghi gì). Tính theo ngày lịch của máy, như `overdueDays`.
 */
export function deadlineInfo(iso: string | null | undefined, now = new Date()): DeadlineInfo | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
  const left = Math.round((dayStart(d) - dayStart(now)) / 86_400_000)
  if (left < 0) return { date, tone: 'late', lateDays: -left }
  return { date, tone: left <= DEADLINE_SOON_DAYS ? 'soon' : 'normal', lateDays: 0 }
}

/** Màu chữ của hạn giao (trên nền sáng). */
export const DEADLINE_COLOR: Record<DeadlineTone, string> = { normal: 'var(--text3)', soon: 'var(--amber)', late: 'var(--red)' }

/** "Hạn 25/12" hoặc "Hạn 20/11 · quá hạn"; không có hạn thì null. `lower` = viết thường chữ đầu ("hạn 25/12"). */
export function deadlineLabel(iso: string | null | undefined, lower = false, now = new Date()): string | null {
  const i = deadlineInfo(iso, now)
  if (!i) return null
  return `${lower ? 'hạn' : 'Hạn'} ${i.date}${i.tone === 'late' ? ' · quá hạn' : ''}`
}
