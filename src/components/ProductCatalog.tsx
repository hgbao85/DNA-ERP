import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../services/api'
import { useAuth } from '../context/AuthContext'
import type { Product } from '../types'
import { Plus, Pencil, Trash2, X } from 'lucide-react'

const EMPTY_FORM: Omit<Product, 'price'> & { price: string } = {
  id: '', name: '', image: '', materials: '', size: '', weight: '',
  color: '', price: '', category: '',
  setCount: undefined, cushionColor: '', packagingSize: '',
  netWeight: undefined, grossWeight: undefined,
}

export default function ProductCatalog() {
  const { user } = useAuth()
  const isManager = user?.role === 'MANAGER'
  const { data: products, isLoading, error, refetch } = useFetch(getProducts)
  const [modal, setModal] = useState<'new' | Product | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setForm(EMPTY_FORM)
    setModal('new')
  }

  const openEdit = (p: Product) => {
    setForm({ ...p, price: String(p.price), setCount: p.setCount, netWeight: p.netWeight, grossWeight: p.grossWeight })
    setModal(p)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price) || 0,
        setCount: form.setCount ? Number(form.setCount) : undefined,
        netWeight: form.netWeight ? Number(form.netWeight) : undefined,
        grossWeight: form.grossWeight ? Number(form.grossWeight) : undefined,
      }
      if (modal === 'new') {
        await createProduct(payload)
      } else {
        const { id, ...data } = payload
        await updateProduct((modal as Product).id, data)
      }
      await refetch()
      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa sản phẩm này?')) return
    await deleteProduct(id)
    await refetch()
  }

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ padding: 40, color: '#E24B4A' }}>Lỗi: {error}</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Danh sách Sản phẩm</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{products?.length ?? 0} sản phẩm</div>
        </div>
        {isManager && (
          <button className="primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Thêm sản phẩm
          </button>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              {['Mã SP', 'Tên', 'Đặc điểm', 'Số món bộ', 'Màu nệm', 'KT đóng gói', 'Net / Gross (kg)', 'Giá', isManager ? 'Hành động' : ''].filter(Boolean).map(h => (
                <th key={h} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p: Product) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 12 }}>{p.id}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>
                  {p.materials && <div>CL: {p.materials}</div>}
                  {p.size && <div>KT: {p.size}</div>}
                  {p.color && <div>Màu dây: {p.color}</div>}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{p.setCount ?? '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{p.cushionColor || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 13 }}>{p.packagingSize || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 12 }}>
                  {p.netWeight != null ? `${p.netWeight} / ${p.grossWeight ?? '?'}` : '—'}
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--blue)', whiteSpace: 'nowrap' }}>
                  {p.price.toLocaleString()} đ
                </td>
                {isManager && (
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(p)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} style={{ padding: '4px 8px', border: '1px solid #fca5a5', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#E24B4A' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 10, width: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{modal === 'new' ? 'Thêm sản phẩm mới' : 'Cập nhật sản phẩm'}</div>
              <button onClick={() => setModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
              <Field label="Mã sản phẩm *" disabled={modal !== 'new'}>
                <input value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} disabled={modal !== 'new'} placeholder="VD: SP001" />
              </Field>
              <Field label="Tên sản phẩm *">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tên sản phẩm" />
              </Field>
              <Field label="Giá (VNĐ) *">
                <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
              </Field>
              <Field label="Danh mục">
                <input value={form.category ?? ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Bàn ghế, Sofa..." />
              </Field>
              <Field label="Chất liệu">
                <input value={form.materials ?? ''} onChange={e => setForm(f => ({ ...f, materials: e.target.value }))} placeholder="Nhôm, Gỗ, Nhựa..." />
              </Field>
              <Field label="Hình ảnh (URL)">
                <input value={form.image ?? ''} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="https://..." />
              </Field>
            </div>

            {/* 3 cột cho fields nhỏ */}
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 20px' }}>
              <Field label="Kích thước">
                <input value={form.size ?? ''} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="120x60x75cm" />
              </Field>
              <Field label="Màu dây">
                <input value={form.color ?? ''} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="Đen, Trắng..." />
              </Field>
              <Field label="Màu nệm">
                <input value={form.cushionColor ?? ''} onChange={e => setForm(f => ({ ...f, cushionColor: e.target.value }))} placeholder="Kem, Xám..." />
              </Field>
              <Field label="Số món / bộ">
                <input type="number" value={form.setCount ?? ''} onChange={e => setForm(f => ({ ...f, setCount: e.target.value ? Number(e.target.value) : undefined }))} placeholder="4" />
              </Field>
              <Field label="Net weight (kg)">
                <input type="number" step="0.1" value={form.netWeight ?? ''} onChange={e => setForm(f => ({ ...f, netWeight: e.target.value ? Number(e.target.value) : undefined }))} placeholder="12.5" />
              </Field>
              <Field label="Gross weight (kg)">
                <input type="number" step="0.1" value={form.grossWeight ?? ''} onChange={e => setForm(f => ({ ...f, grossWeight: e.target.value ? Number(e.target.value) : undefined }))} placeholder="15.0" />
              </Field>
              <Field label="Trọng lượng (cũ)">
                <input value={form.weight ?? ''} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="VD: 12kg" />
              </Field>
              <Field label="KT đóng gói" style={{ gridColumn: 'span 2' }}>
                <input value={form.packagingSize ?? ''} onChange={e => setForm(f => ({ ...f, packagingSize: e.target.value }))} placeholder="130x65x20cm" />
              </Field>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer' }}>Hủy</button>
              <button className="primary" onClick={handleSave} disabled={saving || !form.id || !form.name || !form.price}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children, disabled, style }: { label: string; children: React.ReactNode; disabled?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{label}</label>
      <div style={{ opacity: disabled ? 0.5 : 1 }}>
        {children}
      </div>
    </div>
  )
}
