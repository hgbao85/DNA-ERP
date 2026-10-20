/** Số năm mỗi trang của lưới chọn năm (`YearPicker`). */
export const YEAR_PAGE = 12

/**
 * Năm CUỐI của trang lưới năm chứa `value`. Có `max` thì các trang xếp lùi từ `max` (trang đầu kết thúc đúng ở `max`, năm mới
 * nhất nằm cuối); không có `max` thì đặt năm đang chọn gần cuối trang đầu. `value` lớn hơn `max` vẫn ra trang chứa nó
 * (ô của năm vượt `max` bị mờ chứ không biến mất).
 */
export function yearPageEnd(value: number, max?: number): number {
  const anchorEnd = max ?? value + 3
  return anchorEnd - YEAR_PAGE * Math.floor((anchorEnd - value) / YEAR_PAGE)
}

/** 'yyyy-MM' - cùng định dạng với `Period.month` ở màn báo cáo; chuỗi cùng độ dài nên so sánh bằng `<`/`>` đúng thứ tự thời gian. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}
