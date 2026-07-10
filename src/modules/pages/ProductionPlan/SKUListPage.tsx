import { useState, Fragment } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Trash2 } from 'lucide-react'
import type { PlanForm } from '../../../types/plan-form'
import { SKUDetail, StatusBadge, STATUS_MAP } from './SKUDetail'
import SearchInput from '../../../components/SearchInput'
import FilterPills from '../../../components/FilterPills'
import LoadingState from '../../../components/LoadingState'
import { listTh as thStyle, listTd as tdStyle } from '../../../styles/table'

type StatusFilter = 'all' | 'WAITING_DETAIL' | 'WAITING_PARTS' | 'APPROVED_DETAIL' | 'APPROVED_PARTS' | 'WAITING_BOSS_APPROVAL' | 'APPROVED'

const FILTERS: { key: StatusFilter; label: string; color?: string; bg?: string }[] = [
  { key: 'all',             label: 'Tất cả' },
  { key: 'WAITING_DETAIL',  ...STATUS_MAP.WAITING_DETAIL },
  { key: 'WAITING_PARTS',   ...STATUS_MAP.WAITING_PARTS },
  { key: 'APPROVED_DETAIL', ...STATUS_MAP.APPROVED_DETAIL },
  { key: 'APPROVED_PARTS',  ...STATUS_MAP.APPROVED_PARTS },
  { key: 'WAITING_BOSS_APPROVAL', ...STATUS_MAP.WAITING_BOSS_APPROVAL },
  { key: 'APPROVED',        ...STATUS_MAP.APPROVED },
]

export default function SKUListPage({ readOnly = false }: { readOnly?: boolean }) {
  const { data: planForms = [], isLoading, refetch } = useFetch(() => api.getPlanForms(), [])

  const [selectedPf, setSelectedPf] = useState<PlanForm | null>(null)
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Show all non-DRAFT items, trừ PlanForm sinh tự động khi PM "xác nhận sản xuất" (LenhSXPage) —
  // đó không phải SKU do KHSX tạo/quản lý, chỉ phục vụ "Lệnh kiểm tra vật tư".
  const allItems = ((planForms ?? []) as PlanForm[]).filter(pf => pf.status !== 'DRAFT' && pf.origin !== 'PRODUCTION_CONFIRM')
  const countByStatus = (s: StatusFilter) => s === 'all' ? allItems.length : allItems.filter(pf => pf.status === s).length

  const afterFilter = statusFilter === 'all' ? allItems : allItems.filter(pf => pf.status === statusFilter)
  const q = search.trim().toLowerCase()
  const displayed = q
    ? afterFilter.filter(pf =>
        [pf.mfgProduct?.factoryCode, pf.mfgProduct?.name, pf.customerName]
          .some(v => v?.toLowerCase().includes(q))
      )
    : afterFilter

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách SKU</h2>
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!deleteMode ? (
              <>
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

      {/* Status filter + search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <FilterPills options={FILTERS} active={statusFilter} onChange={setStatusFilter} countFor={countByStatus} />
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm SKU, tên sản phẩm, khách hàng..." />
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
