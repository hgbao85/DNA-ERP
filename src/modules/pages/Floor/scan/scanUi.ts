/** Kiểu dáng dùng chung của màn quét QR (điện thoại, đeo găng: vùng bấm lớn, chữ to). */
import type { CSSProperties } from 'react'

export const page: CSSProperties = {
  minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)',
  fontFamily: "'Inter', system-ui, sans-serif", fontSize: 16,
}
// Chừa chỗ cho thanh nút dính đáy (có thêm dòng lý do khi nút tắt).
export const wrap: CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '0 16px 140px' }
export const card: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
  padding: 16, boxShadow: 'var(--shadow-sm)',
}
export const cardFlush: CSSProperties = { ...card, padding: 0 }
export const btn = (primary: boolean, disabled = false): CSSProperties => ({
  minHeight: 52, padding: '0 18px', borderRadius: 10, fontSize: 17, fontWeight: 600,
  border: primary ? 'none' : '1px solid var(--border2)',
  background: disabled ? 'var(--surface2)' : primary ? 'var(--floor-primary)' : 'var(--surface)',
  color: disabled ? 'var(--floor-hint)' : primary ? '#fff' : 'var(--text)',
  cursor: disabled ? 'default' : 'pointer', width: '100%',
})
export const chip = (on: boolean): CSSProperties => ({
  minHeight: 44, padding: '0 14px', borderRadius: 999, fontSize: 15, fontWeight: on ? 600 : 500,
  border: `1px solid ${on ? 'var(--blue)' : 'var(--border2)'}`,
  background: on ? 'var(--blue-bg)' : 'var(--surface)', color: on ? 'var(--blue-text)' : 'var(--text)',
  cursor: 'pointer', whiteSpace: 'nowrap',
})
export const numInput: CSSProperties = {
  width: 84, minHeight: 48, fontSize: 20, fontWeight: 600, textAlign: 'center',
  border: '1px solid var(--border2)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)',
}
export const label: CSSProperties = { fontSize: 14, color: 'var(--text2)', fontWeight: 600, marginBottom: 8 }
export const nowrap: CSSProperties = { whiteSpace: 'nowrap' }

// Chữ phụ, hàng chip, cột xếp dọc, tiêu đề: các khối lặp lại nhiều nơi.
export const hint: CSSProperties = { fontSize: 14, color: 'var(--text2)' }
export const hintFaint: CSSProperties = { fontSize: 14, color: 'var(--floor-hint)' }
export const chipRow: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' }
export const column = (gap: number): CSSProperties => ({ display: 'flex', flexDirection: 'column', gap })
export const tabColumn: CSSProperties = { ...column(16), marginTop: 16 }
export const heading: CSSProperties = { fontSize: 20, fontWeight: 700 }
export const loadingText: CSSProperties = { color: 'var(--text2)' }
export const rowBetween: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }

/** Dòng ngăn cách trong thẻ liệt kê: dòng đầu không có đường kẻ. */
export const divider = (i: number): CSSProperties => ({ borderTop: i ? '1px solid var(--border)' : 'none' })

/** Nhãn nhỏ dạng viên thuốc (Đang chạy, Xong, bước làm...). */
export const pill = (bg: string, color: string, weight = 700): CSSProperties => ({
  fontSize: 12, fontWeight: weight, padding: '2px 8px', borderRadius: 999, background: bg, color, whiteSpace: 'nowrap',
})

/** Nút phụ rộng bằng dòng, cao >= 44 px (Xem thêm, Báo cho lệnh này). */
export const rowButton = (on: boolean): CSSProperties => ({
  minHeight: 44, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${on ? 'var(--blue)' : 'var(--border)'}`,
  background: on ? 'var(--blue-bg)' : 'var(--surface)', color: on ? 'var(--blue-text)' : 'var(--text)',
})

export const fieldInput: CSSProperties = {
  width: '100%', minHeight: 52, fontSize: 18, padding: '0 14px', borderRadius: 10,
  border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)',
}
