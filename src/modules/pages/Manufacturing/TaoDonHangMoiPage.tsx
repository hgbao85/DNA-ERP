import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Plus, Trash2, CheckCircle2, Paperclip, FileText, X } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
interface ExportCustomer { id: number; name: string; country: string }
interface MfgProduct { id: number; name: string; boxesPerSet?: number; variants?: ProductVariant[] }
interface ProductVariant { id: number; colorCode: string; mfgProduct: MfgProduct }
interface OrderItem { productVariantId: number; quantity: number; boxesPerSet: number }

const blankForm = () => ({
  poNumber: '', exportCustomerId: 0, deliveryDate: '', note: '', contractFileUrl: '',
  totalValue: '', depositAmount: '',
  items: [{ productVariantId: 0, quantity: 1, boxesPerSet: 1 }] as OrderItem[],
})

// ── Màn "Tạo đơn hàng mới": form riêng (thay popup cũ). Tạo xong → quay về Tổng đơn hàng. ──
export default function TaoDonHangMoiPage({ onCreated }: { onCreated?: () => void }) {
  const { data: customers } = useFetch(() => api.getMfgExportCustomers(), [])
  const { data: products }  = useFetch(() => api.getMfgProducts(), [])
  const safeCustomers = Array.isArray(customers) ? (customers as ExportCustomer[]) : []
  const safeProducts  = Array.isArray(products)  ? (products as MfgProduct[]) : []

  const [form, setForm]   = useState(blankForm())
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr]     = useState('')

  // File đính kèm (hợp đồng) → đẩy lên Cloudinary qua backend, lưu secure_url vào contractFileUrl
  const handleFile = async (file: File) => {
    setUploading(true); setErr('')
    try {
      const url = await api.uploadContractFile(file)
      setForm(p => ({ ...p, contractFileUrl: url }))
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } }
      setErr(ex?.response?.data?.error ?? 'Lỗi tải file lên')
    } finally {
      setUploading(false)
    }
  }

  const handleCreate = async () => {
    if (!form.poNumber.trim() || !form.exportCustomerId || !form.deliveryDate || form.items.some(i => !i.productVariantId || i.quantity < 1)) {
      setErr('Điền đủ Mã PO, khách hàng, ngày giao và ít nhất 1 sản phẩm hợp lệ')
      return
    }
    setSaving(true); setErr('')
    try {
      await api.createExportOrder({
        poNumber: form.poNumber.trim(),
        exportCustomerId: form.exportCustomerId,
        deliveryDate: form.deliveryDate,
        note: form.note || undefined,
        contractFileUrl: form.contractFileUrl || undefined,
        totalValue: form.totalValue ? Number(form.totalValue) : undefined,
        depositAmount: form.depositAmount ? Number(form.depositAmount) : undefined,
        items: form.items,
      })
      setForm(blankForm())
      onCreated?.()
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } }
      setErr(ex?.response?.data?.error ?? 'Lỗi tạo đơn hàng')
    } finally {
      setSaving(false)
    }
  }

  const setItem = (idx: number, field: keyof OrderItem, val: number) =>
    setForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: val } as OrderItem
      return { ...prev, items }
    })
  const addItem  = () => setForm(prev => ({ ...prev, items: [...prev.items, { productVariantId: 0, quantity: 1, boxesPerSet: 1 }] }))
  const dropItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700 }}>Tạo đơn hàng mới</h2>

      {err && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}>{err}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* PO Number */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Mã PO *</label>
          <input value={form.poNumber} onChange={e => setForm(p => ({ ...p, poNumber: e.target.value }))}
            placeholder="VD: PO-GOPLUS-003"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        {/* Customer */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Khách hàng XK *</label>
          <select value={form.exportCustomerId} onChange={e => setForm(p => ({ ...p, exportCustomerId: Number(e.target.value) }))}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
            <option value={0}>-- Chọn khách hàng --</option>
            {safeCustomers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.country})</option>)}
          </select>
        </div>

        {/* Delivery date */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Ngày giao hàng *</label>
          <input type="date" value={form.deliveryDate} onChange={e => setForm(p => ({ ...p, deliveryDate: e.target.value }))}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        {/* Products */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)' }}>Sản phẩm * <span style={{ color: 'var(--text3)' }}>(SL bộ · số thùng/bộ)</span></label>
            <button onClick={addItem} style={{ fontSize: 12, color: '#e65100', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Plus size={12}/> Thêm SP
            </button>
          </div>
          {form.items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <select
                value={item.productVariantId}
                onChange={e => {
                  const vid = Number(e.target.value)
                  // Auto-điền số thùng/bộ từ định mức sản phẩm (vẫn sửa được cho khách đặc biệt)
                  const owner = safeProducts.find(p => (p.variants ?? []).some(v => v.id === vid))
                  setForm(prev => ({ ...prev, items: prev.items.map((it, i) => i === idx ? { ...it, productVariantId: vid, boxesPerSet: owner?.boxesPerSet ?? 1 } : it) }))
                }}
                style={{ flex: 1, padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12 }}
              >
                <option value={0}>-- Chọn sản phẩm --</option>
                {safeProducts.flatMap(p =>
                  (p.variants ?? []).map(v => (
                    <option key={v.id} value={v.id}>{p.name} — {v.colorCode}</option>
                  ))
                )}
              </select>
              <input type="number" min={1} value={item.quantity} title="Số lượng (bộ)"
                onChange={e => setItem(idx, 'quantity', Number(e.target.value))}
                style={{ width: 64, padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12 }}
              />
              <input type="number" min={1} value={item.boxesPerSet} title="Số thùng mỗi bộ (1 = cả bộ 1 thùng)"
                onChange={e => setItem(idx, 'boxesPerSet', Math.max(1, Number(e.target.value)))}
                style={{ width: 56, padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12 }}
              />
              {form.items.length > 1 && (
                <button onClick={() => dropItem(idx)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#c62828' }}>
                  <Trash2 size={14}/>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Thanh toán: tổng giá trị + tiền cọc → công nợ = giá trị − cọc */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Thanh toán</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Tổng giá trị đơn (USD)</div>
              <input type="number" min={0} value={form.totalValue} onChange={e => setForm(p => ({ ...p, totalValue: e.target.value }))}
                placeholder="0" style={{ width: 150, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, textAlign: 'right', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Tiền cọc (USD)</div>
              <input type="number" min={0} value={form.depositAmount} onChange={e => setForm(p => ({ ...p, depositAmount: e.target.value }))}
                placeholder="0" style={{ width: 130, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, textAlign: 'right', boxSizing: 'border-box' }} />
            </div>
            <div style={{ padding: '8px 14px', background: 'var(--surface2)', borderRadius: 'var(--radius)', fontSize: 13 }}>
              <span style={{ color: 'var(--text3)' }}>Công nợ: </span>
              <strong style={{ color: '#c62828' }}>
                {Math.max(0, (Number(form.totalValue) || 0) - (Number(form.depositAmount) || 0)).toLocaleString()} USD
              </strong>
            </div>
          </div>
        </div>

        {/* Note */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Ghi chú</label>
          <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
            rows={2} placeholder="Ghi chú thêm về đơn hàng..."
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        {/* File đính kèm (hợp đồng) — Cloudinary */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>File đính kèm (hợp đồng)</label>
          {form.contractFileUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <a href={form.contractFileUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1565c0', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                <FileText size={15} /> Đã đính kèm — xem file
              </a>
              <button type="button" onClick={() => setForm(p => ({ ...p, contractFileUrl: '' }))} title="Bỏ file"
                style={{ marginLeft: 'auto', padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#c62828', display: 'flex' }}>
                <X size={15} />
              </button>
            </div>
          ) : (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', cursor: uploading ? 'default' : 'pointer', fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
              <Paperclip size={15} /> {uploading ? 'Đang tải lên...' : 'Chọn file đính kèm'}
              <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" disabled={uploading} style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }}
              />
            </label>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={() => { setForm(blankForm()); setErr('') }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13 }}>
          Làm lại
        </button>
        <button onClick={handleCreate} disabled={saving}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#e65100', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          <CheckCircle2 size={15} /> {saving ? 'Đang tạo...' : 'Tạo đơn hàng'}
        </button>
      </div>
    </div>
  )
}
