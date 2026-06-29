import { useState } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Loader2, Search } from 'lucide-react'
import type { PlanForm } from '../../../types/plan-form'
import { SKUDetail, StatusBadge, STATUS_MAP } from './SKUDetail'

const PENDING_STATUSES = new Set(['APPROVED_DETAIL', 'APPROVED_PARTS'])
type StatusFilter = 'all' | 'APPROVED_DETAIL' | 'APPROVED_PARTS'

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',             label: 'Tất cả' },
  { key: 'APPROVED_DETAIL', label: STATUS_MAP.APPROVED_DETAIL.label },
  { key: 'APPROVED_PARTS',  label: STATUS_MAP.APPROVED_PARTS.label },
]

export default function SKUReviewPage() {
  const { data: planForms = [], isLoading, refetch } = useFetch(() => api.getPlanForms(), [])

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedPf, setSelectedPf]     = useState<PlanForm | null>(null)

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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Duyệt SKU</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>
            {isLoading ? '...' : `${pending.length} SKU chờ duyệt`}
          </span>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm SKU, sản phẩm, khách hàng..."
              style={{ paddingLeft: 32, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', outline: 'none', width: 280 }}
            />
          </div>
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
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
