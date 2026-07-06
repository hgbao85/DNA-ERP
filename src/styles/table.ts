import type { CSSProperties } from 'react'

/** Style dùng chung cho <th>/<td> của các bảng chi tiết (vật tư, lệnh mua...) — tránh khai báo lặp lại ở mỗi trang. */
export const th: CSSProperties = { padding: '9px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
export const td: CSSProperties = { padding: '9px 14px' }

/** Style dùng chung cho <th>/<td> của các bảng danh sách SKU (cột rộng hơn, màu nhạt hơn). */
export const listTh: CSSProperties = { padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
export const listTd: CSSProperties = { padding: '11px 14px' }

/** Compact variant dùng trong các trang kho (nhập/xuất) — padding nhỏ hơn để vừa nhiều cột. */
export const compactTh: CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
export const compactTd: CSSProperties = { padding: '8px 12px', color: 'var(--text)' }

/** Layout styles dùng chung trong các trang kho. */
export const tableWrap: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
export const tbl: CSSProperties       = { width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }
export const row: CSSProperties       = { borderTop: '1px solid var(--border)', cursor: 'pointer' }
export const badge: CSSProperties     = { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }
export const emptyBox: CSSProperties  = { padding: 48, textAlign: 'center', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }
