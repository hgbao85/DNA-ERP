import type { ReactNode } from 'react'

export interface MobileListItem {
  key: string
  /** Bỏ trống = thẻ chỉ để xem (không bấm được). */
  onClick?: () => void
  title: ReactNode
  /** Nhãn trạng thái góc phải (tuỳ chọn). */
  badge?: ReactNode
  /** Các trường phụ (PO / PI / Hạn giao...) - hiện dạng lưới 2 cột dưới tiêu đề. */
  meta?: { label: string; value: ReactNode }[]
  /** Vùng dưới cùng thẻ (vd nút thao tác) - bấm trong đây KHÔNG kích hoạt onClick của thẻ. */
  footer?: ReactNode
}

/**
 * Danh sách dạng THẺ cho điện thoại (< BREAKPOINT_MOBILE), thay cho các bảng danh sách PI/PO 4-5 cột
 * có cột chiều rộng cố định + chữ không xuống dòng - trên màn hẹp các cột đó đã chiếm hết chỗ, cột
 * SKU co về 0. Chạm thẻ = bấm dòng bảng. Bảng vẫn giữ nguyên trên màn rộng.
 */
export default function MobileListCards({ items, emptyText }: { items: MobileListItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{emptyText}</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(it => (
        <div
          key={it.key}
          className="card"
          role={it.onClick ? 'button' : undefined}
          tabIndex={it.onClick ? 0 : undefined}
          onClick={it.onClick}
          onKeyDown={e => { if (it.onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); it.onClick() } }}
          style={{ padding: '11px 13px', cursor: it.onClick ? 'pointer' : undefined }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontSize: 13, minWidth: 0, wordBreak: 'break-word' }}>{it.title}</div>
            {it.badge && <div style={{ flexShrink: 0 }}>{it.badge}</div>}
          </div>
          {it.meta && it.meta.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 10px', marginTop: 8, fontSize: 12.5 }}>
              {it.meta.map(m => (
                <div key={m.label} style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text3)', fontSize: 10 }}>{m.label}</div>
                  <div style={{ wordBreak: 'break-word', fontFamily: m.label === 'PO' || m.label === 'PI' ? 'monospace' : undefined }}>{m.value}</div>
                </div>
              ))}
            </div>
          )}
          {it.footer && (
            <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>{it.footer}</div>
          )}
        </div>
      ))}
    </div>
  )
}
