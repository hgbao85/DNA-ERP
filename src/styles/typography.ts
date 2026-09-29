import type { CSSProperties } from 'react'

/** Thang typography dùng cho khu vực tiêu đề/form/card/modal — KHÔNG áp cho ô bảng dữ liệu
 *  (bảng cố ý giữ nguyên mật độ cũ, xem `styles/table.ts`). Dùng thay cho số magic rời rạc
 *  (fontSize: 18, 20...) để nhất quán phân cấp thị giác giữa các trang. */

/** Tiêu đề chính của trang (vd "Quản lí đơn hàng"). */
export const pageTitle: CSSProperties = { fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }

/** Dòng mô tả phụ ngay dưới tiêu đề trang (vd "12 PO"). */
export const pageSubtitle: CSSProperties = { fontSize: 13, color: 'var(--text3)', marginTop: 2 }

/** Tiêu đề khối/card con bên trong trang (vd tên modal, tiêu đề section). */
export const cardTitle: CSSProperties = { fontSize: 16, fontWeight: 700, color: 'var(--text)' }

/** Nhãn nhỏ in hoa, cùng vai trò với `.section-title` (globals.css) nhưng ở dạng object để
 *  dùng trực tiếp trong style inline khi cần kết hợp thêm field khác. */
export const sectionLabel: CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)',
}

/** Chữ nội dung chính (nhãn field, dòng mô tả trong card). */
export const bodyText: CSSProperties = { fontSize: 13, color: 'var(--text)' }

/** Chữ phụ, ít quan trọng hơn bodyText (mốc thời gian, ghi chú nhỏ). */
export const metaText: CSSProperties = { fontSize: 12, color: 'var(--text3)' }
