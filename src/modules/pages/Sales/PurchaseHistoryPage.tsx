import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import type { SalesCustomer, SalesPO } from '../../../types/sales'
import { StatusBadge } from './StatusBadge'

export default function PurchaseHistoryPage() {
  const { data: customers } = useFetch<SalesCustomer[]>(() => api.getSalesCustomers())
  const { data: pos, isLoading, error } = useFetch<SalesPO[]>(() => api.getSalesPOs())
  const [customerId, setCustomerId] = useState('')

  const customer = (customers ?? []).find((c) => String(c.id) === customerId) ?? null
  const customerPOs = customer ? (pos ?? []).filter((p) => p.customerId === customer.id) : []
  const rows = customerPOs.flatMap((po) => po.items.map((item) => ({ po, item })))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Lịch sử mua hàng</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Chọn khách hàng để xem lịch sử mua hàng</div>
      </div>

      <div style={{ marginBottom: 20, maxWidth: 320 }}>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">— Chọn khách hàng —</option>
          {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>}
      {error && <div style={{ padding: 40, color: '#E24B4A' }}>Lỗi: {error}</div>}

      {!isLoading && !error && !customer && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Chọn một khách hàng để xem lịch sử mua hàng</div>
      )}

      {!isLoading && !error && customer && (
        <>
          <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text3)' }}>
            {customer.phone}{customer.address ? ` · ${customer.address}` : ''} · {customerPOs.length} PO đã mua
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  {['PO', 'Ngày đặt', 'SKU', 'Tổng số', 'Đã xuất', 'Còn lại', 'Trạng thái'].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ po, item }) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--blue)' }}>{po.code}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{format(new Date(po.orderDate), 'dd/MM/yyyy')}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{item.skuCode}{item.skuName ? <span style={{ color: 'var(--text3)' }}> — {item.skuName}</span> : ''}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{item.totalQty.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{item.shippedQty.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{(item.totalQty - item.shippedQty).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Chưa có PO nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
