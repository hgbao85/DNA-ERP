/**
 * Mô hình thuần màn Điều phối đan (25/11/2026, docs THIET-KE-DIEU-PHOI-DAN) - không gọi mạng, không React, để test bằng vitest.
 * Luật kiểm ghi chú CHÉP ĐÚNG BE (weaving-coordination.rules.ts validateFollowUp) để báo lỗi trước khi gửi; BE vẫn là chốt chặn.
 */
import type {
  CreateWeavingFollowUpInput,
  WeavingBoardRow,
  WeavingPromise,
  WeavingPromiseStatus,
  WeavingRowStatus,
} from '../../../services/weaving-coordination-api'

export const STATUS_META: Record<WeavingRowStatus, { label: string; color: string; bg: string }> = {
  LATE: { label: 'Trễ hạn', color: 'var(--red)', bg: 'var(--red-bg)' },
  DUE_SOON: { label: 'Sắp tới hạn', color: 'var(--amber)', bg: 'var(--amber-bg)' },
  ON_TRACK: { label: 'Đúng hạn', color: 'var(--green)', bg: 'var(--green-bg)' },
  NO_DEADLINE: { label: 'Chưa có hạn', color: 'var(--text2)', bg: 'var(--surface2)' },
  DONE: { label: 'Đã trả đủ', color: 'var(--blue)', bg: 'var(--blue-bg)' },
}

/** Bộ lọc trạng thái: 'OPEN' = mọi dòng còn giữ hàng (mặc định). 'DONE' hỏi BE riêng (bảng mặc định không trả dòng đã trả đủ). */
export type StatusFilter = 'OPEN' | WeavingRowStatus
export const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'OPEN', label: 'Đang giữ' },
  { key: 'LATE', label: STATUS_META.LATE.label },
  { key: 'DUE_SOON', label: STATUS_META.DUE_SOON.label },
  { key: 'ON_TRACK', label: STATUS_META.ON_TRACK.label },
  { key: 'NO_DEADLINE', label: STATUS_META.NO_DEADLINE.label },
  { key: 'DONE', label: STATUS_META.DONE.label },
]

/** 'YYYY-MM-DD' -> 'dd/mm/yyyy'. */
export function fmtDay(day: string | null | undefined): string {
  if (!day) return '—'
  const [y, m, d] = day.split('-')
  return y && m && d ? `${d}/${m}/${y}` : day
}

/** Mã lệnh hiển thị: LSX của dòng PI, không có thì mã PI, cuối cùng mã PO hệ thống. */
export function lenhLabel(r: Pick<WeavingBoardRow, 'lsxCode' | 'piCode' | 'poNumber'>): string {
  return r.lsxCode || r.piCode || r.poNumber
}

/** Dòng phụ dưới hạn trả: "Trễ 2 ngày" / "Hôm nay" / "Còn 3 ngày". */
export function dueHint(r: Pick<WeavingBoardRow, 'status' | 'daysLeft'>): string | null {
  if (r.status === 'DONE' || r.daysLeft == null) return null
  if (r.daysLeft < 0) return `Trễ ${-r.daysLeft} ngày`
  if (r.daysLeft === 0) return 'Hạn hôm nay'
  return `Còn ${r.daysLeft} ngày`
}

export const PROMISE_STATUS_LABEL: Record<WeavingPromiseStatus, string> = {
  NONE: 'Không hẹn',
  OPEN: 'Đang chờ',
  REMINDED: 'Quá hẹn - đã nhắc',
  KEPT: 'Đã giữ hẹn',
  SUPERSEDED: 'Đã thay bằng hẹn mới',
}

