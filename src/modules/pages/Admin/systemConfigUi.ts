/**
 * Hàm thuần cho tab "Máy cắt" của màn Cấu hình hệ thống (13/11/2026, review UI mục 13).
 * Tách riêng để test được, không đụng React.
 */

/** Chữ giải nghĩa cho mã quy cách: "FI10" -> "Phi 10", "H13-26" -> "Hộp 13×26", "V15" -> "Vuông 15".
 *  Mã sai dạng (hoặc rỗng) -> null: không hiện gì, thông báo lỗi của ô vẫn do handleSave lo.
 *  Chấp nhận chữ thường và khoảng trắng thừa (giống cách handleSave chuẩn hoá mã). */
export function describeSpecCode(raw: string): string | null {
  const code = raw.replace(/\s+/g, '').toUpperCase()
  let m = /^V(\d+)$/.exec(code)
  if (m) return `Vuông ${Number(m[1])}`
  m = /^H(\d+)-(\d+)$/.exec(code)
  if (m) return `Hộp ${Number(m[1])}×${Number(m[2])}`
  m = /^FI(\d+)$/.exec(code)
  if (m) return `Phi ${Number(m[1])}`
  return null
}

/** Dòng tóm tắt "bó" trên thẻ chọn máy MC Tự động: bảng quy cách có dòng thì ghi "Bó theo N quy cách"
 *  (bảng được ưu tiên hơn hệ số bó chung); bảng rỗng thì "Bó 14–20 cây" theo hệ số chung; không có gì thì "". */
export function summarizeBundle(factors: number[], specCount: number): string {
  if (specCount > 0) return `Bó theo ${specCount} quy cách`
  if (factors.length === 0) return ''
  return `Bó ${factors.length > 1 ? `${Math.min(...factors)}–${Math.max(...factors)}` : factors[0]} cây`
}
