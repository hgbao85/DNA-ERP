import type { SalesPOStatus } from '../../../types/sales'
import { SALES_PO_STATUS_LABEL } from '../../../types/sales'

export const SALES_PO_STATUS_COLOR: Record<SalesPOStatus, { bg: string; color: string }> = {
  MUA_HANG: { bg: '#f3e5f5', color: '#7b1fa2' },
  KHUNG_CO_KHI: { bg: '#fff3e0', color: '#e65100' },
  DAN: { bg: '#ede7f6', color: '#4527a0' },
  CHUYEN_KIEM: { bg: '#e1f5fe', color: '#0277bd' },
  DONG_GOI: { bg: '#e3f2fd', color: '#1565c0' },
  HOAN_THANH: { bg: '#dcfce7', color: '#15803d' },
}

export function StatusBadge({ status }: { status: SalesPOStatus }) {
  const s = SALES_PO_STATUS_COLOR[status]
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: s.bg, color: s.color }}>
      {SALES_PO_STATUS_LABEL[status]}
    </span>
  )
}