/** Lời hẹn mới nhất hiện dưới trạng thái: "Hẹn 5 mảnh · 28/11/2026 · đã về 3/5". */
export function promiseLine(p: WeavingPromise | null, today: string): { text: string; tone: 'muted' | 'warn' | 'ok' } | null {
  if (!p) return null
  const base = `Hẹn ${p.promisedQty} mảnh · ${fmtDay(p.promisedDate)}`
  const got = `đã về ${Math.min(p.returnedSince, p.promisedQty)}/${p.promisedQty}`
  if (p.status === 'KEPT') return { text: `${base} · đã giữ hẹn`, tone: 'ok' }
  if (p.status === 'REMINDED' || (p.status === 'OPEN' && p.promisedDate < today)) return { text: `${base} · quá hẹn, ${got}`, tone: 'warn' }
  if (p.status === 'OPEN' && p.promisedDate === today) return { text: `${base} · hôm nay, ${got}`, tone: 'warn' }
  if (p.status === 'OPEN') return { text: `${base} · ${got}`, tone: 'muted' }
  return { text: `${base} · ${PROMISE_STATUS_LABEL[p.status].toLowerCase()}`, tone: 'muted' }
}

/** Lọc dòng theo điểm đan + trạng thái + ô tìm (mã lệnh / PO / mảnh / điểm đan). */
export function filterRows(
  rows: WeavingBoardRow[],
  f: { pointId?: string | null; status: StatusFilter; search?: string },
): WeavingBoardRow[] {
  const q = (f.search ?? '').trim().toLowerCase()
  return rows.filter((r) => {
    if (f.pointId && r.weavingPointId !== f.pointId) return false
    if (f.status === 'OPEN' ? r.status === 'DONE' : r.status !== f.status) return false
    if (!q) return true
    return [r.lsxCode, r.piCode, r.poNumber, r.salesOrderCode, r.pieceCode, r.pieceName, r.weavingPointName, r.productName]
      .some((v) => (v ?? '').toLowerCase().includes(q))
  })
}

/** Đếm dòng theo bộ lọc trạng thái (trong phạm vi điểm đan đang chọn). DONE không đếm được từ bảng mặc định -> undefined. */
export function countByStatus(rows: WeavingBoardRow[], pointId?: string | null): Partial<Record<StatusFilter, number>> {
  const mine = pointId ? rows.filter((r) => r.weavingPointId === pointId) : rows
  const out: Partial<Record<StatusFilter, number>> = { OPEN: mine.filter((r) => r.status !== 'DONE').length }
  for (const s of ['LATE', 'DUE_SOON', 'ON_TRACK', 'NO_DEADLINE'] as const) out[s] = mine.filter((r) => r.status === s).length
  return out
}

export interface FollowUpForm {
  content: string
  /** Ô số để trống = không hẹn. */
  promisedQty: string
  /** 'YYYY-MM-DD' hoặc ''. */
  promisedDate: string
}

export const EMPTY_FOLLOW_UP_FORM: FollowUpForm = { content: '', promisedQty: '', promisedDate: '' }

/** Kiểm form ghi chú trước khi gửi - cùng luật BE (Đ2). `held` = số điểm đan đang giữ của dòng. */
export function validateFollowUpForm(form: FollowUpForm, held: number, today: string): string | null {
  if (!form.content.trim()) return 'Nhập nội dung trao đổi'
  const qtyText = form.promisedQty.trim()
  const hasQty = qtyText !== ''
  const hasDate = form.promisedDate !== ''
  if (hasQty !== hasDate) return 'Hẹn trả cần đủ cả số mảnh và ngày hẹn (hoặc bỏ trống cả hai)'
  if (!hasQty) return null
  const qty = Number(qtyText)
  if (!Number.isInteger(qty) || qty <= 0) return 'Số mảnh hẹn trả phải là số nguyên lớn hơn 0'
  if (held <= 0) return 'Điểm đan đã trả đủ - không còn mảnh nào để hẹn'
  if (qty > held) return `Số mảnh hẹn trả (${qty}) vượt số điểm đan đang giữ (${held})`
  if (form.promisedDate < today) return 'Ngày hẹn không được trước hôm nay'
  return null
}

export function followUpPayload(
  row: Pick<WeavingBoardRow, 'weavingPointId' | 'productionOrderId' | 'pieceId'>,
  form: FollowUpForm,
): CreateWeavingFollowUpInput {
  const qtyText = form.promisedQty.trim()
  return {
    weavingPointId: row.weavingPointId,
    productionOrderId: row.productionOrderId,
    pieceId: row.pieceId,
    content: form.content.trim(),
    ...(qtyText !== '' && form.promisedDate ? { promisedQty: Number(qtyText), promisedDate: form.promisedDate } : {}),
  }
}
