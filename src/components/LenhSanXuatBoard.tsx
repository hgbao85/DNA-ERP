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

export default function LenhSanXuatBoard<T>(p: LenhSanXuatBoardProps<T>) {
  return (
    <div>
      {p.onBack && (
        <button onClick={p.onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 14, fontSize: 13 }}>
          <ChevronLeft size={15} /> {p.backLabel ?? 'Quay lại'}
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {p.icon && (
          <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: '#fff3e0', color: '#e65100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {p.icon}
          </div>
        )}
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>{p.title}</h2>
          {p.subtitle && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.subtitle}</div>}
        </div>
      </div>

      {p.beforeTable}

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
              <tr><td colSpan={p.columns.length} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>{p.emptyText ?? 'Không có dữ liệu.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {p.footer && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>{p.footer}</div>}
    </div>
  )
}

const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const trh: React.CSSProperties = { background: 'var(--surface2)', textAlign: 'left' }
const trb: React.CSSProperties = { borderTop: '1px solid var(--border)', transition: 'background .1s' }
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--text)' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
