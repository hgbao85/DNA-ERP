/**
 * Số ngày đã quá hạn so với HÔM NAY (giờ máy, tính theo ngày lịch); 0 = chưa quá hạn (hạn hôm nay chưa tính là quá).
 * 2026-10-20 (changelog BE 10-08 mục 50/51): màn Xử lý/Duyệt lệnh sản xuất trước đây không báo quá hạn - PI hạn 07/10
 * vẫn hiện chữ đen như PI còn hạn, các mốc "ước tính" đã qua cũng không đánh dấu.
 */
export function overdueDays(deadline: Date, now = new Date()): number {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.max(0, Math.round((day(now) - day(deadline)) / 86_400_000))
}
