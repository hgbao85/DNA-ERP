import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getOrders } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import type { Order } from '../types'
import { Users, Building2, FileText, Truck } from 'lucide-react'

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Done:       { bg: '#dcfce7', color: '#15803d' },
  Processing: { bg: '#dbeafe', color: '#1d4ed8' },
  Pending:    { bg: '#fef3c7', color: '#b45309' },
  Cancelled:  { bg: '#fee2e2', color: '#dc2626' },
}

function statusBadge(status: string) {
  const s = STATUS_STYLE[status] ?? { bg: 'var(--surface2)', color: 'var(--text2)' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: s.bg, color: s.color }}>
      {status}
    </span>
  )
}

function paymentColor(p: number) {
  if (p >= 100) return '#15803d'
  if (p === 0) return '#dc2626'
  return '#1d4ed8'
}

interface OrderTableProps {
  orders: Order[]
}

function OrderTable({ orders }: OrderTableProps) {
  if (orders.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        Chưa có đơn hàng nào
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 1000 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
            {['Mã đơn', 'Khách hàng', 'SĐT', 'Ngày đặt', 'Chi tiết', 'SL', 'Tổng (VNĐ)', 'Thanh toán', 'Kênh', 'Ngày giao', 'Trạng thái', 'Tệp đính kèm'].map(h => (
              <th key={h} style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o: Order) => (
            <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <td style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--blue)', whiteSpace: 'nowrap', fontSize: 12 }}>{o.id}</td>
              <td style={{ padding: '10px 10px', fontWeight: 500, fontSize: 13 }}>{o.customerName}</td>
              <td style={{ padding: '10px 10px', fontSize: 12 }}>{o.phone}</td>
              <td style={{ padding: '10px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>{format(new Date(o.date), 'dd/MM/yyyy')}</td>
              <td style={{ padding: '10px 10px', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.details}</td>
              <td style={{ padding: '10px 10px', fontSize: 12, textAlign: 'center' }}>{o.quantity}</td>
              <td style={{ padding: '10px 10px', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{o.total.toLocaleString()}</td>
              <td style={{ padding: '10px 10px', fontWeight: 700, fontSize: 12, color: paymentColor(o.paymentPercent) }}>
                {o.paymentPercent}%
              </td>
              <td style={{ padding: '10px 10px', fontSize: 11 }}>
                {o.platform
                  ? <span style={{ padding: '2px 7px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 11 }}>{o.platform}</span>
                  : <span style={{ color: 'var(--text3)' }}>—</span>
                }
              </td>
              <td style={{ padding: '10px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>
                {o.deliveryDate ? format(new Date(o.deliveryDate), 'dd/MM/yyyy') : <span style={{ color: 'var(--text3)' }}>—</span>}
              </td>
              <td style={{ padding: '10px 10px' }}>{statusBadge(o.status)}</td>
              <td style={{ padding: '10px 10px' }}>
                {!o.quotationUrl && !o.deliveryProofUrl
                  ? <span style={{ color: 'var(--text3)' }}>—</span>
                  : <div style={{ display: 'flex', gap: 6 }}>
                      {o.quotationUrl && (
                        <a href={o.quotationUrl} target="_blank" rel="noreferrer"
                          title="Báo giá"
                          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--blue)', textDecoration: 'none', padding: '2px 7px', border: '1px solid var(--blue)', borderRadius: 6 }}>
                          <FileText size={11} /> Báo giá
                        </a>
                      )}
                      {o.deliveryProofUrl && (
                        <a href={o.deliveryProofUrl} target="_blank" rel="noreferrer"
                          title="Biên nhận giao hàng"
                          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#15803d', textDecoration: 'none', padding: '2px 7px', border: '1px solid #bbf7d0', borderRadius: 6 }}>
                          <Truck size={11} /> Giao hàng
                        </a>
                      )}
                    </div>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function OrderTracking() {
  const { user } = useAuth()
  const isManager = user?.role === 'MANAGER'

  const isSalesWholesale = user?.role === 'SALES' && user?.salesType === 'WHOLESALE'

  const { data: orders, isLoading, error } = useFetch<Order[]>(getOrders)
  const [activeTab, setActiveTab] = useState<'RETAIL' | 'WHOLESALE'>(isSalesWholesale ? 'WHOLESALE' : 'RETAIL')

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải đơn hàng...</div>
  if (error) return <div style={{ padding: 40, color: '#E24B4A' }}>Lỗi: {error}</div>

  const allOrders = orders ?? []
  const retail = allOrders.filter(o => o.orderType === 'RETAIL')
  const wholesale = allOrders.filter(o => o.orderType === 'WHOLESALE')
  const displayed = activeTab === 'RETAIL' ? retail : wholesale

  const tabs = isManager
    ? [
        { id: 'RETAIL' as const,     label: 'Khách lẻ', icon: <Users size={14} />,     count: retail.length },
        { id: 'WHOLESALE' as const,  label: 'Khách sỉ', icon: <Building2 size={14} />, count: wholesale.length },
      ]
    : isSalesWholesale
    ? [{ id: 'WHOLESALE' as const,   label: 'Khách sỉ', icon: <Building2 size={14} />, count: wholesale.length }]
    : [{ id: 'RETAIL' as const,      label: 'Khách lẻ', icon: <Users size={14} />,     count: retail.length }]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Theo dõi Đơn hàng</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{allOrders.length} đơn hàng</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', border: 'none',
              borderBottom: activeTab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === t.id ? 'var(--blue)' : 'var(--text3)',
              fontWeight: activeTab === t.id ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
            }}>
            {t.icon}
            {t.label}
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
              background: activeTab === t.id ? 'var(--blue-bg)' : 'var(--surface2)',
              color: activeTab === t.id ? 'var(--blue)' : 'var(--text3)',
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <OrderTable orders={displayed} />
      </div>
    </div>
  )
}
