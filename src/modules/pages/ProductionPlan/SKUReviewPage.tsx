import { useState } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Loader2, Plus, Search, X } from 'lucide-react'
import type { PlanForm, CreatePlanFormPayload } from '../../../types/plan-form'
import { SKUDetail, StatusBadge, STATUS_MAP } from './SKUDetail'

const PENDING_STATUSES = new Set(['WAITING_DETAIL', 'WAITING_PARTS', 'APPROVED_DETAIL', 'APPROVED_PARTS'])
type StatusFilter = 'all' | 'WAITING_DETAIL' | 'WAITING_PARTS' | 'APPROVED_DETAIL' | 'APPROVED_PARTS'

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',             label: 'Tất cả' },
  { key: 'WAITING_DETAIL',  label: STATUS_MAP.WAITING_DETAIL.label },
  { key: 'WAITING_PARTS',   label: STATUS_MAP.WAITING_PARTS.label },
  { key: 'APPROVED_DETAIL', label: STATUS_MAP.APPROVED_DETAIL.label },
  { key: 'APPROVED_PARTS',  label: STATUS_MAP.APPROVED_PARTS.label },
]

const emptyForm = (): CreatePlanFormPayload => ({
  exportOrderId: 0, mfgProductId: 0, note: '', materialType: {
    sat: { type: '', specifications: '', thickness: undefined },
    daySon: { kg: undefined, specifications: '', imageUrl: '' },
    vatTuPhuKien: { unit: 'cái' },
    baoBiDongGoi: { unit: 'thùng' },
  },
})

export default function SKUReviewPage() {
  const { data: planForms = [], isLoading, refetch } = useFetch(() => api.getPlanForms(), [])
  const { data: formOptions } = useFetch(() => api.getPlanFormOptions(), [])
  const exportOrders = (formOptions?.exportOrders ?? []) as { id: number }[]
  const mfgProducts  = (formOptions?.mfgProducts  ?? []) as { id: number }[]

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedPf, setSelectedPf]     = useState<PlanForm | null>(null)

  // Create form state
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState<CreatePlanFormPayload>(emptyForm)
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [success, setSuccess]           = useState(false)

  const closeForm = () => { setShowForm(false); setForm(emptyForm()); setCustomerName('') }

  const handleSubmit = async () => {
    if (!(form.note ?? '').trim()) { alert('Vui lòng nhập SKU'); return }
    setSubmitting(true)
    try {
      await api.createPlanForm({
        ...form,
        exportOrderId: form.exportOrderId || exportOrders[0]?.id || 0,
        mfgProductId:  form.mfgProductId  || mfgProducts[0]?.id  || 0,
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

  const pending = ((planForms ?? []) as PlanForm[]).filter(p => PENDING_STATUSES.has(p.status))
  const countByStatus = (s: StatusFilter) => s === 'all' ? pending.length : pending.filter(p => p.status === s).length

  const afterFilter = statusFilter === 'all' ? pending : pending.filter(p => p.status === statusFilter)
  const q = search.trim().toLowerCase()
  const displayed = q
    ? afterFilter.filter(p =>
        [p.mfgProduct?.factoryCode, p.mfgProduct?.name, p.customerName]
          .some(v => v?.toLowerCase().includes(q))
      )
    : afterFilter

  const handleApproveDetail = async () => {
    if (!selectedPf) return
    const updated = await api.approveDetailPlanForm(selectedPf.id)
    refetch()
    setSelectedPf(updated)
  }

  const handleApproveParts = async () => {
    if (!selectedPf) return
    const updated = await api.approvePartsPlanForm(selectedPf.id)
    refetch()
    setSelectedPf(updated)
  }

  const handleStartProduction = async () => {
    if (!selectedPf) return
    await api.approveFullPlanForm(selectedPf.id)
    refetch()
    setSelectedPf(null)
  }

  if (selectedPf) {
    return (
      <SKUDetail
        key={`${selectedPf.id}-${selectedPf.status}`}
        pf={selectedPf}
        onBack={() => setSelectedPf(null)}
        onApproveDetail={handleApproveDetail}
        onApproveParts={handleApproveParts}
        onStartProduction={handleStartProduction}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Duyệt SKU</h2>
          {success && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, display: 'block', marginTop: 4 }}>✓ Đã thêm thành công</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setShowForm(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <Plus size={14} /> Tạo SKU mới
          </button>
        </div>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeForm() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#15803d' }}>Thông tin SKU mới</span>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>
                <label style={labelStyle}>SKU <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  autoFocus type="text" value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                  placeholder="Nhập SKU"
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '16px 20px', borderTop: '1px solid #e7f9ee', marginTop: 12 }}>
              <button onClick={closeForm} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
                Hủy
              </button>
              <button
                onClick={handleSubmit} disabled={submitting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
              >
                <Plus size={14} />
                {submitting ? 'Đang lưu...' : 'Thêm SKU'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status filter + search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(({ key, label }) => {
            const active = statusFilter === key
            const s = key !== 'all' ? STATUS_MAP[key] : null
            const count = countByStatus(key)
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 20,
                  border: active ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  background: active ? (s ? s.bg : '#1f2937') : 'var(--surface)',
                  color: active ? (s ? s.color : '#fff') : 'var(--text2)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
                <span style={{
                  fontSize: 11, fontWeight: 700, minWidth: 18, textAlign: 'center',
                  padding: '1px 5px', borderRadius: 10,
                  background: active ? 'rgba(0,0,0,0.12)' : 'var(--surface2)',
                  color: 'inherit',
                }}>{count}</span>
              </button>
            )
          })}
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm SKU, sản phẩm, khách hàng..."
            style={{ paddingLeft: 32, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', outline: 'none', width: 280 }}
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
              <col style={{ width: 48 }} /><col />
              <col style={{ width: 130 }} />
              <col style={{ width: 160 }} /><col style={{ width: 150 }} />
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
              {displayed.map(pf => (
                <tr
                  key={pf.id}
                  onClick={() => setSelectedPf(pf)}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text3)' }}>{pf.id}</td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600 }}>{pf.mfgProduct?.factoryCode}</span>
                    <span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>
                    {pf.mfgProduct?.name}
                  </td>
                  <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                    {pf.customerName ?? '—'}
                  </td>
                  <td style={tdStyle}><StatusBadge status={pf.status} /></td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: 12 }}>
                    {format(new Date(pf.createdAt), 'HH:mm · dd/MM/yyyy')}
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
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
  )
}

const thStyle: React.CSSProperties = { padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const tdStyle: React.CSSProperties = { padding: '11px 14px' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, marginTop: 12, color: 'var(--text2)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
