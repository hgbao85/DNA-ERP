/**
 * Luật cứng của lệnh gộp (Sếp Nhân chốt 2026-10-24, làm rõ cùng ngày): "bắt buộc chỉ được gộp tối đa 2 lệnh
 * có ngày cắt sắt cách nhau không quá 3 ngày (ví dụ: ngày 1 gộp được ngày 3, ngày 1 không được gộp với ngày 4)".
 * Tức là KHUNG gộp N ngày (N = SystemConfig.solverMergeWindowDays, mặc định 3, Admin chỉnh 1-365) tính CẢ HAI
 * ĐẦU: mốc sớm nhất và muộn nhất chênh nhau tối đa N - 1 ngày (xem maxGapDays). N = 1 -> chỉ gộp cùng ngày.
 * Cắt/mua sắt đi theo PI nên cả nhóm mua một lần; mốc cách xa thì SKU sớm phải chờ hoặc SKU muộn phải mua sớm.
 * BE chặn khi lưu (400) - file này là bản tính cùng công thức ở FE để báo NGAY trong hộp "Sửa thời hạn".
 *
 * Mốc cần sắt của 1 SKU = ngày "Mua VT khung & đan" (materialDeadline, tên cũ "Mua hàng" - đổi 2026-10-27); chưa có thì lấy ngày "Khung cơ khí"
 * (stage FRAME); cả hai đều trống thì SKU đó BỊ BỎ QUA khi kiểm tra (đúng như BE).
 *
 * Ngày ở đây là chuỗi lịch 'yyyy-MM-dd' (đúng giá trị ô <input type="date">), tính khoảng cách bằng
 * Date.UTC để không dính giờ/múi giờ.
 */

/** Mặc định khi BE cũ chưa trả cấu hình (cùng mặc định phía BE/Admin). */
export const DEFAULT_MERGE_WINDOW_DAYS = 3
/** Mặc định số SKU tối đa mỗi lệnh gộp (SystemConfig.solverMergeMaxSkus) khi BE cũ chưa trả. */
export const DEFAULT_MERGE_MAX_SKUS = 2

/** Chênh lệch tối đa (ngày) giữa mốc sớm nhất và muộn nhất cho phép trong khung `windowDays` ngày (khung tính cả hai đầu). */
export function maxGapDays(windowDays: number): number {
  return Math.max(0, windowDays - 1)
}

export interface SteelNeedEntry {
  /** Mã SKU (factoryCode) - chỉ để nêu tên trong câu báo lỗi. */
  code: string
  /** 'yyyy-MM-dd'. */
  date: string
}

export interface SteelNeedSpan {
  /** Số ngày giữa mốc sớm nhất và muộn nhất. */
  days: number
  earliest: SteelNeedEntry
  latest: SteelNeedEntry
}

/** Mốc cần sắt của 1 SKU: "Mua VT khung & đan", không có thì "Khung cơ khí"; cả hai trống = null (bỏ qua). */
export function steelNeedDate(materialDeadline?: string | null, frameDeadline?: string | null): string | null {
  return materialDeadline || frameDeadline || null
}

const dayMs = (ymd: string): number => {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, (m || 1) - 1, d || 1)
}

/**
 * Khoảng cách giữa mốc cần sắt sớm nhất và muộn nhất của các SKU. Dưới 2 SKU có mốc thì không có
 * gì để so -> null. Cùng ngày nhiều SKU thì lấy SKU đứng trước trong danh sách để nêu tên.
 */
export function steelNeedSpan(entries: { code: string; date: string | null | undefined }[]): SteelNeedSpan | null {
  const withDate = entries.filter((e): e is SteelNeedEntry => !!e.date)
  if (withDate.length < 2) return null
  let earliest = withDate[0]
  let latest = withDate[0]
  for (const e of withDate) {
    if (dayMs(e.date) < dayMs(earliest.date)) earliest = e
    if (dayMs(e.date) > dayMs(latest.date)) latest = e
  }
  return { days: Math.round((dayMs(latest.date) - dayMs(earliest.date)) / 86_400_000), earliest, latest }
}

/** 'yyyy-MM-dd' -> 'dd/MM' (thêm /yyyy khi hai mốc nằm ở hai năm khác nhau cho khỏi mơ hồ). */
const fmtDay = (ymd: string, withYear: boolean): string => {
  const [y, m, d] = ymd.slice(0, 10).split('-')
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`
}

/**
 * Câu báo lỗi khi các mốc không nằm gọn trong khung `windowDays` ngày (chênh > maxGapDays); null = hợp lệ.
 * Cùng lời văn với thông báo 400 của BE để người dùng thấy MỘT câu dù FE chặn trước hay BE chặn sau.
 */
export function steelNeedSpanMessage(span: SteelNeedSpan | null, windowDays: number): string | null {
  const gap = maxGapDays(windowDays)
  if (!span || span.days <= gap) return null
  const withYear = span.earliest.date.slice(0, 4) !== span.latest.date.slice(0, 4)
  return (
    `Mốc cần sắt của các SKU trong lệnh gộp cách nhau ${span.days} ngày ` +
    `(sớm nhất ${fmtDay(span.earliest.date, withYear)} – ${span.earliest.code}, ` +
    `muộn nhất ${fmtDay(span.latest.date, withYear)} – ${span.latest.code}) - ` +
    `chỉ được gộp trong khung ${windowDays} ngày (chênh tối đa ${gap} ngày, vd ngày 1 gộp được ngày ${windowDays}). ` +
    `Dời lại mốc hoặc tách SKU ra lệnh riêng.`
  )
}
