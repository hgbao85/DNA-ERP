/**
 * Phần A – Đợt 2 (V3-1): số LSX nhà máy (vd MY-313, GP-176) làm MÃ LỆNH hiển thị chính. CÙNG LUẬT với BE
 * `src/common/utils/lenh-code.util.ts` - đổi 2 bên cùng lúc.
 *
 * - LSX gắn với DÒNG SKU (`lsxCode`, không trùng toàn hệ thống): "lệnh gốc" = 1 dòng SKU, lệnh gộp hiện đủ số các dòng.
 * - Mã hiển thị của 1 PI = các LSX KHÁC NHAU của các dòng, giữ thứ tự dòng, nối " + "; chưa dòng nào có LSX (lệnh cũ) thì mã PI.
 * - Màn chi tiết theo dòng SKU (Bảng mốc, dòng SKU trong PI) hiện LSX của CHÍNH dòng đó (`lineCode`).
 */

export const LSX_CODE_PATTERN = /^[A-Z]{1,6}-\d{1,6}$/
export const LSX_PREFIX_PATTERN = /^[A-Z]{1,6}$/
export const LENH_CODE_SEPARATOR = ' + '

/** Bỏ trắng 2 đầu, in hoa; "my 313" / "MY_313" / "my313" -> "MY-313". Không đúng dạng thì trả chuỗi đã in hoa, bỏ trắng. */
export function normalizeLsxCode(raw: string): string {
  const s = raw.trim().toUpperCase()
  const m = /^([A-Z]{1,6})[\s_-]*(\d{1,6})$/.exec(s)
  return m ? `${m[1]}-${m[2]}` : s.replace(/\s+/g, '')
}

export function isValidLsxCode(code: string): boolean {
  return LSX_CODE_PATTERN.test(code)
}

/** "MY-313" -> "MY"; sai dạng -> null. */
export function lsxPrefixOf(code: string): string | null {
  return isValidLsxCode(code) ? code.slice(0, code.indexOf('-')) : null
}

/** "MY-313" -> "313"; sai dạng -> null. */
export function lsxNumberOf(code: string): string | null {
  return isValidLsxCode(code) ? code.slice(code.indexOf('-') + 1) : null
}

/** Ô "Tiền tố số LSX" của Admin: "my, gp ,MY" -> ["MY","GP"] (bỏ trắng, in hoa, bỏ trùng, bỏ rỗng). */
export function parseLsxPrefixes(text: string): string[] {
  const out: string[] = []
  for (const part of text.split(/[,;\s]+/)) {
    const p = part.trim().toUpperCase()
    if (p && !out.includes(p)) out.push(p)
  }
  return out
}

/**
 * Lỗi dạng của 1 số LSX đã chuẩn hoá, null = hợp lệ. `prefixes` rỗng = mọi tiền tố đúng dạng (như BE). Câu báo lỗi để hiện
 * ngay dưới ô nhập; BE vẫn kiểm lại (trùng số chỉ BE biết).
 */
export function lsxCodeError(code: string, prefixes: readonly string[]): string | null {
  if (!isValidLsxCode(code)) return 'Số LSX phải dạng TIỀN TỐ-SỐ, vd MY-313 (1–6 chữ cái, 1–6 chữ số)'
  const prefix = lsxPrefixOf(code)!
  if (prefixes.length > 0 && !prefixes.includes(prefix)) {
    return `Tiền tố ${prefix} chưa có trong Cấu hình hệ thống (đang có: ${prefixes.join(', ')})`
  }
  return null
}

/** Các LSX khác nhau (khác rỗng) của các dòng, giữ thứ tự dòng. */
export function lenhLsxCodes(items: readonly { lsxCode?: string | null }[] | null | undefined): string[] {
  const out: string[] = []
  for (const it of items ?? []) {
    const c = it?.lsxCode?.trim()
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}

/** Mã lệnh hiển thị của 1 PI: LSX các dòng nối " + ", chưa có thì mã PI. */
export function lenhDisplayCode(pi: { code: string }, items: readonly { lsxCode?: string | null }[] | null | undefined): string {
  const codes = lenhLsxCodes(items)
  return codes.length > 0 ? codes.join(LENH_CODE_SEPARATOR) : pi.code
}

/** Mã của 1 DÒNG SKU: LSX của dòng, chưa có thì mã PI. */
export function lineCode(item: { lsxCode?: string | null }, piCode: string): string {
  return item.lsxCode?.trim() || piCode
}

/** Ô tìm kiếm "mã PI hoặc số LSX": khớp (không phân biệt hoa thường) mã PI, mã hiển thị hoặc bất kỳ LSX nào của các dòng. */
export function matchesLenhSearch(
  pi: { code?: string | null; displayCode?: string | null; items?: readonly { lsxCode?: string | null }[] | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [pi.code ?? '', pi.displayCode ?? '', ...lenhLsxCodes(pi.items)]
  return hay.some((v) => v.toLowerCase().includes(q))
}
