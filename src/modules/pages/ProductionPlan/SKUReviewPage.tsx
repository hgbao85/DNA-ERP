import { useState } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Plus, X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import type { PlanForm, CreatePlanFormPayload } from '../../../types/plan-form'
import { SKUDetail, StatusBadge, STATUS_MAP, PLANFORM_ENTITY } from './SKUDetail'
import SearchInput from '../../../components/SearchInput'
import FilterPills from '../../../components/FilterPills'
import LoadingState from '../../../components/LoadingState'
import { listTh as thStyle, listTd as tdStyle } from '../../../styles/table'

// KHSX theo dõi toàn bộ vòng đời SKU; Sếp (Giám đốc) chỉ cần thấy các item đang chờ mình duyệt lần cuối.
const PLANNER_PENDING_STATUSES = new Set(['WAITING_DETAIL', 'WAITING_PARTS', 'APPROVED_DETAIL', 'APPROVED_PARTS', 'WAITING_BOSS_APPROVAL'])
const BOSS_PENDING_STATUSES = new Set(['WAITING_BOSS_APPROVAL'])
type StatusFilter = 'all' | 'WAITING_DETAIL' | 'WAITING_PARTS' | 'APPROVED_DETAIL' | 'APPROVED_PARTS' | 'WAITING_BOSS_APPROVAL'

const PLANNER_FILTERS: { key: StatusFilter; label: string; color?: string; bg?: string }[] = [
  { key: 'all',             label: 'Tất cả' },
  { key: 'WAITING_DETAIL',  ...STATUS_MAP.WAITING_DETAIL },
  { key: 'WAITING_PARTS',   ...STATUS_MAP.WAITING_PARTS },
  { key: 'APPROVED_DETAIL', ...STATUS_MAP.APPROVED_DETAIL },
  { key: 'APPROVED_PARTS',  ...STATUS_MAP.APPROVED_PARTS },
  { key: 'WAITING_BOSS_APPROVAL', ...STATUS_MAP.WAITING_BOSS_APPROVAL },
]
const BOSS_FILTERS: { key: StatusFilter; label: string; color?: string; bg?: string }[] = [
  { key: 'all',             label: 'Tất cả' },
  { key: 'WAITING_BOSS_APPROVAL', ...STATUS_MAP.WAITING_BOSS_APPROVAL },
]

const emptyForm = (): CreatePlanFormPayload => ({
  exportOrderId: 0, mfgProductId: 0, note: '',
})

