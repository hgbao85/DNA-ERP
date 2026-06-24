import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Plus, FileText, Upload, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

// ── Types ────────────────────────────────────────────────────────────────────
interface ExportCustomer { id: number; name: string; country: string }
interface MfgProduct { id: number; name: string }
interface ProductVariant { id: number; colorCode: string; mfgProduct: MfgProduct }
interface ExportOrder {
  id: number
  poNumber: string
  exportCustomer: ExportCustomer
  deliveryDate: string
  status: 'DRAFT' | 'PLANNED' | 'PACKED' | 'DONE' | 'CANCELLED'
  contractFileUrl?: string
  note?: string
  totalValue?: number
  portArrivalDate?: string
  paymentStatus: 'UNPAID' | 'DEPOSITED' | 'PAID'
  items: { productVariant: ProductVariant; quantity: number }[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp', PLANNED: 'Đã lên kế hoạch', PACKED: 'Đã đóng xong · sẵn sàng giao', DONE: 'Hoàn thành', CANCELLED: 'Đã hủy'
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#e65100', PLANNED: '#1565c0', PACKED: '#00838f', DONE: '#2e7d32', CANCELLED: '#757575'
}
const STATUS_BG: Record<string, string> = {
  DRAFT: '#fff3e0', PLANNED: '#e3f2fd', PACKED: '#e0f7fa', DONE: '#e8f5e9', CANCELLED: '#f5f5f5'
}
const PAY_LABEL: Record<string, string> = {
  UNPAID: 'Chưa TT', DEPOSITED: 'Đã cọc', PAID: 'Đã trả đủ'
}
const PAY_COLOR: Record<string, string> = {
  UNPAID: '#c62828', DEPOSITED: '#e65100', PAID: '#2e7d32'
}

// ── Màn "Tổng đơn hàng": danh sách + theo dõi thanh toán + hợp đồng. Tạo đơn ở màn riêng. ──
export default function TongDonHangPage({ onCreateNew }: { onCreateNew?: () => void }) {
  const { data: orders, isLoading, error, refetch } = useFetch(() => api.getExportOrders(), [])
  const safeOrders = Array.isArray(orders) ? (orders as ExportOrder[]) : []

  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [expandedId, setExpandedId]   = useState<number | null>(null)
  const BLANK_PAY = { totalValue: '', portArrivalDate: '', paymentStatus: 'UNPAID' }
  const [payForm, setPayForm]         = useState<Record<number, typeof BLANK_PAY>>({})
  const [savingPay, setSavingPay]     = useState<number | null>(null)

  const handleUpload = async (orderId: number, file: File) => {
    setUploadingId(orderId)
    try {
      const url = await api.uploadContractFile(file)
      await api.updateOrderPayment(orderId, { contractFileUrl: url })
      refetch()
    } finally {
      setUploadingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa đơn hàng này?')) return
    await api.deleteExportOrder(id)
    refetch()
  }

  const openPayForm = (o: ExportOrder) => {
    setPayForm(prev => ({
      ...prev,
      [o.id]: {
        totalValue:      String(o.totalValue ?? ''),
        portArrivalDate: o.portArrivalDate ? o.portArrivalDate.slice(0, 10) : '',
        paymentStatus:   o.paymentStatus,
      }
    }))
    setExpandedId(prev => prev === o.id ? null : o.id)
  }

  const handleSavePay = async (orderId: number) => {
    const f = payForm[orderId]
    if (!f) return
    setSavingPay(orderId)
    try {
      await api.updateOrderPayment(orderId, {
        totalValue:      f.totalValue ? Number(f.totalValue) : undefined,
        portArrivalDate: f.portArrivalDate || undefined,
        paymentStatus:   f.paymentStatus,
      })
      refetch()
      setExpandedId(null)
    } finally {
      setSavingPay(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tổng đơn hàng</h2>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{safeOrders.length} đơn</div>
        </div>
        <button
          onClick={() => onCreateNew?.()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#e65100', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
        >
          <Plus size={15} /> Tạo đơn mới
        </button>
      </div>

      {isLoading && <div style={{ color: 'var(--text3)' }}>Đang tải...</div>}
      {error   && <div style={{ color: '#c62828' }}>Lỗi tải dữ liệu</div>}

      {/* Order table */}
      {safeOrders.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)', background: 'var(--surface2)', borderRadius: 'var(--radius)' }}>
          Chưa có đơn hàng nào. Bấm "+ Tạo đơn mới" để bắt đầu.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {safeOrders.map(o => (
          <div key={o.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {/* Main row */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px 120px auto', gap: 12, padding: '12px 16px', alignItems: 'center' }}>
              {/* PO + status */}
              <div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{o.poNumber}</div>
                <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: STATUS_BG[o.status], color: STATUS_COLOR[o.status] }}>
                  {STATUS_LABEL[o.status]}
                </span>
              </div>

              {/* Customer + products */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.exportCustomer?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {o.items.map(i => `${i.productVariant?.mfgProduct?.name} ×${i.quantity}`).join(', ')}
                </div>
              </div>

              {/* Delivery date */}
              <div style={{ fontSize: 12 }}>
                <div style={{ color: 'var(--text3)' }}>Giao hàng</div>
                <div style={{ fontWeight: 600 }}>{format(new Date(o.deliveryDate), 'dd/MM/yyyy')}</div>
              </div>

              {/* Payment status */}
              <div style={{ fontSize: 12 }}>
                <div style={{ color: 'var(--text3)' }}>Thanh toán</div>
                <div style={{ fontWeight: 600, color: PAY_COLOR[o.paymentStatus] }}>{PAY_LABEL[o.paymentStatus]}</div>
                {o.totalValue != null && <div style={{ color: 'var(--text3)', fontSize: 11 }}>{o.totalValue.toLocaleString()} USD</div>}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Contract */}
                {o.contractFileUrl
                  ? <a href={o.contractFileUrl} target="_blank" rel="noreferrer" title="Xem hợp đồng" style={{ color: '#1565c0', display: 'flex' }}><FileText size={16}/></a>
                  : (
                    <label title="Upload hợp đồng" style={{ cursor: 'pointer', display: 'flex', color: 'var(--text3)' }}>
                      <Upload size={16}/>
                      <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" style={{ display: 'none' }}
                        onChange={e => { if (e.target.files?.[0]) handleUpload(o.id, e.target.files[0]) }}
                      />
                    </label>
                  )}

                {/* Toggle payment panel */}
                <button onClick={() => openPayForm(o)} title="Theo dõi thanh toán"
                  style={{ padding: '4px 8px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
                  TT {expandedId === o.id ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                </button>

                {/* Delete (DRAFT only) */}
                {o.status === 'DRAFT' && (
                  <button onClick={() => handleDelete(o.id)} title="Xóa đơn"
                    style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#c62828', display: 'flex' }}>
                    <Trash2 size={15}/>
                  </button>
                )}

                {uploadingId === o.id && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Đang upload...</span>}
              </div>
            </div>

            {/* Payment panel */}
            {expandedId === o.id && (() => {
              const pf = payForm[o.id]
              if (!pf) return null
              return (
                <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Giá trị (USD)</label>
                      <input type="number" value={pf.totalValue}
                        onChange={e => setPayForm(prev => ({ ...prev, [o.id]: { ...(prev[o.id] ?? BLANK_PAY), totalValue: e.target.value } }))}
                        style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, width: 130 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Ngày đến cảng</label>
                      <input type="date" value={pf.portArrivalDate}
                        onChange={e => setPayForm(prev => ({ ...prev, [o.id]: { ...(prev[o.id] ?? BLANK_PAY), portArrivalDate: e.target.value } }))}
                        style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Trạng thái TT</label>
                      <select value={pf.paymentStatus}
                        onChange={e => setPayForm(prev => ({ ...prev, [o.id]: { ...(prev[o.id] ?? BLANK_PAY), paymentStatus: e.target.value } }))}
                        style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                        <option value="UNPAID">Chưa thanh toán</option>
                        <option value="DEPOSITED">Đã cọc</option>
                        <option value="PAID">Đã trả đủ</option>
                      </select>
                    </div>
                    <button onClick={() => handleSavePay(o.id)} disabled={savingPay === o.id}
                      style={{ padding: '7px 14px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      {savingPay === o.id ? 'Đang lưu...' : 'Lưu'}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        ))}
      </div>
    </div>
  )
}
