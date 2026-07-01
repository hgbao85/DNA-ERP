import type { CSSProperties } from 'react'

/** Style dùng chung cho <th>/<td> của các bảng chi tiết (vật tư, lệnh mua...) — tránh khai báo lặp lại ở mỗi trang. */
export const th: CSSProperties = { padding: '9px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
export const td: CSSProperties = { padding: '9px 14px' }

/** Style dùng chung cho <th>/<td> của các bảng danh sách SKU (cột rộng hơn, màu nhạt hơn). */
export const listTh: CSSProperties = { padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
export const listTd: CSSProperties = { padding: '11px 14px' }
