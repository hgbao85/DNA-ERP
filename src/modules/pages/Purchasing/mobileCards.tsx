'use client'
import type { ReactNode } from 'react'
import type { PurchaseProposal } from '../../../context/InspectionContext'

/**
 * Khối dựng dùng chung cho 3 màn Mua hàng trên điện thoại (< BREAKPOINT_MOBILE): thẻ thay bảng -
 * cùng idiom Sales/PurchaseHistoryPage. Bảng giữ nguyên trên màn rộng.
 */

/** Thẻ 1 đề xuất ở màn danh sách (thay 1 dòng bảng PO/PI/Mã nhà máy/...). */
export function ProposalCards({ proposals, onSelect, badge, meta }: {
  proposals: PurchaseProposal[]
  onSelect: (id: string) => void
  badge?: (p: PurchaseProposal) => ReactNode
  meta?: (p: PurchaseProposal) => ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {proposals.map(p => (
        <div key={p.id} className="card" onClick={() => onSelect(p.id)} style={{ padding: '12px 14px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-word' }}>{p.salesOrderCode ?? '—'}</div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)', marginTop: 2, wordBreak: 'break-word' }}>{p.piCode}</div>
            </div>
            {badge?.(p)}
          </div>
          <div style={{ fontSize: 13, marginTop: 8, wordBreak: 'break-word' }}>
            <span style={{ fontWeight: 600 }}>{p.skuCode}</span>
            {p.skuName && <span style={{ color: 'var(--text3)' }}> — {p.skuName}</span>}
          </div>
          {meta && <div style={{ fontSize: 12, marginTop: 6 }}>{meta(p)}</div>}
        </div>
      ))}
    </div>
  )
}

/** Thẻ 1 dòng vật tư ở màn chi tiết: tên + quy cách + chiều dài cây, rồi lưới các số liệu. */
export function ItemCard({ name, spec, stockLengthMm, fields, footer }: {
  name: string
  spec?: string | null
  stockLengthMm?: number | null
  fields: { label: string; value: ReactNode }[]
  footer?: ReactNode
}) {
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ fontWeight: 600, fontSize: 14, wordBreak: 'break-word' }}>{name}</div>
      {(spec || stockLengthMm != null) && (
        <div style={{ fontSize: 12, marginTop: 2, color: 'var(--text3)' }}>
          {spec}
          {stockLengthMm != null && (
            <span style={{ fontWeight: 700, color: '#e65100' }}>{spec ? ' · ' : ''}cây {stockLengthMm}mm</span>
          )}
        </div>
      )}
      {fields.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10, fontSize: 13 }}>
          {fields.map(f => (
            <div key={f.label} style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--text3)', fontSize: 10 }}>{f.label}</div>
              <div style={{ wordBreak: 'break-word' }}>{f.value}</div>
            </div>
          ))}
        </div>
      )}
      {footer && <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>{footer}</div>}
    </div>
  )
}
