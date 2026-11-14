/** Kiểu dáng dùng chung của màn Cấu hình hệ thống (giữ nguyên giao diện cũ, gom từ style viết thẳng). */
import type { CSSProperties } from 'react'

export const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)',
}
/** Viền đỏ của ô sai; ô đúng thì `null` (an toàn khi spread). */
export const errBorder = (err: string | undefined): CSSProperties | null => (err ? { border: '1px solid var(--fg-c62828)' } : null)

export const labelStyle: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }
export const errorStyle: CSSProperties = { color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }
export const helpStyle: CSSProperties = { fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }
export const fullRow: CSSProperties = { gridColumn: '1 / -1' }
export const colGap4: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }
export const sectionDivider: CSSProperties = { borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }

/** Khung của mỗi nhóm trong tab Máy cắt. */
export const MACHINE_PANEL_STYLE: CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface)',
}
/** Lưới ô nhập của tab Máy cắt: cột ≥ 240px nên màn rộng thường 2 ô/hàng, điện thoại 1 ô/hàng; nhãn ngắn để ô cùng hàng luôn thẳng. */
export const FIELD_GRID: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)', alignItems: 'start',
}

/** Nút có khung mảnh (Xoá dòng, Thêm quy cách, Thêm IP). */
export const outlineButton = (padding: string, fontSize = 12): CSSProperties => ({
  padding, fontSize, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)',
  cursor: 'pointer',
})

/** Chấm tròn nhỏ báo "có lỗi" (đỏ) hoặc "chưa lưu" (cam). */
export const dot = (color: string): CSSProperties => ({ width: 8, height: 8, borderRadius: '50%', background: color })