export default function SKUReviewPage() {
  const { isBoss } = useAuth()
  const { logAction } = useAuditLog()
  const PENDING_STATUSES = isBoss ? BOSS_PENDING_STATUSES : PLANNER_PENDING_STATUSES
  const FILTERS = isBoss ? BOSS_FILTERS : PLANNER_FILTERS
  const { data: planForms = [], isLoading, refetch } = useFetch(() => api.getPlanForms(), [])
  const { data: formOptions } = useFetch(() => api.getPlanFormOptions(), [])
  const exportOrders = (formOptions?.exportOrders ?? []) as { id: number }[]
  const mfgProducts  = (formOptions?.mfgProducts  ?? []) as { id: number; factoryCode: string; name: string }[]

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedPf, setSelectedPf]     = useState<PlanForm | null>(null)

  // Create form state
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState<CreatePlanFormPayload>(emptyForm)
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [success, setSuccess]           = useState(false)
  const [refreshingSelected, setRefreshingSelected] = useState(false)

  const closeForm = () => { setShowForm(false); setForm(emptyForm()); setCustomerName('') }

  const handleSubmit = async () => {
    const skuCode = (form.note ?? '').trim()
    if (!skuCode) { alert('Vui lòng nhập SKU'); return }
    setSubmitting(true)
    try {
      // Mã SKU người dùng nhập là mã sản phẩm thật (factoryCode) — tái dùng nếu đã tồn tại,
      // không được tự ý gắn vào sản phẩm đầu tiên trong danh sách như trước.
      const existingProduct = mfgProducts.find(p => p.factoryCode?.toLowerCase() === skuCode.toLowerCase())
      const product = existingProduct ?? await api.createMfgProduct({ factoryCode: skuCode, name: skuCode })
      await api.createPlanForm({
        exportOrderId: form.exportOrderId || exportOrders[0]?.id || 0,
        mfgProductId:  product.id,
        note: skuCode,
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
    logAction(PLANFORM_ENTITY, String(selectedPf.id), 'planform.detail_approved')
    refetch()
    setSelectedPf(updated)
  }

  // Việc duyệt mảnh (và ghi log) đã xảy ra ngay trong DinhMucManh (SKUDetail) trước khi gọi callback này —
  // ở đây chỉ cần chuyển trạng thái APPROVED_PARTS (không đổi, đã được set từ lúc account Sắt nhập xong)
  // và làm mới dữ liệu.
  const handleApproveParts = async () => {
    if (!selectedPf) return
    const updated = await api.approvePartsPlanForm(selectedPf.id)
    refetch()
    setSelectedPf(updated)
  }

  // KHSX gửi danh sách mảnh đã duyệt cho sếp phê duyệt lần cuối (thay vì tự bắt đầu sản xuất).
  const handleSendForBossApproval = async () => {
    if (!selectedPf) return
    const updated = await api.requestBossApprovalPlanForm(selectedPf.id)
    logAction(PLANFORM_ENTITY, String(selectedPf.id), 'planform.sent_for_boss_approval')
    refetch()
    setSelectedPf(updated)
  }

  // Sếp duyệt lần cuối — SKU chính thức bắt đầu sản xuất.
  const handleApproveBossRequest = async () => {
    if (!selectedPf) return
    try {
      await api.approveFullPlanForm(selectedPf.id)
      logAction(PLANFORM_ENTITY, String(selectedPf.id), 'planform.boss_approved')
      refetch()
      setSelectedPf(null)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Không thể duyệt')
    }
  }

  // KHSX từ chối định mức chi tiết/mảnh rồi gửi lại cho bộ phận chuyên trách nhập lại từ đầu.
  const handleSendBackDetail = async () => {
    if (!selectedPf) return
    const updated = await api.sendBackDetailPlanForm(selectedPf.id)
    logAction(PLANFORM_ENTITY, String(selectedPf.id), 'planform.detail_sent_back')
    refetch()
    setSelectedPf(updated)
  }

  const handleSendBackManh = async () => {
    if (!selectedPf) return
    const updated = await api.sendBackManhPlanForm(selectedPf.id)
    logAction(PLANFORM_ENTITY, String(selectedPf.id), 'planform.parts_sent_back')
    refetch()
    setSelectedPf(updated)
  }

  // Lấy lại đúng SKU đang xem — cần khi 1 trong 4 account chuyên trách vừa nhập/duyệt định mức
  // ở phiên đăng nhập khác, để cập nhật trạng thái + dữ liệu mới nhất mà không phải tải lại cả trang.
  const handleRefreshSelected = async () => {
    if (!selectedPf) return
    setRefreshingSelected(true)
    try {
      const fresh = await api.getPlanForm(selectedPf.id)
      setSelectedPf(fresh)
      refetch()
    } finally {
      setRefreshingSelected(false)
    }
  }

  if (selectedPf) {
    return (
      <SKUDetail
        key={`${selectedPf.id}-${selectedPf.status}`}
        pf={selectedPf}
        onBack={() => setSelectedPf(null)}
        onApproveDetail={handleApproveDetail}
        onApproveParts={handleApproveParts}
        onSendForBossApproval={handleSendForBossApproval}
        onApproveBossRequest={handleApproveBossRequest}
        onSendBackDetail={handleSendBackDetail}
        onSendBackManh={handleSendBackManh}
        onRefresh={handleRefreshSelected}
        refreshing={refreshingSelected}
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
        <FilterPills options={FILTERS} active={statusFilter} onChange={setStatusFilter} countFor={countByStatus} />
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm SKU, sản phẩm, khách hàng..." />
      </div>

      {isLoading ? (
        <LoadingState />
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

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, marginTop: 12, color: 'var(--text2)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
