import { useState, Fragment } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import type { PlanForm, CreatePlanFormPayload } from '../../../types/plan-form'
import { SKUDetail, StatusBadge } from './SKUDetail'

const emptyForm = (): CreatePlanFormPayload => ({
  exportOrderId: 0, mfgProductId: 0, note: '', materialType: {
    sat: { type: '', specifications: '', thickness: undefined },
    daySon: { kg: undefined, specifications: '', imageUrl: '' },
    vatTuPhuKien: { unit: 'cái' },
    baoBiDongGoi: { unit: 'thùng' },
  },
})

export default function SKUListPage({ readOnly = false }: { readOnly?: boolean }) {
  const { data: planForms = [], isLoading, refetch } = useFetch(() => api.getPlanForms(), [])
  const { data: formOptions } = useFetch(() => api.getPlanFormOptions(), [])
  const exportOrders = (formOptions?.exportOrders ?? []) as { id: number }[]
  const mfgProducts  = (formOptions?.mfgProducts  ?? []) as { id: number }[]

  const [selectedPf, setSelectedPf] = useState<PlanForm | null>(null)
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

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
      await api.proposePlanForm({
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

  // Show all non-DRAFT items
  const allItems = ((planForms ?? []) as PlanForm[]).filter(pf => pf.status !== 'DRAFT')
  const q = search.trim().toLowerCase()
  const displayed = q
    ? allItems.filter(pf =>
        [pf.mfgProduct?.factoryCode, pf.mfgProduct?.name, pf.customerName]
          .some(v => v?.toLowerCase().includes(q))
      )
    : allItems

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () =>
    setSelectedIds(prev => prev.size === displayed.length ? new Set() : new Set(displayed.map(p => p.id)))
  const exitDeleteMode = () => { setDeleteMode(false); setSelectedIds(new Set()); setShowConfirm(false) }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await (api as any).deletePlanForms([...selectedIds])
      refetch()
      exitDeleteMode()
    } catch {
      alert('Không thể xóa')
    } finally {
      setDeleting(false)
    }
  }

  if (selectedPf) {
    return (
      <SKUDetail
        key={selectedPf.id}
        pf={selectedPf}
        readOnly
        onBack={() => setSelectedPf(null)}
      />
    )
  }

  const allChecked = displayed.length > 0 && selectedIds.size === displayed.length
  const someChecked = selectedIds.size > 0 && !allChecked

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách SKU</h2>
          {success && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, display: 'block', marginTop: 4 }}>✓ Đã thêm thành công</span>}
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!deleteMode ? (
              <>
                <button
                  onClick={() => setShowForm(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer' }}
                >
                  <Plus size={14} /> Tạo SKU mới
                </button>
                <button
                  onClick={() => setDeleteMode(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626', cursor: 'pointer' }}
                >
                  <Trash2 size={14} /> Xóa SKU
                </button>
              </>
            ) : (
              <>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setShowConfirm(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} /> Xóa {selectedIds.size} mục
                  </button>
                )}
                <button
                  onClick={exitDeleteMode}
                  style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
                >Hủy</button>
              </>
            )}
          </div>
        )}
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
                <label style={labelStyle}>Mã SKU <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  autoFocus type="text" value={form.note}
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

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 14 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm SKU, tên sản phẩm, khách hàng..."
          style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }}
        />
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
          <Loader2 size={18} /> Đang tải...
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 48 }} />
              <col />
              <col style={{ width: 160 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 150 }} />
              {deleteMode && <col style={{ width: 44 }} />}
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Khách hàng</th>
                <th style={thStyle}>Trạng thái</th>
                <th style={thStyle}>Thời gian tạo</th>
                {deleteMode && (
                  <th style={{ ...thStyle, textAlign: 'center' }}>
                    <input
                      type="checkbox" checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked }}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer', width: 15, height: 15, display: 'block', margin: 'auto' }}
                    />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayed.map(pf => {
                const isChecked = selectedIds.has(pf.id)
                return (
                  <Fragment key={pf.id}>
                    <tr
                      onClick={() => deleteMode ? toggleSelect(pf.id) : setSelectedPf(pf)}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', background: isChecked ? '#fef2f2' : undefined }}
                      onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = deleteMode ? '#fff5f5' : '#f0fdf4' }}
                      onMouseLeave={e => { if (!isChecked) e.currentTarget.style.background = '' }}
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
                      {deleteMode && (
                        <td style={{ ...tdStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox" checked={isChecked} onChange={() => toggleSelect(pf.id)}
                            style={{ cursor: 'pointer', width: 15, height: 15, display: 'block', margin: 'auto' }}
                          />
                        </td>
                      )}
                    </tr>
                  </Fragment>
                )
              })}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={deleteMode ? 6 : 5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    {q ? 'Không tìm thấy kết quả' : 'Chưa có SKU nào'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm delete */}
      {showConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false) }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={18} color="#dc2626" />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Xác nhận xóa {selectedIds.size} SKU</h3>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text2)' }}>
              Hành động này không thể hoàn tác. Các SKU sau sẽ bị xóa vĩnh viễn:
            </p>
            <div style={{ border: '1px solid #fca5a5', borderRadius: 8, overflow: 'hidden', marginBottom: 20, maxHeight: 200, overflowY: 'auto' }}>
              {allItems.filter(pf => selectedIds.has(pf.id)).map((pf, i) => (
                <div key={pf.id} style={{ padding: '9px 14px', fontSize: 13, borderTop: i > 0 ? '1px solid #fca5a5' : undefined, background: i % 2 === 0 ? '#fff5f5' : '#fff' }}>
                  <span style={{ fontWeight: 700, color: '#dc2626', fontFamily: 'monospace' }}>{pf.mfgProduct?.factoryCode}</span>
                  <span style={{ color: 'var(--text3)', margin: '0 6px' }}>—</span>
                  {pf.mfgProduct?.name}
                  {pf.customerName && <span style={{ color: 'var(--text3)', marginLeft: 8, fontSize: 12 }}>· {pf.customerName}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConfirm(false)} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer' }}>
                Hủy
              </button>
              <button
                onClick={handleDelete} disabled={deleting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}
              >
                <Trash2 size={14} /> {deleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, marginTop: 12, color: 'var(--text2)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
const thStyle: React.CSSProperties    = { padding: '12px 16px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const tdStyle: React.CSSProperties    = { padding: '12px 16px' }
