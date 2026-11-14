/** Kiểu dáng dùng chung của các khối trong màn Tối ưu cắt sắt (giữ nguyên giao diện cũ, gom từ style viết thẳng). */
import type { CSSProperties } from 'react'

/** Nút nhỏ có khung; điện thoại cao 40 px cho dễ chạm. */
export const smallBtn = (isMobile: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', minHeight: isMobile ? 40 : 28,
  fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius)', cursor: 'pointer',
})
export const outlineBtn = (isMobile: boolean, color: string): CSSProperties => ({
  ...smallBtn(isMobile), border: `1px solid ${color}`, background: 'var(--surface)', color,
})
/** Nút chữ không khung (Xem thông số máy cắt, Giải thích...). */
export const textBtn = (isMobile: boolean, fontSize = 12, padY = 4): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: `${padY}px 0`, minHeight: isMobile ? 40 : undefined,
  background: 'none', border: 'none', cursor: 'pointer', fontSize, fontWeight: 600, color: 'var(--text2)',
})
/** Nút phụ nền trong suốt (Đổi, Về cây chuẩn). */
export const ghostBtn: CSSProperties = {
  fontSize: 12, padding: '3px 10px', background: 'transparent', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text2)',
}

/** Khung trắng viền mảnh của khối lớn (Đợt đang chọn, Cài đặt đợt tính). */
export const panelBox = (padding: string, borderColor = 'var(--border)'): CSSProperties => ({
  padding, marginBottom: 8, background: 'var(--surface)', border: `1px solid ${borderColor}`, borderRadius: 'var(--radius-lg)',
})
/** Khung nền xám nhạt cho khối chỉ xem / giải thích. */
export const mutedBox: CSSProperties = {
  padding: '9px 11px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
}
/** Ô ghi chú vàng (cảnh báo nhẹ) và đỏ (lỗi luật) trong khối Đợt đang chọn / Chế độ cắt. */
export const amberNote: CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--fg-92400e)',
  background: 'var(--bg-fffbeb)', borderRadius: 'var(--radius)', padding: '8px 10px',
}
export const redNote: CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--fg-b91c1c)',
  background: 'var(--bg-fee2e2)', borderRadius: 'var(--radius)', padding: '8px 10px',
}
export const noteText = (color: string, marginTop = 8): CSSProperties => ({ marginTop, fontSize: 12.5, color })
/** Viên thuốc nhỏ (nhãn trạng thái, "nên chọn", loại sắt đạt). */
export const pill = (bg: string, color: string, extra?: CSSProperties): CSSProperties => ({
  padding: '1px 7px', borderRadius: 20, background: bg, color, ...extra,
})
export const iconTop: CSSProperties = { flexShrink: 0, marginTop: 1 }
export const rowWrap: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }

// ─── Khung "Cài đặt đợt tính": một hàng ô chọn (xuống dòng khi hẹp) ───────────────────────────────────────
export const fieldHeight = (isMobile: boolean) => (isMobile ? 40 : 34)
export const fieldLabel: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4, minHeight: 16,
}
export const fieldCtl = (isMobile: boolean): CSSProperties => ({
  width: '100%', height: fieldHeight(isMobile), padding: '0 10px', fontSize: 13, border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box',
})
export const fieldBox = (basis: number, isMobile: boolean): CSSProperties => ({
  flex: `1 1 ${isMobile ? '100%' : `${basis}px`}`, minWidth: 0,
})
/** Dòng trạng thái ngắn dưới hàng ô chọn. */
export const statusLine = (color: string): CSSProperties => ({ marginTop: 6, fontSize: 12, color, lineHeight: 1.5 })
export const ellipsisText: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
