import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import {
  getQuotations, createQuotation, submitQuotation,
  approveQuotation, rejectQuotation,
  getRetailCustomers, getWholesaleCustomers, getProducts, getPromotions,
} from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import type { Quotation, RetailCustomer, WholesaleCustomer, Product, Promotion } from '../../../types'
import { Plus, X, CheckCircle, XCircle, ChevronRight, Send, Receipt, Bell } from 'lucide-react'

// ─── Notification Banner ────────────────────────────────────────────────────

const SEEN_KEY = 'quotation_seen_ids'

function getSeenIds(): number[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') } catch { return [] }
}
function markSeen(ids: number[]) {
  const existing = getSeenIds()
  localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...existing, ...ids])]))
}

function NotificationBanner({ quotations }: { quotations: Quotation[] }) {
  const seenIds = getSeenIds()
  const sevenDaysAgo = useMemo(() => Date.now() - 7 * 24 * 60 * 60 * 1000, [])

  const fresh = quotations.filter(q =>
    (q.status === 'APPROVED' || q.status === 'REJECTED') &&
    q.createdAt &&
    !seenIds.includes(q.id) &&
    new Date(q.createdAt).getTime() > sevenDaysAgo
  )

  const [dismissed, setDismissed] = useState(false)

  if (dismissed || fresh.length === 0) return null

  const approved = fresh.filter(q => q.status === 'APPROVED')
  const rejected = fresh.filter(q => q.status === 'REJECTED')

  const handleDismiss = () => {
    markSeen(fresh.map(q => q.id))
    setDismissed(true)
  }

  return (
    <div style={{
      marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius)',
      background: '#eff6ff', border: '1px solid #bfdbfe',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <Bell size={16} color="#1d4ed8" style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#1d4ed8', marginBottom: 6 }}>
          {fresh.length} báo giá vừa được xử lý
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {approved.map(q => (
            <div key={q.id} style={{ fontSize: 12, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={12} />
              <span><strong>{q.code}</strong> đã được duyệt → Đơn hàng <strong>{q.orderId}</strong></span>
            </div>
          ))}
          {rejected.map(q => (
            <div key={q.id} style={{ fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
              <XCircle size={12} />
              <span><strong>{q.code}</strong> bị từ chối{q.rejectReason ? `: ${q.rejectReason}` : ''}</span>
            </div>
          ))}
        </div>
      </div>
      <button onClick={handleDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8', padding: 0, flexShrink: 0 }}>
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối',
}
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  DRAFT:    { background: '#f3f4f6', color: '#6b7280' },
  PENDING:  { background: '#fef9c3', color: '#b45309' },
  APPROVED: { background: '#dcfce7', color: '#15803d' },
  REJECTED: { background: '#fee2e2', color: '#dc2626' },
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, ...STATUS_STYLE[status] }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ─── Reject Modal ────────────────────────────────────────────────────────────

function RejectModal({ onConfirm, onClose }: { onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 420, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Lý do từ chối</div>
        <textarea
          value={reason} onChange={e => setReason(e.target.value)}
          rows={3} placeholder="Nhập lý do từ chối báo giá..."
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer' }}>Hủy</button>
          <button onClick={() => onConfirm(reason)} disabled={!reason.trim()}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 'var(--radius)', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: reason.trim() ? 'pointer' : 'not-allowed' }}>
            Từ chối
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Create Form ─────────────────────────────────────────────────────────────

type ItemRow = { productId: string; quantity: number; unitPrice: number }

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: products = [] } = useFetch<Product[]>(getProducts)
  const { data: retailList = [] } = useFetch<RetailCustomer[]>(getRetailCustomers)
  const { data: wholesaleList = [] } = useFetch<WholesaleCustomer[]>(getWholesaleCustomers)
  const { data: promotions = [] } = useFetch<Promotion[]>(getPromotions)

  const safeProducts = Array.isArray(products) ? products : []
  const safeRetail = Array.isArray(retailList) ? retailList : []
  const safeWholesale = Array.isArray(wholesaleList) ? wholesaleList : []
  const safePromotions = Array.isArray(promotions) ? promotions : []

  const [orderType, setOrderType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [promotionId, setPromotionId] = useState<number | ''>('')
  const [items, setItems] = useState<ItemRow[]>([{ productId: '', quantity: 1, unitPrice: 0 }])
  const [saving, setSaving] = useState(false)

  const handleSelectCustomer = (id: number) => {
    setSelectedCustomerId(id)
    if (orderType === 'RETAIL') {
      const c = safeRetail.find(r => r.id === id)
      if (c) { setCustomerName(c.name); setCustomerPhone(c.phone); setCustomerAddress(c.address ?? '') }
    } else {
      const c = safeWholesale.find(w => w.id === id)
      if (c) { setCustomerName(c.businessName); setCustomerPhone(c.phone); setCustomerAddress(c.address) }
    }
  }

  const handleOrderTypeChange = (t: 'RETAIL' | 'WHOLESALE') => {
    setOrderType(t); setSelectedCustomerId(''); setCustomerName(''); setCustomerPhone(''); setCustomerAddress('')
  }

  const updateItem = (i: number, field: keyof ItemRow, val: string | number) =>
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row))

  const addItem = () => setItems(prev => [...prev, { productId: '', quantity: 1, unitPrice: 0 }])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const totalBefore = items.reduce((s, row) => s + row.quantity * row.unitPrice, 0)
  const discountAmount = totalBefore * discountPercent / 100
  const totalAmount = totalBefore - discountAmount

  const isValid = selectedCustomerId !== '' && customerName && customerPhone && customerAddress
    && items.every(r => r.productId && r.quantity > 0 && r.unitPrice >= 0)

  const handleSubmit = async () => {
    if (!isValid) return
    setSaving(true)
    try {
      await createQuotation({
        orderType,
        retailCustomerId: orderType === 'RETAIL' ? selectedCustomerId : undefined,
        wholesaleCustomerId: orderType === 'WHOLESALE' ? selectedCustomerId : undefined,
        customerName, customerPhone, customerAddress,
        expiryDate: expiryDate || undefined,
        discountPercent,
        promotionId: promotionId !== '' ? promotionId : undefined,
        items: items.map(r => ({ productId: r.productId, quantity: r.quantity, unitPrice: r.unitPrice })),
      })
      onSaved(); onClose()
    } finally { setSaving(false) }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 680, maxHeight: '92vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Tạo báo giá mới</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Order type */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['RETAIL', 'WHOLESALE'] as const).map(t => (
            <button key={t} onClick={() => handleOrderTypeChange(t)}
              style={{ flex: 1, padding: '8px 0', border: `2px solid ${orderType === t ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: orderType === t ? 'var(--blue-bg)' : 'transparent', color: orderType === t ? 'var(--blue)' : 'var(--text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {t === 'RETAIL' ? 'Khách lẻ (LE-)' : 'Khách sỉ (SI-)'}
            </button>
          ))}
        </div>

        {/* Customer select */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Khách hàng *</label>
          <select value={selectedCustomerId} onChange={e => handleSelectCustomer(Number(e.target.value))} style={inputStyle}>
            <option value="">-- Chọn khách hàng --</option>
            {orderType === 'RETAIL'
              ? safeRetail.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)
              : safeWholesale.map(c => <option key={c.id} value={c.id}>{c.businessName} — {c.phone}</option>)
            }
          </select>
        </div>

        {/* Customer snapshot */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 14 }}>
          {[
            { label: 'Tên khách *', val: customerName, set: setCustomerName },
            { label: 'Số điện thoại *', val: customerPhone, set: setCustomerPhone },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{label}</label>
              <input value={val} onChange={e => set(e.target.value)} style={inputStyle} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Địa chỉ giao hàng *</label>
          <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} style={inputStyle} />
        </div>

        {/* Items */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Sản phẩm *</label>
            <button onClick={addItem} style={{ fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Thêm dòng</button>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.5fr auto', gap: 0, background: 'var(--surface2)', padding: '6px 10px', fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
              <span>Sản phẩm</span><span>SL</span><span>Đơn giá (đ)</span><span></span>
            </div>
            {items.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.5fr auto', gap: 8, padding: '8px 10px', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
                <select value={row.productId} onChange={e => {
                  const p = safeProducts.find(p => p.id === e.target.value)
                  updateItem(i, 'productId', e.target.value)
                  if (p) updateItem(i, 'unitPrice', p.price)
                }} style={{ ...inputStyle, width: '100%' }}>
                  <option value="">-- Chọn SP --</option>
                  {safeProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" min={1} value={row.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} style={{ ...inputStyle, width: '100%' }} />
                <input type="number" min={0} value={row.unitPrice} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} style={{ ...inputStyle, width: '100%' }} />
                <button onClick={() => removeItem(i)} disabled={items.length === 1} style={{ background: 'none', border: 'none', cursor: items.length > 1 ? 'pointer' : 'not-allowed', color: items.length > 1 ? '#dc2626' : 'var(--text3)' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Discount + expiry + promotion */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px', marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Chiết khấu (%)</label>
            <input type="number" min={0} max={100} value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Hạn hiệu lực</label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Ưu đãi áp dụng</label>
            <select value={promotionId} onChange={e => setPromotionId(e.target.value ? Number(e.target.value) : '')} style={inputStyle}>
              <option value="">-- Không áp dụng --</option>
              {safePromotions.filter(p => p.orderType === orderType && new Date(p.endDate) > new Date())
                .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Total summary */}
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'var(--text3)' }}>Tổng trước CK</span>
            <span>{totalBefore.toLocaleString()} đ</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'var(--text3)' }}>Chiết khấu ({discountPercent}%)</span>
            <span style={{ color: '#dc2626' }}>-{Math.round(discountAmount).toLocaleString()} đ</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
            <span>Tổng thanh toán</span>
            <span style={{ color: 'var(--blue)' }}>{Math.round(totalAmount).toLocaleString()} đ</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer' }}>Hủy</button>
          <button className="primary" onClick={handleSubmit} disabled={saving || !isValid}>
            {saving ? 'Đang lưu...' : 'Lưu nháp'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuotationList() {
  const { user } = useAuth()
  const isManager = user?.role === 'MANAGER'

  const { data, isLoading, error, refetch } = useFetch<Quotation[]>(getQuotations)
  const list = Array.isArray(data) ? data : []

  const [showCreate, setShowCreate] = useState(false)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const handleSubmit = async (id: number) => {
    setActionLoading(id)
    try { await submitQuotation(id); refetch() } finally { setActionLoading(null) }
  }

  const handleApprove = async (id: number) => {
    setActionLoading(id)
    try { await approveQuotation(id); refetch() } finally { setActionLoading(null) }
  }

  const handleReject = async (reason: string) => {
    if (!rejectingId) return
    setActionLoading(rejectingId)
    try { await rejectQuotation(rejectingId, reason); refetch() } finally { setActionLoading(null); setRejectingId(null) }
  }

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ padding: 40, color: '#E24B4A' }}>Lỗi: {error}</div>

  return (
    <div>
      {!isManager && <NotificationBanner quotations={list} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Báo giá</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{list.length} báo giá</div>
        </div>
        {!isManager && (
          <button className="primary" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Tạo báo giá
          </button>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              {['Mã BG', 'Khách hàng', 'Sản phẩm', 'Tổng tiền', 'Chiết khấu', 'Trạng thái', isManager ? 'Người tạo' : null, ''].filter(Boolean).map(h => (
                <th key={h!} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((q: Quotation) => {
              const customerDisplay = q.retailCustomer?.name ?? q.wholesaleCustomer?.businessName ?? q.customerName
              const itemsSummary = q.items.map(i => `${i.product?.name ?? i.productId} x${i.quantity}`).join(', ')
              const isActing = actionLoading === q.id

              return (
                <tr key={q.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                  {/* Mã BG */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Receipt size={13} color="var(--blue)" />
                      <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--blue)' }}>{q.code}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                      {format(new Date(q.createdAt), 'dd/MM/yyyy')}
                    </div>
                  </td>

                  {/* Khách hàng */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{customerDisplay}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{q.customerPhone}</div>
                  </td>

                  {/* Sản phẩm */}
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {itemsSummary}
                  </td>

                  {/* Tổng tiền */}
                  <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>
                    {Math.round(q.totalAmount).toLocaleString()} đ
                  </td>

                  {/* Chiết khấu */}
                  <td style={{ padding: '10px 12px', fontSize: 12, color: q.discountPercent > 0 ? '#dc2626' : 'var(--text3)' }}>
                    {q.discountPercent > 0 ? `-${q.discountPercent}%` : '—'}
                  </td>

                  {/* Trạng thái */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ marginBottom: q.rejectReason ? 4 : 0 }}>
                      <StatusBadge status={q.status} />
                    </div>
                    {q.rejectReason && (
                      <div style={{ fontSize: 11, color: '#dc2626', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.rejectReason}>
                        {q.rejectReason}
                      </div>
                    )}
                    {q.status === 'APPROVED' && q.orderId && (
                      <div style={{ fontSize: 11, color: '#15803d', marginTop: 2, fontWeight: 600 }}>
                        → {q.orderId}
                      </div>
                    )}
                  </td>

                  {/* Người tạo (MANAGER only) */}
                  {isManager && (
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text2)' }}>
                      {q.createdBy?.name}
                    </td>
                  )}

                  {/* Actions */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {/* SALES: gửi duyệt nếu DRAFT */}
                      {!isManager && q.status === 'DRAFT' && (
                        <button onClick={() => handleSubmit(q.id)} disabled={isActing}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid var(--blue)', borderRadius: 'var(--radius)', background: 'var(--blue-bg)', color: 'var(--blue)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          <Send size={11} /> {isActing ? '...' : 'Gửi duyệt'}
                        </button>
                      )}

                      {/* MANAGER: duyệt / từ chối nếu PENDING */}
                      {isManager && q.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleApprove(q.id)} disabled={isActing}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: 'none', borderRadius: 'var(--radius)', background: '#15803d', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            <CheckCircle size={11} /> {isActing ? '...' : 'Duyệt'}
                          </button>
                          <button onClick={() => setRejectingId(q.id)} disabled={isActing}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: 'none', borderRadius: 'var(--radius)', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            <XCircle size={11} /> Từ chối
                          </button>
                        </>
                      )}

                      {/* Chi tiết expand */}
                      <button style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {list.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            Chưa có báo giá nào
          </div>
        )}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSaved={refetch} />}
      {rejectingId && <RejectModal onConfirm={handleReject} onClose={() => setRejectingId(null)} />}
    </div>
  )
}
