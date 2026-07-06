import type { CSSProperties } from 'react'

/** Nút phụ (Hủy/Đóng...) dùng chung trong các modal — tránh khai báo lặp lại ở mỗi trang. */
export const btnSecondary: CSSProperties = {
  padding: '8px 18px', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, fontSize: 13, cursor: 'pointer',
}

/** Nút Quay lại dùng trong trang chi tiết kho. */
export const backBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
  fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer',
}

/** Tab button dùng trong trang kho (active/inactive với accent màu tùy kho). */
export function tabBtn(active: boolean, accent: string): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px', fontSize: 13,
    fontWeight: active ? 700 : 500, background: 'transparent', border: 'none', cursor: 'pointer',
    color: active ? accent : 'var(--text2)',
    borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
    marginBottom: -1,
  }
}
