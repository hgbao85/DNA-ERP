import { useState } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Loader2, Plus, Search, X } from 'lucide-react'
import type { PlanForm, CreatePlanFormPayload } from '../../../types/plan-form'

const emptyForm = (): CreatePlanFormPayload => ({
  exportOrderId: 0, mfgProductId: 0, note: '', materialType: {
    sat: { type: '', specifications: '', thickness: undefined },
    daySon: { kg: undefined, specifications: '', imageUrl: '' },
    vatTuPhuKien: { unit: 'cái' },
    baoBiDongGoi: { unit: 'thùng' },
  },
})

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PROPOSED: { label: 'Chờ duyệt', color: '#d97706', bg: '#fef3c7' },
  APPROVED: { label: 'Đã duyệt',  color: '#16a34a', bg: '#dcfce7' },
  REJECTED: { label: 'Từ chối',   color: '#dc2626', bg: '#fee2e2' },
}

export default function CreateSkuPage() {
  const { data: planForms = [], isLoading, refetch } = useFetch(() => api.getPlanForms(), [])
  const { data: formOptions } = useFetch(() => api.getPlanFormOptions(), [])
  const exportOrders = (formOptions?.exportOrders ?? []) as { id: number }[]
  const mfgProducts  = (formOptions?.mfgProducts  ?? []) as { id: number }[]

  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState<CreatePlanFormPayload>(emptyForm)
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [success, setSuccess]         = useState(false)

  const closeForm = () => {
    setShowForm(false)
    setForm(emptyForm())
    setCustomerName('')
  }

  const [search, setSearch] = useState('')

  const allPending = ((planForms ?? []) as PlanForm[]).filter(p => p.status === 'PROPOSED' || p.status !== 'APPROVED')
  const q = search.trim().toLowerCase()
  const pending = q
    ? allPending.filter(p => [p.mfgProduct?.factoryCode, p.mfgProduct?.name, p.customerName].some(v => v?.toLowerCase().includes(q)))
    : allPending

  const handleSubmit = async () => {
    if (!(form.note ?? '').trim()) {
      alert('Vui lòng nhập SKU')
      return
    }
    const firstOrder   = exportOrders[0]
    const firstProduct = mfgProducts[0]
    setSubmitting(true)
    try {
      await api.proposePlanForm({
        ...form,
        exportOrderId: form.exportOrderId || firstOrder?.id || 0,
        mfgProductId:  form.mfgProductId  || firstProduct?.id || 0,
        customerName:  customerName.trim() || undefined,
      })
      closeForm()
      setSuccess(true)
      refetch()
      setTimeout(() => setSuccess(false), 4000)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Không thể tạo SKU')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tạo SKU</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {success && (
            <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Đã thêm thành công</span>
          )}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              <Plus size={15} /> Tạo SKU mới
            </button>
          )}
        </div>
      </div>

      {/* Create form — popup modal */}
      {showForm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeForm() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#15803d' }}>Thông tin SKU mới</span>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Fields */}
            <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>
                <label style={labelStyle}>Mã SKU <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  autoFocus
                  type="text" value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                  placeholder="Nhập mã SKU"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Tên khách hàng</label>
                <input
                  type="text" value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Nhập tên khách hàng"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '16px 20px', borderTop: '1px solid #e7f9ee', marginTop: 12 }}>
              <button
                onClick={closeForm}
                style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
              >Hủy</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
              >
                <Plus size={14} />
                {submitting ? 'Đang lưu...' : 'Thêm SKU'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            Danh sách chờ duyệt
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--text3)' }}>
              {isLoading ? '...' : `${allPending.length} SKU`}
            </span>
          </div>
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm SKU, sản phẩm, khách hàng..."
              style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)', padding: 24 }}>
            <Loader2 size={16} /> Đang tải...
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 48 }} />
                <col />
                <col style={{ width: 130 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 150 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Khách hàng</th>
                  <th style={thStyle}>Mã PO</th>
                  <th style={thStyle}>Trạng thái</th>
                  <th style={thStyle}>Thời gian tạo</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(pf => {
                  const s = STATUS_MAP[pf.status] ?? STATUS_MAP.PROPOSED
                  return (
                    <tr key={pf.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text3)' }}>{pf.id}</td>
                      <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                        <span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>
                        {pf.mfgProduct?.name}
                      </td>
                      <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                        {pf.customerName ?? '—'}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                        {pf.exportOrder?.poNumber ?? '—'}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: s.color, background: s.bg }}>
                          {s.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: 12 }}>
                        {format(new Date(pf.createdAt), 'HH:mm · dd/MM/yyyy')}
                      </td>
                    </tr>
                  )
                })}
                {pending.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                      {q ? 'Không tìm thấy kết quả' : 'Không có SKU nào đang chờ duyệt'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, marginTop: 12, color: 'var(--text2)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
const thStyle: React.CSSProperties    = { padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const tdStyle: React.CSSProperties    = { padding: '11px 14px' }
