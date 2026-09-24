import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import type { SalesCustomer, SalesOrder } from '../../../types/sales'
import { StatusBadge } from './StatusBadge'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import SearchableSelect from '../../../components/SearchableSelect'

export default function PurchaseHistoryPage() {
  const { data: customers } = useFetch<SalesCustomer[]>(() => api.getSalesCustomers())
  const { data: pos, isLoading, error } = useFetch<SalesOrder[]>(() => api.getSalesOrders())
  const [customerId, setCustomerId] = useState('')
  const isMobile = useIsMobile()

  const customer = (customers ?? []).find((c) => String(c.id) === customerId) ?? null
  const customerPOs = customer ? (pos ?? []).filter((p) => p.customerId === String(customer.id)) : []
  const rows = customerPOs.flatMap((po) => po.items.map((item) => ({ po, item })))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Lịch sử mua hàng</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Chọn khách hàng để xem lịch sử mua hàng</div>
      </div>

      <div style={{ marginBottom: 20, maxWidth: isMobile ? '100%' : 320 }}>
        {/* Không dùng <select> gốc: danh sách xổ do trình duyệt vẽ, không theo khung màn hình
            hẹp - dùng chung ô tìm-để-chọn với form Tạo PO (danh sách nằm gọn dưới ô, gõ lọc được). */}
        <SearchableSelect
          displayValue={customer?.name ?? ''}
          options={customers ?? []}
          getKey={(c) => String(c.id)}
          getSearchText={(c) => `${c.name} ${c.phone}`}
          renderOption={(c) => <><strong>{c.name}</strong> <span style={{ color: 'var(--text3)' }}>— {c.phone}</span></>}
          onSelect={(c) => setCustomerId(String(c.id))}
          placeholder="Tìm hoặc chọn khách hàng"
          emptyText="Không tìm thấy khách hàng"
        />
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
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map(({ po, item }) => (
                <div key={item.id} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--blue)', wordBreak: 'break-word' }}>{po.orderCode}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{format(new Date(po.orderDate), 'dd/MM/yyyy')}</div>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div style={{ fontSize: 13, marginTop: 8, wordBreak: 'break-word' }}>
                    {item.skuCode}{item.skuName ? <span style={{ color: 'var(--text3)' }}> — {item.skuName}</span> : ''}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 8, fontSize: 12 }}>
                    <div><div style={{ color: 'var(--text3)', fontSize: 10 }}>Tổng số</div>{item.totalQty.toLocaleString()}</div>
                    <div><div style={{ color: 'var(--text3)', fontSize: 10 }}>Đã xuất</div>{item.shippedQty.toLocaleString()}</div>
                    <div><div style={{ color: 'var(--text3)', fontSize: 10 }}>Còn lại</div><b>{(item.totalQty - item.shippedQty).toLocaleString()}</b></div>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Chưa có PO nào</div>
              )}
            </div>
          ) : (
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
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--blue)' }}>{po.orderCode}</td>
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
          )}
        </>
      )}
    </div>
  )
}
