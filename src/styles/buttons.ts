import type { CSSProperties } from 'react'

/** Nút phụ (Hủy/Đóng...) dùng chung trong các modal — tránh khai báo lặp lại ở mỗi trang. */
export const btnSecondary: CSSProperties = {
  padding: '8px 18px', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, fontSize: 13, cursor: 'pointer',
}
