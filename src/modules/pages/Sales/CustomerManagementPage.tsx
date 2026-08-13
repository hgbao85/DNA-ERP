import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import type { SalesCustomer, SalesOrder } from '../../../types/sales'

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', note: '' }

// Chỉ tính SKU đã hoàn thành — số lượng đang sản xuất/đang mua không tính vào đây
const purchasedQty = (pos: SalesOrder[]) =>
  pos.reduce((sum, po) => sum + po.items.filter((it) => it.status === 'HOAN_THANH').reduce((s, it) => s + it.totalQty, 0), 0)

export default function CustomerManagementPage() {
  const { data: customers, isLoading, error, refetch } = useFetch<SalesCustomer[]>(() => api.getSalesCustomers())
  const { data: pos } = useFetch<SalesOrder[]>(() => api.getSalesOrders())
  const [modal, setModal] = useState<'new' | SalesCustomer | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const openNew = () => { setForm(EMPTY_FORM); setModal('new') }
  const openEdit = (c: SalesCustomer) => {
    setForm({ name: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', note: c.note ?? '' })
    setModal(c)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        note: form.note.trim() || undefined,
      }
      if (modal === 'new') await api.createSalesCustomer(payload)
      else await api.updateSalesCustomer((modal as SalesCustomer).id, payload)
      await refetch()
      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa khách hàng này?')) return
    await api.deleteSalesCustomer(id)
    await refetch()
  }

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ padding: 40, color: '#E24B4A' }}>Lỗi: {error}</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Quản lí khách hàng</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{customers?.length ?? 0} khách hàng</div>
        </div>
        <button className="primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Thêm khách hàng
        </button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              {['Tên khách hàng', 'SĐT', 'Email', 'Địa chỉ', 'Tổng PO đã mua', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{c.phone}</td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{c.email || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{c.address || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>
                  {purchasedQty((pos ?? []).filter((p) => p.customerId === String(c.id))).toLocaleString()}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(c)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} style={{ padding: '4px 8px', border: '1px solid #fca5a5', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#E24B4A' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(customers ?? []).length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Chưa có khách hàng nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 10, width: 480, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{modal === 'new' ? 'Thêm khách hàng mới' : 'Cập nhật khách hàng'}</div>
              <button onClick={() => setModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Tên khách hàng *">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tên khách hàng" />
              </Field>
              <Field label="Số điện thoại *">
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="09xxxxxxxx" />
              </Field>
              <Field label="Email">
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@vidu.com" />
              </Field>
              <Field label="Địa chỉ">
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Địa chỉ" />
              </Field>
              <Field label="Ghi chú">
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Ghi chú" />
              </Field>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer' }}>Hủy</button>
              <button className="primary" onClick={handleSave} disabled={saving || !form.name.trim() || !form.phone.trim()}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}
