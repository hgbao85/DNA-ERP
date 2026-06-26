import { useState, Fragment } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { ChevronLeft, Loader2, Search, Trash2 } from 'lucide-react'
import type { PlanForm } from '../../../types/plan-form'

export default function SKUListPage() {
  const { data: planForms = [], isLoading, refetch } = useFetch(() => api.getPlanForms(), [])

  const [selectedPf, setSelectedPf] = useState<PlanForm | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

  const approved = ((planForms ?? []) as PlanForm[]).filter(pf => pf.status === 'APPROVED')
  const q = search.trim().toLowerCase()
  const displayed = q
    ? approved.filter(pf => [pf.mfgProduct?.factoryCode, pf.mfgProduct?.name, pf.customerName].some(v => v?.toLowerCase().includes(q)))
    : approved

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

  const handleProposeExisting = async (id: number) => {
    setSubmitting(true)
    try {
      await api.proposePlanFormById(id)
      refetch()
      setSelectedPf(prev => prev?.id === id ? { ...prev, status: 'PROPOSED' } : prev)
    } catch {
      alert('Không thể gửi đề xuất')
    } finally {
      setSubmitting(false)
    }
  }

  if (selectedPf) {
    return (
      <PlanFormDetail
        pf={selectedPf}
        submitting={submitting}
        onBack={() => setSelectedPf(null)}
        onPropose={() => handleProposeExisting(selectedPf.id)}
      />
    )
  }

  const allChecked = displayed.length > 0 && selectedIds.size === displayed.length
  const someChecked = selectedIds.size > 0 && !allChecked

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách SKU</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text2)' }}>
            SKU đã được duyệt
          </p>
        </div>
        {!deleteMode ? (
          <button
            onClick={() => setDeleteMode(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626', cursor: 'pointer' }}
          >
            <Trash2 size={14} /> Xóa SKU
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
            >
              Hủy
            </button>
          </div>
        )}
      </div>

      {/* Searchbar */}
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 14 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
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
              <col style={{ width: 110 }} />
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
                  <th style={{ ...thStyle, padding: '10px 12px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked }}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer', width: 15, height: 15, display: 'block', margin: 'auto' }}
                    />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayed.map((pf) => {
                const isChecked = selectedIds.has(pf.id)
                return (
                  <Fragment key={pf.id}>
                    <tr
                      onClick={() => deleteMode ? toggleSelect(pf.id) : setSelectedPf(pf)}
                      style={{
                        borderTop: '1px solid var(--border)', cursor: 'pointer',
                        background: isChecked ? '#fef2f2' : undefined,
                      }}
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
                      <td style={tdStyle}>
                        <StatusBadge status={pf.status} />
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: 12 }}>
                        {format(new Date(pf.createdAt), 'HH:mm · dd/MM/yyyy')}
                      </td>
                      {deleteMode && (
                        <td style={{ ...tdStyle, padding: '10px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(pf.id)}
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
                    {q ? 'Không tìm thấy kết quả' : 'Chưa có SKU nào được duyệt'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm delete popup */}
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
              {approved.filter(pf => selectedIds.has(pf.id)).map((pf, i) => (
                <div key={pf.id} style={{ padding: '9px 14px', fontSize: 13, borderTop: i > 0 ? '1px solid #fca5a5' : undefined, background: i % 2 === 0 ? '#fff5f5' : '#fff' }}>
                  <span style={{ fontWeight: 700, color: '#dc2626', fontFamily: 'monospace' }}>{pf.mfgProduct?.factoryCode}</span>
                  <span style={{ color: 'var(--text3)', margin: '0 6px' }}>—</span>
                  {pf.mfgProduct?.name}
                  {pf.customerName && <span style={{ color: 'var(--text3)', marginLeft: 8, fontSize: 12 }}>· {pf.customerName}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
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

function PlanFormDetail({
  pf, submitting, onBack, onPropose,
}: {
  pf: PlanForm
  submitting: boolean
  onBack: () => void
  onPropose: () => void
}) {
  const mt = pf.quotaManagement?.materialType
  type SecEntry = { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null
  const [secStatus, setSecStatus] = useState<Record<'sat'|'daySon'|'vatTuPhuKien'|'baoBiDongGoi', SecEntry>>({
    sat: null, daySon: null, vatTuPhuKien: null, baoBiDongGoi: null,
  })
  const approve = (k: keyof typeof secStatus) => setSecStatus(p => ({ ...p, [k]: { status: 'APPROVED', at: new Date() } }))
  const approveAll = () => (['sat', 'daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as const).forEach(k => approve(k))
  const allApproved = (['sat', 'daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as const).every(k => secStatus[k]?.status === 'APPROVED')

  type RejectModal = { key: keyof typeof secStatus; title: string } | null
  const [rejectModal, setRejectModal] = useState<RejectModal>(null)
  const [rejectReason, setRejectReason] = useState('')
  const openReject = (k: keyof typeof secStatus, title: string) => { setRejectModal({ key: k, title }); setRejectReason('') }

  type SecFilter = 'all' | 'sat' | 'daySon' | 'vatTuPhuKien' | 'baoBiDongGoi'
  const [filterSec, setFilterSec] = useState<SecFilter>('all')

  type DetailTab = 'chitiet' | 'manh'
  const [detailTab, setDetailTab] = useState<DetailTab>('chitiet')

  type CheckState = 'idle' | 'checking' | 'ok' | 'missing'
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [missingMats, setMissingMats] = useState<{ name: string; required: number; unit: string; available: number }[]>([])
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const handleCheck = async () => {
    setCheckState('checking')
    try {
      const warehouseItems: any[] = await (api as any).getAllMfgWarehouseItems()
      const required: { name: string; required: number; unit: string }[] = []
      ;(Array.isArray(mt?.sat) ? mt.sat : []).forEach((i: any) => {
        if (i.name) required.push({ name: i.name, required: i.quantity ?? 1, unit: i.unit ?? '' })
      })
      ;(Array.isArray(mt?.daySon) ? mt.daySon : []).forEach((i: any) => {
        if (i.name) required.push({ name: i.name, required: i.kg ?? i.quantity ?? 1, unit: i.unit ?? 'kg' })
      })
      ;(Array.isArray(mt?.vatTuPhuKien) ? mt.vatTuPhuKien : []).forEach((i: any) => {
        if (i.name) required.push({ name: i.name, required: i.quantity ?? 1, unit: i.unit ?? 'cái' })
      })
      ;(Array.isArray(mt?.baoBiDongGoi) ? mt.baoBiDongGoi : []).forEach((i: any) => {
        if (i.name) required.push({ name: i.name, required: i.quantity ?? 1, unit: i.unit ?? 'thùng' })
      })

      const missing: { name: string; required: number; unit: string; available: number }[] = []
      for (const req of required) {
        const wItem = warehouseItems.find((w: any) =>
          w.name?.toLowerCase().trim() === req.name.toLowerCase().trim()
        )
        const available = wItem?.quantity ?? 0
        if (available < req.required) missing.push({ ...req, available })
      }
      setMissingMats(missing)
      setCheckState(missing.length === 0 ? 'ok' : 'missing')
    } catch {
      setCheckState('idle')
    }
  }

  const confirmReject = () => {
    if (!rejectModal) return
    setSecStatus(p => ({ ...p, [rejectModal.key]: { status: 'REJECTED', at: new Date(), reason: rejectReason.trim() || undefined } }))
    setRejectModal(null)
  }

  const handleSend = async () => {
    setSending(true)
    await new Promise(r => setTimeout(r, 700))
    setSending(false)
    setSent(true)
    setShowSendModal(false)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
        >
          <ChevronLeft size={16} /> Danh sách
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{pf.mfgProduct?.name}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text3)' }}>
            Tạo lúc {format(new Date(pf.createdAt), 'HH:mm dd/MM/yyyy')}
          </p>
        </div>
      </div>

      {/* Thông tin chung — compact strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 28px', padding: '10px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
        <span><span style={{ color: 'var(--text3)' }}>Mã nhà máy: </span><strong>{pf.mfgProduct?.factoryCode ?? '—'}</strong></span>
        <span><span style={{ color: 'var(--text3)' }}>Sản phẩm: </span><strong>{pf.mfgProduct?.name ?? '—'}</strong></span>
        {pf.proposedAt && <span><span style={{ color: 'var(--text3)' }}>Đề xuất: </span><strong>{format(new Date(pf.proposedAt), 'dd/MM/yyyy')}</strong></span>}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([['chitiet', 'Định mức chi tiết'], ['manh', 'Định mức mảnh']] as [DetailTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setDetailTab(id)}
            style={{
              padding: '8px 20px', fontSize: 13, fontWeight: detailTab === id ? 700 : 500,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: detailTab === id ? '#2e7d32' : 'var(--text2)',
              borderBottom: detailTab === id ? '2px solid #2e7d32' : '2px solid transparent',
              marginBottom: -1,
            }}
          >{label}</button>
        ))}
      </div>

      {/* Tab: Định mức mảnh */}
      {detailTab === 'manh' && <DinhMucManh pfId={pf.id} />}

      {/* Tab: Định mức chi tiết */}
      {detailTab === 'chitiet' && (mt ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Danh sách định mức chi tiết</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {([
                ['all',          'Tất cả'],
                ['sat',          'Sắt'],
                ['daySon',       'Dây / Sơn'],
                ['vatTuPhuKien', 'Phụ kiện'],
                ['baoBiDongGoi', 'Bao bì'],
              ] as [SecFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilterSec(key)}
                  style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: filterSec === key ? '#2e7d32' : 'var(--surface2)',
                    color: filterSec === key ? '#fff' : 'var(--text)',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(filterSec === 'all' || filterSec === 'sat') && (
              <MaterialSection
                title="Sắt" color="#b45309" bg="#fef3c7"
                entry={secStatus.sat} onApprove={() => approve('sat')} onReject={() => openReject('sat', 'Sắt')}
                items={(Array.isArray(mt.sat) ? mt.sat : []).map(i => ({
                  name: i.name,
                  spec: [i.specifications, i.thickness != null ? `dày ${i.thickness}mm` : null].filter(Boolean).join(', ') || null,
                  unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
                  createdAt: i.createdAt ?? null,
                }))}
              />
            )}
            {(filterSec === 'all' || filterSec === 'daySon') && (
              <MaterialSection
                title="Dây / Sơn" color="#1d4ed8" bg="#eff6ff"
                entry={secStatus.daySon} onApprove={() => approve('daySon')} onReject={() => openReject('daySon', 'Dây / Sơn')}
                items={(Array.isArray(mt.daySon) ? mt.daySon : []).map(i => ({
                  name: i.name,
                  spec: i.specifications || null,
                  unitQty: i.kg != null ? `${i.kg} kg` : (i.unit ?? null),
                  createdAt: i.createdAt ?? null,
                }))}
              />
            )}
            {(filterSec === 'all' || filterSec === 'vatTuPhuKien') && (
              <MaterialSection
                title="Vật tư phụ kiện" color="#6d28d9" bg="#ede9fe"
                entry={secStatus.vatTuPhuKien} onApprove={() => approve('vatTuPhuKien')} onReject={() => openReject('vatTuPhuKien', 'Vật tư phụ kiện')}
                items={(Array.isArray(mt.vatTuPhuKien) ? mt.vatTuPhuKien : []).map(i => ({
                  name: i.name,
                  spec: i.specifications || null,
                  unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
                  createdAt: i.createdAt ?? null,
                }))}
              />
            )}
            {(filterSec === 'all' || filterSec === 'baoBiDongGoi') && (
              <MaterialSection
                title="Bao bì đóng gói" color="#065f46" bg="#d1fae5"
                entry={secStatus.baoBiDongGoi} onApprove={() => approve('baoBiDongGoi')} onReject={() => openReject('baoBiDongGoi', 'Bao bì đóng gói')}
                items={(Array.isArray(mt.baoBiDongGoi) ? mt.baoBiDongGoi : []).map(i => ({
                  name: i.name,
                  spec: i.specifications || null,
                  unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
                  createdAt: i.createdAt ?? null,
                }))}
              />
            )}
          </div>

          {/* Buttons góc dưới phải */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            {sent && (
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Đã gửi đi nhập mảnh thành công</span>
            )}
            {checkState === 'ok' && !sent && (
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Đủ vật tư, sẵn sàng sản xuất</span>
            )}
            {!allApproved && (
              <span style={{ fontSize: 12, color: '#d97706' }}>Cần duyệt đủ 4 loại vật tư trước</span>
            )}
            {!allApproved && filterSec === 'all' && (
              <button
                onClick={approveAll}
                style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer' }}
              >Duyệt tất cả</button>
            )}
            <button
              onClick={handleCheck}
              disabled={!allApproved || checkState === 'checking' || sent}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #2563eb', background: allApproved && !sent ? '#eff6ff' : '#f3f4f6', color: allApproved && !sent ? '#2563eb' : '#9ca3af', cursor: allApproved && !sent ? 'pointer' : 'not-allowed', opacity: checkState === 'checking' ? 0.6 : 1 }}
            >{checkState === 'checking' ? 'Đang kiểm...' : 'Kiểm vật tư'}</button>
            <button
              disabled={checkState !== 'ok' || sent}
              onClick={() => setShowSendModal(true)}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: checkState === 'ok' && !sent ? 'pointer' : 'not-allowed', background: checkState === 'ok' && !sent ? '#16a34a' : '#e5e7eb', color: checkState === 'ok' && !sent ? '#fff' : '#9ca3af' }}
            >{sent ? 'Đã gửi' : 'Gửi đi nhập mảnh'}</button>
          </div>

          {/* Danh sách vật tư thiếu */}
          {checkState === 'missing' && (
            <div style={{ marginTop: 16, border: '1px solid #fca5a5', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#fee2e2', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#dc2626' }}>⚠ Thiếu {missingMats.length} loại vật tư</span>
                <button
                  onClick={() => setShowBuyModal(true)}
                  style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#e65100', color: '#fff' }}
                >Mua hàng</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fff5f5' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>Tên vật tư</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>Cần</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>Tồn kho</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>Thiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {missingMats.map((m, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #fee2e2' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 500 }}>{m.name}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--text2)' }}>{m.required} {m.unit}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#dc2626' }}>{m.available} {m.unit}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>+{m.required - m.available} {m.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: 20, background: 'var(--surface2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, marginBottom: 24 }}>
          Chưa có thông tin định mức chi tiết
        </div>
      ))}

      {/* Popup nhập lý do từ chối */}
      {/* Modal xác nhận mua hàng */}
      {showBuyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowBuyModal(false) }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 520, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Xác nhận tạo đề xuất mua hàng</h3>

            {/* Thông tin định mức */}
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{pf.mfgProduct?.factoryCode} — {pf.mfgProduct?.name}</div>
              <div style={{ color: 'var(--text3)' }}>Lệnh SX: <strong style={{ color: 'var(--text)' }}>{pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`}</strong>
                {pf.exportOrder?.deliveryDate && <span> · Giao hàng: <strong style={{ color: 'var(--text)' }}>{format(new Date(pf.exportOrder.deliveryDate), 'dd/MM/yyyy')}</strong></span>}
              </div>
            </div>

            {/* Danh sách vật tư cần mua */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              Vật tư cần mua ({missingMats.length} loại)
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)', fontSize: 12 }}>Tên vật tư</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: 12 }}>Tồn kho</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: 12 }}>Cần mua thêm</th>
                  </tr>
                </thead>
                <tbody>
                  {missingMats.map((m, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 500 }}>{m.name}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#dc2626' }}>{m.available} {m.unit}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#e65100' }}>+{m.required - m.available} {m.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBuyModal(false)} style={btnSecondary}>Hủy</button>
              <button
                onClick={() => { alert('Đã tạo đề xuất mua hàng thành công!'); setShowBuyModal(false) }}
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#e65100', color: '#fff' }}
              >Xác nhận tạo đề xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận gửi đi nhập mảnh */}
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      {showSendModal && mt && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget && !sending) setShowSendModal(false) }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,.24)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', borderRadius: '14px 14px 0 0' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>Xác nhận gửi đi nhập mảnh</div>
                <div style={{ fontSize: 12, color: '#4ade80', marginTop: 2 }}>Kiểm tra lại toàn bộ thông tin trước khi gửi</div>
              </div>
              <button onClick={() => setShowSendModal(false)} disabled={sending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Thông tin SKU */}
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Thông tin định mức</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: 13 }}>
                  <div><span style={{ color: 'var(--text3)' }}>Mã nhà máy: </span><strong style={{ fontFamily: 'monospace', color: '#0369a1' }}>{pf.mfgProduct?.factoryCode ?? '—'}</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>Sản phẩm: </span><strong>{pf.mfgProduct?.name ?? '—'}</strong></div>
                  <div><span style={{ color: 'var(--text3)' }}>Lệnh SX / PO: </span><strong style={{ fontFamily: 'monospace' }}>{pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`}</strong></div>
                  {pf.exportOrder?.deliveryDate && (
                    <div><span style={{ color: 'var(--text3)' }}>Hạn giao: </span><strong>{format(new Date(pf.exportOrder.deliveryDate), 'dd/MM/yyyy')}</strong></div>
                  )}
                  <div><span style={{ color: 'var(--text3)' }}>Ngày tạo: </span><strong>{format(new Date(pf.createdAt), 'dd/MM/yyyy')}</strong></div>
                  {pf.createdBy && <div><span style={{ color: 'var(--text3)' }}>Người tạo: </span><strong>{pf.createdBy.name}</strong></div>}
                </div>
              </div>

              {/* Trạng thái duyệt */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Trạng thái duyệt vật tư</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {([
                    ['sat',          'Sắt',              '#b45309', '#fef3c7'],
                    ['daySon',       'Dây / Sơn',        '#1d4ed8', '#eff6ff'],
                    ['vatTuPhuKien', 'Vật tư phụ kiện',  '#6d28d9', '#ede9fe'],
                    ['baoBiDongGoi', 'Bao bì đóng gói',  '#065f46', '#d1fae5'],
                  ] as [keyof typeof secStatus, string, string, string][]).map(([k, label, color, bg]) => {
                    const e = secStatus[k]
                    return (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: bg }}>
                        <span style={{ fontSize: 14, color: '#16a34a' }}>✓</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color }}>{label}</div>
                          {e?.at && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>Duyệt lúc {format(e.at, 'HH:mm dd/MM/yy')}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Danh sách vật tư */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Danh sách vật tư sẽ gửi nhập mảnh
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {([
                    ['sat',          'Sắt',              '#b45309', '#fef3c7', Array.isArray(mt.sat) ? mt.sat : []],
                    ['daySon',       'Dây / Sơn',        '#1d4ed8', '#eff6ff', Array.isArray(mt.daySon) ? mt.daySon : []],
                    ['vatTuPhuKien', 'Vật tư phụ kiện',  '#6d28d9', '#ede9fe', Array.isArray(mt.vatTuPhuKien) ? mt.vatTuPhuKien : []],
                    ['baoBiDongGoi', 'Bao bì đóng gói',  '#065f46', '#d1fae5', Array.isArray(mt.baoBiDongGoi) ? mt.baoBiDongGoi : []],
                  ] as [string, string, string, string, any[]][]).map(([key, label, color, bg, items], gi) => items.length === 0 ? null : (
                    <div key={key} style={{ borderTop: gi === 0 ? 'none' : '1px solid var(--border)' }}>
                      <div style={{ background: bg, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
                        <span style={{ fontSize: 11, color, opacity: 0.6 }}>({items.length} loại)</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <tbody>
                          {items.map((item: any, idx: number) => {
                            const qty = key === 'daySon'
                              ? (item.kg != null ? `${item.kg} kg` : (item.unit ?? '—'))
                              : (item.quantity != null ? `${item.quantity} ${item.unit ?? ''}`.trim() : (item.unit ?? '—'))
                            return (
                              <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '7px 14px', fontWeight: 500, width: '40%' }}>{item.name}</td>
                                <td style={{ padding: '7px 14px', color: 'var(--text3)', width: '45%', fontSize: 11 }}>
                                  {[item.specifications, item.thickness != null ? `dày ${item.thickness}mm` : null].filter(Boolean).join(', ') || '—'}
                                </td>
                                <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: '#0369a1' }}>{qty}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ghi chú */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                Sau khi xác nhận, yêu cầu nhập mảnh sẽ được chuyển đến bộ phận cơ khí để tiến hành cắt và uốn phôi theo định mức trên.
              </div>
            </div>

            {/* Footer actions */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--surface)' }}>
              <button onClick={() => setShowSendModal(false)} disabled={sending} style={btnSecondary}>Hủy</button>
              <button
                onClick={handleSend}
                disabled={sending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 22px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', cursor: sending ? 'not-allowed' : 'pointer', background: sending ? '#86efac' : '#16a34a', color: '#fff', opacity: sending ? 0.8 : 1 }}
              >
                {sending
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Đang gửi...</>
                  : 'Xác nhận gửi đi nhập mảnh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Từ chối — {rejectModal.title}</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text3)' }}>Nhập lý do từ chối (không bắt buộc)</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Vd: Sai quy cách, thiếu thông tin..."
              rows={3}
              autoFocus
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setRejectModal(null)} style={btnSecondary}>Hủy</button>
              <button onClick={confirmReject} style={{ ...btnGreen, background: '#dc2626' }}>Xác nhận từ chối</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type MaterialRow = { name: string; spec: string | null; unitQty: string | null; createdAt: string | null }

function MaterialSection({
  title, color, bg, items, entry, onApprove, onReject,
}: {
  title: string
  color: string
  bg: string
  items: MaterialRow[]
  entry: { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null
  onApprove: () => void
  onReject: () => void
}) {
  const status = entry?.status ?? null
  const latestAt = items.reduce<string | null>(
    (acc, r) => r.createdAt && (!acc || r.createdAt > acc) ? r.createdAt : acc, null
  )
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: bg, padding: '8px 14px', borderBottom: `1px solid var(--border)` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color, fontWeight: 700, fontSize: 12 }}>
            {title} <span style={{ fontWeight: 400, opacity: 0.7 }}>({items.length} loại)</span>
            {latestAt && (
              <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.65, marginLeft: 8 }}>
                {format(new Date(latestAt), 'HH:mm · dd/MM/yyyy')}
              </span>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {status && <StatusBadge status={status} />}
            <button
              onClick={onApprove}
              style={{
                padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: status === 'APPROVED' ? '#16a34a' : 'rgba(22,163,74,0.12)',
                color: status === 'APPROVED' ? '#fff' : '#16a34a',
              }}
            >Duyệt</button>
            <button
              onClick={onReject}
              style={{
                padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: status === 'REJECTED' ? '#dc2626' : 'rgba(220,38,38,0.10)',
                color: status === 'REJECTED' ? '#fff' : '#dc2626',
              }}
            >Từ chối</button>
          </div>
        </div>
        {status === 'REJECTED' && entry?.reason && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626', fontStyle: 'italic' }}>
            {entry.reason}
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text3)' }}>—</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '35%' }} />
              <col />
              <col style={{ width: 96 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={{ padding: '7px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text3)' }}>Tên vật tư</th>
                <th style={{ padding: '7px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text3)' }}>Quy cách</th>
                <th style={{ padding: '7px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>ĐVT / SL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.spec ?? '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.unitQty ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
      )}
    </div>
  )
}


// ─── Định mức mảnh ───────────────────────────────────────────────────────────

interface ManhRow {
  id: number
  code: string
  name: string
  material: string
  thickness: number
  length: number | null
  qty: number
  unit: string
  note: string
}

const MOCK_MANH_BY_PF: Record<number, ManhRow[]> = {
  1: [
    { id: 1, code: 'M-001', name: 'Khung chân trước',   material: 'Ống thép 25×25', thickness: 1.2, length: 450, qty: 2, unit: 'thanh', note: 'Cắt góc 45° hai đầu' },
    { id: 2, code: 'M-002', name: 'Khung chân sau',     material: 'Ống thép 25×25', thickness: 1.2, length: 480, qty: 2, unit: 'thanh', note: '' },
    { id: 3, code: 'M-003', name: 'Thanh ngang trên',   material: 'Ống thép 20×20', thickness: 1.0, length: 520, qty: 2, unit: 'thanh', note: '' },
    { id: 4, code: 'M-004', name: 'Thanh ngang dưới',   material: 'Ống thép 20×20', thickness: 1.0, length: 520, qty: 2, unit: 'thanh', note: '' },
    { id: 5, code: 'M-005', name: 'Thanh tựa lưng',     material: 'Ống thép D18',   thickness: 1.2, length: 380, qty: 3, unit: 'thanh', note: 'Uốn cong bán kính 200mm' },
    { id: 6, code: 'M-006', name: 'Tấm đỡ ghế',         material: 'Tấm sắt',        thickness: 1.5, length: null, qty: 1, unit: 'tấm',   note: 'Dập lỗ theo bản vẽ' },
  ],
}
const MOCK_MANH_DEFAULT: ManhRow[] = [
  { id: 1, code: 'M-001', name: 'Thanh đứng chính',    material: 'Ống thép 30×30', thickness: 1.5, length: 600, qty: 4, unit: 'thanh', note: '' },
  { id: 2, code: 'M-002', name: 'Thanh ngang khung',   material: 'Ống thép 25×25', thickness: 1.2, length: 480, qty: 4, unit: 'thanh', note: 'Cắt vuông góc' },
  { id: 3, code: 'M-003', name: 'Tấm đáy',             material: 'Tấm sắt CT3',   thickness: 2.0, length: null, qty: 1, unit: 'tấm',   note: 'Kích thước 480×380mm' },
  { id: 4, code: 'M-004', name: 'Thanh giằng chéo',    material: 'Ống thép D16',   thickness: 1.2, length: 520, qty: 2, unit: 'thanh', note: 'Uốn đầu, khoan lỗ D8' },
  { id: 5, code: 'M-005', name: 'Tai móc treo',         material: 'Thép tấm 3mm',  thickness: 3.0, length: null, qty: 4, unit: 'cái',   note: 'Dập nguội, mạ kẽm' },
]

type ManhApprovalEntry = { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null

function DinhMucManh({ pfId }: { pfId: number }) {
  const rows = MOCK_MANH_BY_PF[pfId] ?? MOCK_MANH_DEFAULT
  const [approval, setApproval] = useState<ManhApprovalEntry>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showConfirmProd, setShowConfirmProd] = useState(false)
  const [producing, setProducing] = useState(false)
  const [produced, setProduced] = useState(false)

  const handleApprove = () => setApproval({ status: 'APPROVED', at: new Date() })
  const openReject = () => { setShowRejectModal(true); setRejectReason('') }
  const confirmReject = () => {
    setApproval({ status: 'REJECTED', at: new Date(), reason: rejectReason.trim() || undefined })
    setShowRejectModal(false)
  }
  const handleConfirmProd = async () => {
    setProducing(true)
    await new Promise(r => setTimeout(r, 600))
    setProducing(false)
    setProduced(true)
    setShowConfirmProd(false)
  }

  const isApproved = approval?.status === 'APPROVED'
  const isRejected = approval?.status === 'REJECTED'

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Section header — duyệt */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ background: isApproved ? '#f0fdf4' : isRejected ? '#fff5f5' : '#fafaf9', padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 13, color: isApproved ? '#15803d' : isRejected ? '#dc2626' : 'var(--text)' }}>
              Danh sách mảnh phôi
            </span>
            <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
              ({rows.length} mảnh · {rows.reduce((s, r) => s + r.qty, 0)} chi tiết)
            </span>
            {approval && (
              <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--text3)' }}>
                · {format(approval.at, 'HH:mm dd/MM/yyyy')}
              </span>
            )}
            {isRejected && approval?.reason && (
              <div style={{ fontSize: 11, color: '#dc2626', fontStyle: 'italic', marginTop: 2 }}>{approval.reason}</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {approval && <StatusBadge status={approval.status} />}
            <button
              onClick={handleApprove}
              style={{
                padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: isApproved ? '#16a34a' : 'rgba(22,163,74,0.12)',
                color: isApproved ? '#fff' : '#16a34a',
              }}
            >Duyệt</button>
            <button
              onClick={openReject}
              style={{
                padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: isRejected ? '#dc2626' : 'rgba(220,38,38,0.10)',
                color: isRejected ? '#fff' : '#dc2626',
              }}
            >Từ chối</button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 80 }} />
            <col />
            <col style={{ width: 140 }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 56 }} />
            <col />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={thStyle}>Mã mảnh</th>
              <th style={thStyle}>Tên mảnh</th>
              <th style={thStyle}>Vật liệu</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Dày (mm)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Dài (mm)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>SL</th>
              <th style={thStyle}>ĐVT</th>
              <th style={thStyle}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700, color: '#2e7d32', fontSize: 12 }}>{r.code}</td>
                <td style={{ ...tdStyle, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
                <td style={{ ...tdStyle, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.material}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{r.thickness}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text2)' }}>{r.length ?? '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{r.qty}</td>
                <td style={{ ...tdStyle, color: 'var(--text3)' }}>{r.unit}</td>
                <td style={{ ...tdStyle, color: 'var(--text3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        {produced && (
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Đã xác nhận bắt đầu sản xuất</span>
        )}
        {!isApproved && !produced && (
          <span style={{ fontSize: 12, color: '#d97706' }}>Cần duyệt danh sách mảnh trước</span>
        )}
        <button
          disabled={!isApproved || produced}
          onClick={() => setShowConfirmProd(true)}
          style={{
            padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
            cursor: isApproved && !produced ? 'pointer' : 'not-allowed',
            background: isApproved && !produced ? '#16a34a' : '#e5e7eb',
            color: isApproved && !produced ? '#fff' : '#9ca3af',
          }}
        >{produced ? 'Đã bắt đầu sản xuất' : 'Bắt đầu sản xuất'}</button>
      </div>

      {/* Modal xác nhận bắt đầu cắt phôi */}
      {showConfirmProd && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowConfirmProd(false) }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Xác nhận bắt đầu sản xuất</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text2)' }}>
              Danh sách mảnh đã được duyệt. Xác nhận để chuyển sang giai đoạn sản xuất.
            </p>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tóm tắt danh sách mảnh
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
                <div><span style={{ color: 'var(--text3)' }}>Tổng mảnh: </span><strong>{rows.length} loại</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>Chi tiết: </span><strong>{rows.reduce((s, r) => s + r.qty, 0)} cái</strong></div>
                <div><span style={{ color: 'var(--text3)' }}>Duyệt lúc: </span><strong>{approval ? format(approval.at, 'HH:mm dd/MM/yyyy') : '—'}</strong></div>
              </div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20, maxHeight: 200, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)' }}>Mã / Tên mảnh</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)' }}>Vật liệu</th>
                    <th style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)' }}>SL</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                      <td style={{ padding: '7px 12px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2e7d32', marginRight: 6 }}>{r.code}</span>
                        {r.name}
                      </td>
                      <td style={{ padding: '7px 12px', color: 'var(--text3)' }}>{r.material}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>{r.qty} {r.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmProd(false)}
                style={btnSecondary}
              >Hủy</button>
              <button
                onClick={handleConfirmProd}
                disabled={producing}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: producing ? 'not-allowed' : 'pointer', background: '#16a34a', color: '#fff', opacity: producing ? 0.7 : 1 }}
              >{producing ? 'Đang xử lý...' : 'Xác nhận bắt đầu sản xuất'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal từ chối */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Từ chối — Danh sách mảnh phôi</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text3)' }}>Nhập lý do từ chối (không bắt buộc)</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Vd: Sai kích thước, thiếu mảnh, cần bổ sung..."
              rows={3}
              autoFocus
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowRejectModal(false)} style={btnSecondary}>Hủy</button>
              <button onClick={confirmReject} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff' }}>Xác nhận từ chối</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PROPOSED: { label: 'Chờ duyệt', color: '#d97706', bg: '#fef3c7' },
  APPROVED: { label: 'Đã duyệt',  color: '#16a34a', bg: '#dcfce7' },
  REJECTED: { label: 'Từ chối',   color: '#dc2626', bg: '#fee2e2' },
}
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.PROPOSED
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

const thStyle: React.CSSProperties      = { padding: '12px 16px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const tdStyle: React.CSSProperties      = { padding: '12px 16px' }
const btnGreen: React.CSSProperties     = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }
