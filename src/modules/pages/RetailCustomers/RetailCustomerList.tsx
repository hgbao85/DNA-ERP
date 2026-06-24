import { useState, useCallback } from 'react'
import { format, differenceInMonths } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import {
  getRetailCustomers, getRetailCustomerDetail, createRetailCustomer,
  updateRetailCustomer, assignRetailCustomerSales, addRetailCareHistory,
} from '../../../services/api'
import { getAgencyWarehouses, getSalesUsers } from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import type { RetailCustomer, Order, CareHistoryItem, AgencyWarehouseSummary, SalesUserSummary } from '../../../types'
import { Plus, X, ChevronRight, Shield, ShieldOff, UserCheck, MessageSquare, ClipboardList } from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────────────────────

function warrantyBadge(orders: Order[] = []) {
  const delivered = orders.filter(o => o.deliveryDate).sort(
    (a, b) => new Date(b.deliveryDate!).getTime() - new Date(a.deliveryDate!).getTime()
  )
  if (!delivered.length) return null
  const months = differenceInMonths(new Date(), new Date(delivered[0]!.deliveryDate!))
  return months < 12
}

function lastPurchase(orders: Order[] = []) {
  if (!orders.length) return null
  const sorted = [...orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return sorted[0]!.deliveryDate ?? sorted[0]!.date
}

// ─── Add/Edit Form Modal ────────────────────────────────────────────────────

type FormData = {
  name: string; phone: string; email: string; address: string;
  region: string; agencyWarehouseId: string; debt: string; note: string;
}

const EMPTY: FormData = { name: '', phone: '', email: '', address: '', region: '', agencyWarehouseId: '', debt: '', note: '' }

function CustomerFormModal({
  initial, onClose, onSaved,
}: {
  initial: RetailCustomer | null
  onClose: () => void
  onSaved: () => void
}) {
  const { data: agencies } = useFetch<AgencyWarehouseSummary[]>(getAgencyWarehouses)
  const [form, setForm] = useState<FormData>(
    initial
      ? { name: initial.name, phone: initial.phone, email: initial.email ?? '', address: initial.address ?? '', region: initial.region ?? '', agencyWarehouseId: initial.agencyWarehouseId, debt: String(initial.debt ?? 0), note: initial.note ?? '' }
      : EMPTY
  )
  const [saving, setSaving] = useState(false)

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const payload = { ...form, debt: form.debt ? parseFloat(form.debt) : undefined }
      if (initial) await updateRetailCustomer(initial.id, payload)
      else await createRetailCustomer(payload)
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{initial ? 'Cập nhật khách hàng' : 'Thêm khách hàng lẻ'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          {[
            { label: 'Họ tên *', key: 'name', placeholder: 'Nguyễn Văn A' },
            { label: 'Số điện thoại *', key: 'phone', placeholder: '0901234567' },
            { label: 'Email', key: 'email', placeholder: 'example@mail.com' },
            { label: 'Khu vực', key: 'region', placeholder: 'Hà Nội, HCM...' },
            { label: 'Công nợ (VNĐ)', key: 'debt', placeholder: '0' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{label}</label>
              <input value={form[key as keyof FormData]} onChange={set(key as keyof FormData)} placeholder={placeholder} type={key === 'debt' ? 'number' : 'text'} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Kho Đại lý *</label>
            <select value={form.agencyWarehouseId} onChange={set('agencyWarehouseId')} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', fontSize: 13 }}>
              <option value="">-- Chọn đại lý --</option>
              {(agencies ?? []).map((a: AgencyWarehouseSummary) => <option key={a.id} value={a.id}>{a.name} ({a.region})</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Địa chỉ</label>
          <input value={form.address} onChange={set('address')} placeholder="Số nhà, đường, quận/huyện..." style={{ width: '100%' }} />
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Ghi chú</label>
          <textarea value={form.note} onChange={set('note')} rows={2} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer' }}>Hủy</button>
          <button className="primary" onClick={handleSubmit} disabled={saving || !form.name || !form.phone || !form.agencyWarehouseId}>
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Panel ───────────────────────────────────────────────────────────

function DetailPanel({
  customerId, onClose, onEdit, onRefreshList,
}: {
  customerId: number
  onClose: () => void
  onEdit: (c: RetailCustomer) => void
  onRefreshList: () => void
}) {
  const { user } = useAuth()
  const isManager = user?.role === 'MANAGER'
  const [activeTab, setActiveTab] = useState<'care' | 'orders'>('care')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchDetail = useCallback(() => getRetailCustomerDetail(customerId), [customerId])
  const { data: customer, isLoading, refetch } = useFetch<RetailCustomer>(fetchDetail)

  const inWarranty = customer ? warrantyBadge(customer.orders) : null
  const lastBuy = customer ? lastPurchase(customer.orders) : null

  const handleAddNote = async () => {
    if (!note.trim()) return
    setSubmitting(true)
    try {
      await addRetailCareHistory(customerId, note.trim())
      setNote('')
      refetch()
      onRefreshList()
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: '-4px 0 20px rgba(0,0,0,.12)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {isLoading
            ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Đang tải...</div>
            : <>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{customer?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{customer?.phone}</div>
            </>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {inWarranty !== null && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4, background: inWarranty ? '#dcfce7' : '#fee2e2', color: inWarranty ? '#15803d' : '#dc2626' }}>
              {inWarranty ? <><Shield size={11} /> Còn BH</> : <><ShieldOff size={11} /> Hết BH</>}
            </span>
          )}
          {isManager && customer && (
            <button onClick={() => onEdit(customer)} style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>Sửa</button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
      </div>

      {customer && (
        <>
          {/* Info grid */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
            {[
              ['Địa chỉ', customer.address || '—'],
              ['Khu vực', customer.region || '—'],
              ['Đại lý', customer.agencyWarehouse?.name || '—'],
              ['CSKH', customer.assignedSales?.name || 'Chưa phân công'],
              ['Công nợ', `${Number(customer.debt).toLocaleString()} đ`],
              ['Lần mua cuối', lastBuy ? format(new Date(lastBuy), 'dd/MM/yyyy') : '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>{label}</div>
                <div style={{ fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
            {([['care', <MessageSquare size={13} />, 'Chăm sóc'], ['orders', <ClipboardList size={13} />, 'Đơn hàng']] as const).map(([id, icon, label]) => (
              <button key={id} onClick={() => setActiveTab(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 14px', border: 'none', borderBottom: activeTab === id ? '2px solid var(--blue)' : '2px solid transparent', background: 'transparent', color: activeTab === id ? 'var(--blue)' : 'var(--text3)', fontWeight: activeTab === id ? 600 : 400, fontSize: 12, cursor: 'pointer' }}>
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '14px 20px' }}>
            {activeTab === 'care' && (
              <>
                {/* Add note */}
                <div style={{ marginBottom: 16 }}>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Ghi chú cuộc gọi, nội dung tư vấn..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, resize: 'vertical', marginBottom: 8 }} />
                  <button className="primary" onClick={handleAddNote} disabled={submitting || !note.trim()} style={{ fontSize: 12 }}>
                    {submitting ? 'Đang lưu...' : 'Lưu ghi chú'}
                  </button>
                </div>
                {/* History */}
                {(customer.careHistory ?? []).length === 0
                  ? <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Chưa có lịch sử chăm sóc</div>
                  : (customer.careHistory ?? []).map((h: CareHistoryItem) => (
                    <div key={h.id} style={{ borderLeft: '2px solid var(--blue)', paddingLeft: 12, marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{format(new Date(h.createdAt), 'dd/MM/yyyy HH:mm')}</div>
                      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{h.note}</div>
                    </div>
                  ))}
              </>
            )}
            {activeTab === 'orders' && (
              (customer.orders ?? []).length === 0
                ? <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Chưa có đơn hàng</div>
                : (customer.orders ?? []).map((o: Order) => (
                  <div key={o.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{o.id}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--blue-bg)', color: 'var(--blue)', fontWeight: 600 }}>{o.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{o.details} · {o.quantity} cái</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
                      <span>{format(new Date(o.date), 'dd/MM/yyyy')}</span>
                      <span style={{ fontWeight: 600, color: 'var(--blue)' }}>{o.total.toLocaleString()} đ</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function RetailCustomerList() {
  const { user } = useAuth()
  const isManager = user?.role === 'MANAGER'

  const { data: customers, isLoading, error, refetch } = useFetch<RetailCustomer[]>(getRetailCustomers)
  const { data: salesUsersRaw } = useFetch<SalesUserSummary[]>(getSalesUsers)
  const salesUsers = (salesUsersRaw ?? []).filter((u: SalesUserSummary) => u.salesType === 'RETAIL')

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [formCustomer, setFormCustomer] = useState<RetailCustomer | 'new' | null>(null)
  const [assigningId, setAssigningId] = useState<number | null>(null)

  const handleAssign = async (customerId: number, salesId: number) => {
    await assignRetailCustomerSales(customerId, salesId)
    setAssigningId(null)
    refetch()
  }

  // Sắp xếp: chưa phân công lên đầu (MANAGER view)
  const sorted = [...(customers ?? [])].sort((a, b) => {
    if (isManager) {
      const aUnassigned = !a.assignedSalesId ? 0 : 1
      const bUnassigned = !b.assignedSalesId ? 0 : 1
      return aUnassigned - bUnassigned
    }
    return 0
  })

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ padding: 40, color: '#E24B4A' }}>Lỗi: {error}</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Khách hàng lẻ</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{sorted.length} khách hàng</div>
        </div>
        {isManager && (
          <button className="primary" onClick={() => setFormCustomer('new')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Thêm khách hàng
          </button>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              {['Tên', 'SĐT', 'Đại lý', isManager ? 'Nhân viên CSKH' : null, 'Số đơn', 'Thực thu', 'Công nợ', 'Lần mua cuối', 'Bảo hành', ''].filter(Boolean).map(h => (
                <th key={h!} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c: RetailCustomer) => {
              const inWarranty = warrantyBadge(c.orders)
              const lastBuy = lastPurchase(c.orders)
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--blue)', cursor: 'pointer' }}
                    onClick={() => setSelectedId(c.id)}>{c.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{c.phone}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{c.agencyWarehouse?.name || c.agencyWarehouseId}</td>

                  {isManager && (
                    <td style={{ padding: '10px 12px' }}>
                      {assigningId === c.id ? (
                        <select autoFocus onChange={e => handleAssign(c.id, Number(e.target.value))}
                          onBlur={() => setAssigningId(null)}
                          defaultValue=""
                          style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--blue)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
                          <option value="" disabled>Chọn sales...</option>
                          {(salesUsers ?? []).map((s: SalesUserSummary) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      ) : c.assignedSales ? (
                        <span onClick={() => setAssigningId(c.id)} style={{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <UserCheck size={12} color="var(--blue)" />{c.assignedSales.name}
                        </span>
                      ) : (
                        <span onClick={() => setAssigningId(c.id)}
                          style={{ fontSize: 11, fontWeight: 600, color: '#b45309', background: '#fef3c7', padding: '3px 8px', borderRadius: 20, cursor: 'pointer', border: '1px solid #fde68a' }}>
                          Chưa phân công
                        </span>
                      )}
                    </td>
                  )}

                  <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'center' }}>
                    {c.orderCount ?? 0}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 500, color: '#15803d' }}>
                    {(c.totalRevenue ?? 0) > 0 ? `${Math.round(c.totalRevenue!).toLocaleString()} đ` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>
                    {Number(c.debt) > 0
                      ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{Number(c.debt).toLocaleString()} đ</span>
                      : <span style={{ color: 'var(--text3)' }}>0 đ</span>}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text2)' }}>
                    {lastBuy ? format(new Date(lastBuy), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {inWarranty === null
                      ? <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
                      : <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: inWarranty ? '#dcfce7' : '#fee2e2', color: inWarranty ? '#15803d' : '#dc2626' }}>
                        {inWarranty ? 'Còn BH' : 'Hết BH'}
                      </span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => setSelectedId(c.id)} style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      Chi tiết <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chưa có khách hàng nào</div>
        )}
      </div>

      {selectedId && (
        <DetailPanel
          customerId={selectedId}
          onClose={() => setSelectedId(null)}
          onEdit={c => { setFormCustomer(c); setSelectedId(null) }}
          onRefreshList={refetch}
        />
      )}

      {formCustomer && (
        <CustomerFormModal
          initial={formCustomer === 'new' ? null : formCustomer}
          onClose={() => setFormCustomer(null)}
          onSaved={refetch}
        />
      )}
    </div>
  )
}
