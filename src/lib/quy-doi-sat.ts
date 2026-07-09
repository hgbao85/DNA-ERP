/**
 * Quy đổi CÂY sắt → ĐOẠN (segments), dựa trên KIỂU CẮT (pattern) do hệ thống
 * cắt sắt (OR-Tools) tính sẵn.
 *
 * ⚠️ LOGIC NÀY SẼ CHUYỂN XUỐNG BE khi lên thật (con số chính thức nuôi tiến độ,
 * đồng bộ, tồn kho, báo cáo). FE chỉ giữ 1 bản copy để mirror/preview tức thì.
 *
 * Thuần & tất định — CHỈ cộng/nhân. KHÔNG tối ưu gì (tối ưu đã do cắt sắt làm).
 * Xem docs/quy-doi-doan-phoi.md để biết hợp đồng dữ liệu & cách bê xuống BE.
 */

/** Một kiểu cắt: mỗi cây cắt theo kiểu này ra bao nhiêu đoạn mỗi cỡ. */
export interface CutPattern {
  /** Cỡ đoạn (mm) → số đoạn cắt ra từ MỖI cây theo kiểu này. */
  segments: Record<number, number>
  /** Số cây (bó) cắt theo kiểu này. */
  soCay: number
  /** Hao hụt (mm) mỗi cây = tề đầu + đầu thừa (đã do cắt sắt tính). */
  hhPerCay: number
}

export interface DoanQuyDoi {
  len: number
  count: number
}

/** Bung danh sách bó cây (pattern) của 1 đợt → tổng số đoạn theo từng cỡ. */
export function quyDoiDoan(bundles: CutPattern[]): DoanQuyDoi[] {
  const acc = new Map<number, number>()
  for (const b of bundles) {
    for (const [len, per] of Object.entries(b.segments)) {
      const L = Number(len)
      acc.set(L, (acc.get(L) ?? 0) + per * b.soCay)
    }
  }
  return [...acc.entries()]
    .map(([len, count]) => ({ len, count }))
    .sort((a, b) => b.len - a.len)
}

/** Tổng số cây của 1 đợt. */
export const tongCay = (bundles: CutPattern[]) =>
  bundles.reduce((s, b) => s + b.soCay, 0)

/** Tổng hao hụt (mm) của 1 đợt. */
export const tongHaoHutMm = (bundles: CutPattern[]) =>
  bundles.reduce((s, b) => s + b.soCay * b.hhPerCay, 0)

/** Tổng số đoạn (mọi cỡ) của 1 đợt. */
export const tongDoan = (bundles: CutPattern[]) =>
  quyDoiDoan(bundles).reduce((s, d) => s + d.count, 0)

/** Mô tả 1 kiểu cắt dạng "4×930 + 1×765 + 1×695 + 4×200". */
export const moTaKieuCat = (p: CutPattern) =>
  Object.entries(p.segments)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([len, n]) => `${n}×${len}`)
    .join(' + ')
