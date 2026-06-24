import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import { X, AlertCircle, FileText, Package } from 'lucide-react'

const ORDER_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Chờ lên kế hoạch', PLANNED: 'Đã tạo Lệnh SX', PACKED: 'Đã đóng gói', DONE: 'Đã giao', CANCELLED: 'Đã hủy',
}
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Chưa thanh toán', DEPOSITED: 'Đã cọc', PAID: 'Đã trả đủ',
}
const fmtMoney = (n: number | null | undefined) => n == null ? '—' : `${Number(n).toLocaleString('vi-VN')} đ`

interface Props {
  orderId: number
  onClose: () => void
}

/** Modal xem chi tiết Đơn hàng (ExportOrder) — tái dùng ở màn Lệnh SX (A) và PIDetailPanel (B). */
export default function ExportOrderDetailModal({ orderId, onClose }: Props) {
  const { data: order, isLoading, error } = useFetch(() => api.getExportOrder(orderId), [orderId])

  const debt = order && order.totalValue != null
    ? Math.max(0, Number(order.totalValue) - Number(order.depositAmount ?? 0))
    : null

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 24, width: 540, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={18} color="#e65100" /> Chi tiết đơn hàng
          </h3>
          <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={18} color="var(--text3)" />
          </button>
        </div>

        {isLoading && <div style={{ color: 'var(--text3)' }}>Đang tải...</div>}
        {error && <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải đơn hàng</div>}

        {order && (
          <>
            {/* Thông tin chung */}
            <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                <div><span style={{ color: 'var(--text3)' }}>PO: </span><strong style={{ fontFamily: 'monospace' }}>{order.poNumber}</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>Trạng thái: </span><strong>{ORDER_STATUS_LABEL[order.status] ?? order.status}</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>Khách hàng: </span><strong>{order.exportCustomer?.name ?? '—'}</strong>{order.exportCustomer?.country ? ` (${order.exportCustomer.country})` : ''}</div>
                <div><span style={{ color: 'var(--text3)' }}>Ngày giao: </span><strong>{format(new Date(order.deliveryDate), 'dd/MM/yyyy')}</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>Tạo bởi: </span><strong>{order.createdBy?.name ?? '—'}</strong></div>
                <div>
                  <span style={{ color: 'var(--text3)' }}>Hợp đồng: </span>
                  {order.contractFileUrl
                    ? <a href={order.contractFileUrl} target="_blank" rel="noreferrer" style={{ color: '#1565c0', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={13} /> Xem</a>
                    : <span style={{ color: 'var(--text3)' }}>chưa có</span>}
                </div>
              </div>
              {order.note && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)' }}>Ghi chú: {order.note}</div>}
            </div>

            {/* Sản phẩm + quy cách đóng thùng */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Sản phẩm ({order.items?.length ?? 0})</h4>
              {(order.items ?? []).map((it: any) => (
                <div key={it.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{it.productVariant?.mfgProduct?.name}{it.productVariant?.colorCode ? ` — ${it.productVariant.colorCode}` : ''}</span>
                    <strong>×{it.quantity}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    Đóng gói: {it.boxesPerSet ?? 1} thùng/bộ{it.boxNote ? ` · ${it.boxNote}` : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Tài chính */}
            {(order.totalValue != null || order.depositAmount != null) && (
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 16, fontSize: 13 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><span style={{ color: 'var(--text3)' }}>Giá trị đơn: </span><strong>{fmtMoney(order.totalValue)}</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>Đã cọc: </span><strong>{fmtMoney(order.depositAmount)}</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>Công nợ: </span><strong style={{ color: debt && debt > 0 ? '#c62828' : '#2e7d32' }}>{fmtMoney(debt)}</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>Thanh toán: </span><strong>{PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}</strong></div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
