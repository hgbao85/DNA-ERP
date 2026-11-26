/**
 * Logic thuần của vị trí kho Thành phẩm + soạn hàng + load cont (25/11/2026, docs THIET-KE-VI-TRI-KHO-LOAD-CONT, V1-V9) - tách khỏi
 * giao diện để kiểm thử. Bản BE cùng luật: src/modules/vi-tri-kho/vi-tri-kho.util.ts (BE luôn kiểm lại dưới khoá; ở đây chỉ để
 * khoá nút sớm và nói rõ vì sao).
 */
import type { VtkContainer, VtkPickLine, VtkStockRow, VtkStockTotal, VtkTriple } from '../../../../services/vi-tri-kho-api'

export interface FormCheck { ok: boolean; reason: string | null }
const ok: FormCheck = { ok: true, reason: null }
const no = (reason: string): FormCheck => ({ ok: false, reason })

export const MAX_BULK_LOCATIONS = 500

/** Khu: 1-4 chữ / số in hoa. null = không hợp lệ. */
export function normalizeZone(raw: string): string | null {
  const z = raw.trim().toUpperCase()
  return /^[A-Z0-9]{1,4}$/.test(z) ? z : null
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** V1: khai hàng loạt - khu A, dãy 1-3, ô 1-10 -> A-01-01 … A-03-10 (theo dãy rồi ô). Trả lỗi tiếng Việt khi sai. */
export function bulkLocationCodes(i: { zone: string; aisleFrom: number; aisleTo: number; slotFrom: number; slotTo: number }): string[] | string {
  const zone = normalizeZone(i.zone)
  if (!zone) return 'Khu là 1-4 chữ / số (vd A)'
  const nums = [i.aisleFrom, i.aisleTo, i.slotFrom, i.slotTo]
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 99)) return 'Dãy và ô là số từ 1 tới 99'
  if (i.aisleFrom > i.aisleTo) return 'Dãy "từ" phải nhỏ hơn hoặc bằng dãy "đến"'
  if (i.slotFrom > i.slotTo) return 'Ô "từ" phải nhỏ hơn hoặc bằng ô "đến"'
  const count = (i.aisleTo - i.aisleFrom + 1) * (i.slotTo - i.slotFrom + 1)
  if (count > MAX_BULK_LOCATIONS) return `Mỗi lần khai tối đa ${MAX_BULK_LOCATIONS} ô (đang chọn ${count})`
  const out: string[] = []
  for (let a = i.aisleFrom; a <= i.aisleTo; a += 1) {
    for (let s = i.slotFrom; s <= i.slotTo; s += 1) out.push(`${zone}-${pad2(a)}-${pad2(s)}`)
  }
  return out
}

/** Thứ tự ô ổn định (A-01-02 trước A-01-10) - như BE compareLocationCode. */
export const compareLocationCode = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })

/** V9: nhãn bộ 3 luôn đủ lệnh · SKU · PO. */
export const tripleText = (t: Pick<VtkTriple, 'lenhCode' | 'sku' | 'poCode'>): string =>
  `${t.lenhCode} · ${t.sku} · PO ${t.poCode ?? '—'}`

/** Số nguyên dương từ ô nhập (rỗng / sai = 0). */
export const toQty = (s: string): number => {
  const n = Number(s.replace(/\D/g, '').slice(0, 6) || 0)
  return Number.isFinite(n) ? n : 0
}

/** Lọc tồn thùng theo chữ gõ (lệnh, SKU, tên, PO, mã ô). */
export function matchesStock(r: VtkStockRow, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return [r.lenhCode, r.sku, r.productName, r.poCode ?? '', ...r.locations.map((l) => l.code)]
    .some((x) => x.toLowerCase().includes(s))
}

/** Dòng tổng của bảng tồn thùng (sau khi lọc). */
export function stockTotal(rows: VtkStockRow[]): VtkStockTotal {
  return rows.reduce((t, r) => ({
    inStockQty: t.inStockQty + r.inStockQty,
    loadingQty: t.loadingQty + r.loadingQty,
    unplacedQty: t.unplacedQty + r.unplacedQty,
    toPackQty: t.toPackQty + r.toPackQty,
  }), { inStockQty: 0, loadingQty: 0, unplacedQty: 0, toPackQty: 0 })
}

/** V2: công nhân đóng gói phải quét ô trước khi lưu (khi bật vị trí kho). */
export function dgLocationCheck(o: { required: boolean; locationId: string | null }): FormCheck {
  if (!o.required) return ok
  return o.locationId ? ok : no('Quét tem ô cất thùng trước')
}

/** V4: chuyển ô - quét ô đi + ô đến khác nhau, chọn bộ 3, số không vượt số đang ở ô đi. */
export function moveCheck(o: { fromCode: string | null; toCode: string | null; itemId: string | null; qty: number; available: number; busy?: boolean }): FormCheck {
  if (o.busy) return no('Đang lưu…')
  if (!o.fromCode) return no('Quét ô lấy ra')
  if (!o.itemId) return no('Chọn hàng (lệnh · SKU · PO) ở ô lấy ra')
  if (!o.toCode) return no('Quét ô cất vào')
  if (o.fromCode === o.toCode) return no('Ô đi và ô đến trùng nhau')
  if (o.qty <= 0) return no('Nhập số bộ')
  if (o.qty > o.available) return no(`Ô ${o.fromCode} chỉ có ${o.available} bộ`)
  return ok
}

/** V6: lấy hàng 1 dòng danh sách - cont đang mở, số không vượt số gợi ý tối đa (còn phải lấy, tồn ô). */
export function pickCheck(o: { container: Pick<VtkContainer, 'status'> | null; line: Pick<VtkPickLine, 'remainingQty'>; stockQty: number; qty: number; busy?: boolean }): FormCheck {
  if (o.busy) return no('Đang lưu…')
  if (!o.container) return no('Tạo / chọn cont đang load trước')
  if (o.container.status !== 'OPEN') return no('Cont đã đóng - chọn cont đang load')
  if (o.line.remainingQty <= 0) return no('Dòng này đã lấy đủ')
  if (o.qty <= 0) return no('Nhập số bộ')
  if (o.qty > o.line.remainingQty) return no(`Booking chỉ còn phải lấy ${o.line.remainingQty} bộ`)
  if (o.qty > o.stockQty) return no(`Ô này chỉ có ${o.stockQty} bộ`)
  return ok
}

/** V7: lý do chưa đóng cont được (rỗng = đóng được) - như BE containerCloseProblems. */
export function containerCloseProblems(c: { containerNo: string | null; sealNo: string | null; photoUrls: string[]; totalQty: number }): string[] {
  const out: string[] = []
  if (!c.containerNo?.trim()) out.push('nhập số cont')
  if (!c.sealNo?.trim()) out.push('nhập số seal')
  if (c.photoUrls.filter((u) => u.trim()).length === 0) out.push('chụp ít nhất 1 ảnh load cont')
  if (c.totalQty <= 0) out.push('cont chưa có hàng')
  return out
}

/** Số thực xuất từng dòng booking = tổng hàng của dòng đó trong mọi cont (bật vị trí kho). */
export function shipQtyFromContainers(containers: Pick<VtkContainer, 'lines'>[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of containers) for (const l of c.lines) out[l.bookingLineId] = (out[l.bookingLineId] ?? 0) + l.qty
  return out
}

/** Bật vị trí kho: xác nhận xuất được khi có ≥ 1 cont, mọi cont đã đóng và có hàng. */
export function shipReadiness(containers: Pick<VtkContainer, 'status' | 'containerNo' | 'totalQty'>[]): FormCheck {
  if (containers.length === 0) return no('Soạn hàng vào cont và đóng cont trước')
  const open = containers.filter((c) => c.status !== 'LOADED')
  if (open.length > 0) return no(`Còn ${open.length} cont chưa đóng`)
  if (containers.every((c) => c.totalQty <= 0)) return no('Cont chưa có hàng')
  return ok
}
