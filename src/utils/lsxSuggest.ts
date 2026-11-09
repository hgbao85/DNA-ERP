/**
 * Gợi ý TIỀN TỐ số LSX theo khách hàng (ô "Số LSX" ở màn Lệnh SX). Không có bảng khách -> tiền tố, nên dò 2 bước:
 *  1. Số LSX gần nhất (id dòng SKU lớn nhất) đã dùng cho CÙNG khách hàng -> lấy tiền tố của nó.
 *  2. Chưa có thì dò trong danh sách tiền tố Admin khai, khớp chữ đầu tên khách (GOPLUS -> GP, MEYING/MEIYING -> MY).
 * Không chắc (không khớp, hoặc khớp nhiều tiền tố) thì trả null để ô để TRỐNG - không tự điền bừa.
 * Chỉ gợi ý, không đổi luật kiểm số LSX (BE + lsxCodeError vẫn kiểm).
 */
import { lsxPrefixOf, normalizeLsxCode } from './lenhCode'

export interface LsxSuggestItem {
  id?: string | number | null
  lsxCode?: string | null
  customerName?: string | null
}

/** In hoa, bỏ dấu, chỉ giữ chữ cái A-Z: "Mey Ing" / "MEYING" -> "MEYING". */
function lettersOf(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'D')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

const customerKey = (name: string | null | undefined): string => (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** `needle` là dãy con (đúng thứ tự, không cần liền nhau) của `hay`, và chữ đầu trùng chữ đầu `hay`. */
function anchoredSubsequence(needle: string, hay: string): boolean {
  if (!needle || !hay || needle[0] !== hay[0]) return false
  let i = 0
  for (const ch of hay) {
    if (ch === needle[i]) i++
    if (i === needle.length) return true
  }
  return false
}

/** Tiền tố trong `prefixes` khớp tên khách; null = không có hoặc nhiều tiền tố cùng khớp (mơ hồ). */
export function matchPrefixByCustomerName(customerName: string | null | undefined, prefixes: readonly string[]): string | null {
  const letters = lettersOf(customerName ?? '')
  if (!letters) return null
  const uniq = (list: string[]) => (list.length === 1 ? list[0] : null)
  // Ưu tiên: tên bắt đầu bằng đúng tiền tố > chữ cái đầu mỗi từ > dãy con neo chữ đầu.
  const starts = prefixes.filter((p) => letters.startsWith(p))
  if (starts.length > 0) return uniq(starts)
  const initials = lettersOf(
    (customerName ?? '')
      .split(/\s+/)
      .map((w) => w[0] ?? '')
      .join(''),
  )
  const byInitials = prefixes.filter((p) => p === initials)
  if (byInitials.length > 0) return uniq(byInitials)
  return uniq(prefixes.filter((p) => anchoredSubsequence(p, letters)))
}

/** Tiền tố gợi ý cho khách `customerName`; null = để trống. `items` = mọi dòng SKU màn đang có (kèm lsxCode, customerName). */
export function suggestLsxPrefix(
  customerName: string | null | undefined,
  items: readonly LsxSuggestItem[],
  prefixes: readonly string[],
): string | null {
  const key = customerKey(customerName)
  if (!key) return null
  const allowed = (p: string | null): p is string => !!p && (prefixes.length === 0 || prefixes.includes(p))

  let best: { id: number; prefix: string } | null = null
  for (const it of items) {
    if (customerKey(it.customerName) !== key || !it.lsxCode) continue
    const prefix = lsxPrefixOf(normalizeLsxCode(it.lsxCode))
    if (!allowed(prefix)) continue
    const id = Number(it.id)
    const n = Number.isFinite(id) ? id : -1
    if (!best || n >= best.id) best = { id: n, prefix }
  }
  if (best) return best.prefix
  return matchPrefixByCustomerName(customerName, prefixes)
}
