import { useState } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Loader2, Plus } from 'lucide-react'
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

  const [form, setForm]               = useState<CreatePlanFormPayload>(emptyForm)
  const [customerName, setCustomerName] = useState('')
  const [poCode, setPoCode]           = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [success, setSuccess]         = useState(false)

  const pending = ((planForms ?? []) as PlanForm[]).filter(p => p.status === 'PROPOSED' || p.status !== 'APPROVED')

  const handleSubmit = async () => {
    if (!form.note.trim()) {
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
      setForm(emptyForm())
      setCustomerName('')
      setPoCode('')
      setSuccess(true)
      refetch()
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Không thể tạo SKU')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tạo SKU mới</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Thêm SKU mới — sẽ vào danh sách chờ duyệt
        </p>
      </div>

      {/* Create form */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 28, maxWidth: 520 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Thông tin SKU</div>

        <label style={labelStyle}>Tên khách hàng</label>
        <input
          type="text"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          placeholder="Nhập tên khách hàng"
          style={inputStyle}
        />

        <label style={labelStyle}>Mã PO</label>
        <input
          type="text"
          value={poCode}
          onChange={e => setPoCode(e.target.value)}
          placeholder="Nhập mã PO"
          style={inputStyle}
        />

        <label style={labelStyle}>Mã SKU</label>
        <input
          type="text"
          value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })}
          placeholder="Nhập mã SKU"
          style={inputStyle}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
          >
            <Plus size={15} />
            {submitting ? 'Đang lưu...' : 'Thêm SKU'}
          </button>
          {success && (
            <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Đã thêm, đang chờ duyệt</span>
          )}
        </div>
      </div>

      {/* Pending list */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          Danh sách chờ duyệt
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--text3)' }}>
            {isLoading ? '...' : `${pending.length} SKU`}
          </span>
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
                <col style={{ width: 150 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 150 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Khách hàng</th>
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
                    <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                      Không có SKU nào đang chờ duyệt
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
