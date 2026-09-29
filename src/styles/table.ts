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

/** Layout styles dùng chung trong các trang kho.
 *  tableWrap cuộn ngang (không cắt) + tbl có sàn minWidth: trên điện thoại bảng cuộn trong khung thay vì
 *  bị bóp cột tới mức chữ vỡ từng từ hoặc cột bên phải bị cắt mất. Desktop luôn rộng hơn sàn nên không đổi. */
export const tableWrap: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }
export const tbl: CSSProperties       = { width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }
export const row: CSSProperties       = { borderTop: '1px solid var(--border)', cursor: 'pointer' }
export const badge: CSSProperties     = { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }
export const emptyBox: CSSProperties  = { padding: 48, textAlign: 'center', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }

/** Khung cuộn RIÊNG cho phần <table> khi muốn header dính (sticky) - áp vào div bọc TRỰC TIẾP
 *  <table>, KHÔNG áp vào tableWrap ngoài cùng nếu wrap đó còn chứa footer/phân trang (footer sẽ bị
 *  cuộn mất theo nếu đặt maxHeight ở tableWrap). overflowX ở đây thay thế luôn overflowX của
 *  tableWrap (dùng 1 trong 2, không lồng 2 lớp overflow-x cùng lúc - dễ ra 2 thanh cuộn ngang).
 *  maxHeight 70vh: bảng ngắn hơn khung nhìn KHÔNG đổi gì (không có gì để cuộn); chỉ bảng dài hơn mới
 *  tự cuộn bên trong với <thead> (stickyHeaderRow) luôn dính trên cùng - tránh phải cuộn cả trang lên
 *  lại để xem tên cột. */
export const tableScrollBox: CSSProperties = { overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh' }

/** Header <tr> dính khi cuộn bên trong tableScrollBox - ghép vào tr bọc <th> (`<tr style={stickyHeaderRow}>`).
 *  Nền PHẢI đặt ở đây (không phải từng <th>) vì <tr> trong suốt để lộ nội dung cuộn phía dưới đè lên chữ. */
export const stickyHeaderRow: CSSProperties = { position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface2)' }
