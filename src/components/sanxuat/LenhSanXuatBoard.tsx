'use client'

/**
 * KHUNG BẢNG dùng chung (presentational, generic) — KHÔNG chứa nghiệp vụ/data.
 * Màn nào cần (Lệnh sản xuất Phôi/Hàn/Sơn, Xuất dán…) thì truyền `columns` + `rows` vào (map field).
 *
 *   <LenhSanXuatBoard
 *     title="…" columns={cols} rows={data} rowKey={r => r.id}
 *     rowTone={r => r.lech ? 'alert' : 'default'}
 *     clickable={r => r.canEnter} onRowClick={r => …}
 *   />
 */

import { Fragment, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useIsMobile } from '../../hooks/useMediaQuery'

export interface BoardColumn<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right'
  width?: number
  cell: (row: T) => ReactNode
}

// default = thường · alert = nền đỏ (cảnh báo) · muted = mờ + khoá (không bấm được)
export type RowTone = 'default' | 'alert' | 'muted'

export interface LenhSanXuatBoardProps<T> {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  onBack?: () => void
  backLabel?: string
  headerRight?: ReactNode          // slot góc trên phải (vd nút Lịch sử)
  beforeTable?: ReactNode          // slot phía trên bảng (vd banner đồng bộ)
  columns: BoardColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  rowTone?: (row: T) => RowTone
  clickable?: (row: T) => boolean
  onRowClick?: (row: T) => void
  rowTitle?: (row: T) => string
  expandedRow?: (row: T) => ReactNode | null   // trả nội dung để bung dòng chi tiết dưới mỗi dòng
  emptyText?: string
  footer?: ReactNode
}

const toneBg: Record<RowTone, string> = { default: 'transparent', alert: 'var(--red-bg)', muted: 'transparent' }

// Thẻ (điện thoại): cột rộng (thanh tiến độ, ô nhập, nút thao tác) hoặc không có tiêu đề -> chiếm trọn 1 hàng
// của lưới thay vì bị ép vào nửa thẻ.
const isWideCol = <T,>(c: BoardColumn<T>) => (c.width ?? 0) >= 150 || c.header === '' || c.header == null

export default function LenhSanXuatBoard<T>(p: LenhSanXuatBoardProps<T>) {
  // Điện thoại: mỗi dòng thành 1 thẻ (cột đầu = tiêu đề, các cột còn lại = cặp nhãn/giá trị) - cùng 1
  // `columns` nên mọi màn dùng board (Lệnh SX Phôi/Hàn/Sơn, KCS, chi tiết vật tư...) tự có bản điện thoại.
  const isMobile = useIsMobile()
  const [firstCol, ...restCols] = p.columns
  return (
    <div>
      {p.onBack && (
        <button onClick={p.onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 14, fontSize: 13 }}>
          <ChevronLeft size={15} /> {p.backLabel ?? 'Quay lại'}
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        {p.icon && (
          <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: 'var(--bg-fff3e0)', color: 'var(--fg-e65100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {p.icon}
          </div>
        )}
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <h2 style={{ fontSize: 'clamp(16px, 4.5vw, 19px)', fontWeight: 800 }}>{p.title}</h2>
          {p.subtitle && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.subtitle}</div>}
        </div>
        {p.headerRight && <div style={{ marginLeft: 'auto' }}>{p.headerRight}</div>}
      </div>

      {p.beforeTable}

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {p.rows.map(row => {
            const tone = p.rowTone?.(row) ?? 'default'
            const canClick = p.clickable?.(row) ?? !!p.onRowClick
            const expanded = p.expandedRow?.(row)
            return (
              <div
                key={p.rowKey(row)}
                className="card"
                role={canClick ? 'button' : undefined}
                tabIndex={canClick ? 0 : undefined}
                title={p.rowTitle?.(row)}
                onClick={() => canClick && p.onRowClick?.(row)}
                onKeyDown={e => { if (canClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.onRowClick?.(row) } }}
                style={{
                  padding: '11px 13px', overflow: 'hidden',
                  cursor: canClick ? 'pointer' : tone === 'muted' ? 'not-allowed' : 'default',
                  opacity: tone === 'muted' ? 0.55 : 1,
                  background: tone === 'alert' ? toneBg.alert : undefined,
                  borderColor: tone === 'alert' ? 'var(--fg-f0c1c1)' : undefined,
                }}
              >
                {firstCol && <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>{firstCol.cell(row)}</div>}
                {restCols.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px', marginTop: 8, fontSize: 13 }}>
                    {restCols.map(c => (
                      <div key={c.key} style={{ minWidth: 0, gridColumn: isWideCol(c) ? '1 / -1' : undefined }}>
                        {c.header !== '' && c.header != null && <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 1 }}>{c.header}</div>}
                        <div style={{ wordBreak: 'break-word' }}>{c.cell(row)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {expanded && (
                  <div style={{ margin: '10px -13px -11px', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>{expanded}</div>
                )}
              </div>
            )
          })}
          {p.rows.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{p.emptyText ?? 'Không có dữ liệu.'}</div>
          )}
        </div>
      ) : (
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 14 }}>
        <table style={tbl}>
          <thead><tr style={trh}>
            {p.columns.map(c => (
              <th key={c.key} style={{ ...(c.align === 'right' ? thR : th), ...(c.width ? { width: c.width } : {}) }}>{c.header}</th>
            ))}
          </tr></thead>
          <tbody>
            {p.rows.map(row => {
              const tone = p.rowTone?.(row) ?? 'default'
              const bg = toneBg[tone]
              const canClick = p.clickable?.(row) ?? !!p.onRowClick
              const expanded = p.expandedRow?.(row)
              return (
                <Fragment key={p.rowKey(row)}>
                  <tr
                    onClick={() => canClick && p.onRowClick?.(row)}
                    title={p.rowTitle?.(row)}
                    style={{ ...trb, cursor: canClick ? 'pointer' : tone === 'muted' ? 'not-allowed' : 'default', opacity: tone === 'muted' ? 0.55 : 1, background: bg }}
                    onMouseEnter={e => { if (canClick) e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = bg }}
                  >
                    {p.columns.map(c => <td key={c.key} style={c.align === 'right' ? tdR : td}>{c.cell(row)}</td>)}
                  </tr>
                  {expanded && (
                    <tr><td colSpan={p.columns.length} style={{ padding: 0 }}>{expanded}</td></tr>
                  )}
                </Fragment>
              )
            })}
            {p.rows.length === 0 && (
              <tr><td colSpan={p.columns.length} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}><div className="table-empty-msg">{p.emptyText ?? 'Không có dữ liệu.'}</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}


      {p.footer && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>{p.footer}</div>}
    </div>
  )
}

// minWidth: dưới khổ này khung overflowX cuộn ngang thay vì bóp cột tới mức chữ vỡ từng từ (điện thoại).
const tbl: React.CSSProperties = { width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 13 }
const trh: React.CSSProperties = { background: 'var(--surface2)', textAlign: 'left' }
const trb: React.CSSProperties = { borderTop: '1px solid var(--border)', transition: 'background .1s' }
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--text)' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
