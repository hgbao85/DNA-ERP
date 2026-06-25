import { useState, Fragment } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { ChevronLeft, Loader2 } from 'lucide-react'
import type { PlanForm, CreatePlanFormPayload } from '../../../types/plan-form'


const emptyMaterialType = (): CreatePlanFormPayload['materialType'] => ({
  sat: { type: '', specifications: '', thickness: undefined },
  daySon: { kg: undefined, specifications: '', imageUrl: '' },
  vatTuPhuKien: { unit: 'cái' },
  baoBiDongGoi: { unit: 'thùng' },
})

export default function PlanFormDashboardPage() {
  const { data: planForms = [], isLoading, refetch } = useFetch(() => api.getPlanForms(), [])
  const { data: formOptions } = useFetch(() => api.getPlanFormOptions(), [])
  const exportOrders = formOptions?.exportOrders ?? []
  const mfgProducts  = formOptions?.mfgProducts  ?? []

  const [selectedPf, setSelectedPf] = useState<PlanForm | null>(null)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [form, setForm] = useState<CreatePlanFormPayload>({
    exportOrderId: 0, mfgProductId: 0, note: '', materialType: emptyMaterialType(),
  })

  const openModal = () => {
    const firstOrder   = exportOrders[0] as { id: number } | undefined
    const firstProduct = mfgProducts[0]  as { id: number } | undefined
    setForm({ exportOrderId: firstOrder?.id ?? 0, mfgProductId: firstProduct?.id ?? 0, note: '', materialType: emptyMaterialType() })
    setModalOpen(true)
  }

  const handleProposeNew = async () => {
    if (!form.exportOrderId || !form.mfgProductId || !form.materialType.sat.type) {
      alert('Vui lòng chọn PO, sản phẩm và nhập loại sắt')
      return
    }
    setSubmitting(true)
    try {
      await api.proposePlanForm(form)
      setModalOpen(false)
      refetch()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Không thể tạo đề xuất')
    } finally {
      setSubmitting(false)
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách SKU</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text2)' }}>
            Quản lý kế hoạch sản xuất sản phẩm — định mức vật tư (Sắt, Dây/Sơn, Phụ kiện, Bao bì)
          </p>
        </div>
        <button onClick={openModal} style={btnGreen}>Tạo SKU mới</button>
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
              <col style={{ width: 120 }} />
              <col style={{ width: 160 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Trạng thái</th>
                <th style={thStyle}>Thời gian tạo</th>
              </tr>
            </thead>
            <tbody>
              {(planForms as PlanForm[]).map((pf) => (
                <Fragment key={pf.id}>
                  <tr
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
                    <td style={tdStyle}>
                      <StatusBadge status={pf.status} />
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: 12 }}>
                      {format(new Date(pf.createdAt), 'HH:mm · dd/MM/yyyy')}
                    </td>
                  </tr>
                </Fragment>
              ))}
              {planForms.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    Chưa có sản phẩm — bấm &quot;Tạo định mức mới&quot; để bắt đầu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal tạo mới */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Tạo SKU mới</h3>

            <label style={labelStyle}>Tên khách hàng</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nhập tên khách hàng"
              style={inputStyle}
            />

            <label style={labelStyle}>SKU</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Nhập SKU"
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModalOpen(false)} style={btnSecondary}>Hủy</button>
              <button onClick={handleProposeNew} disabled={submitting} style={btnGreen}>
                {submitting ? 'Đang lưu...' : 'Lưu'}
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

  type CheckState = 'idle' | 'checking' | 'ok' | 'missing'
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [missingMats, setMissingMats] = useState<{ name: string; required: number; unit: string; available: number }[]>([])
  const [showBuyModal, setShowBuyModal] = useState(false)

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

      {/* Định mức vật tư */}
      {mt ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Định mức vật tư</div>
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
            {checkState === 'ok' && (
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
              disabled={!allApproved || checkState === 'checking'}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #2563eb', background: allApproved ? '#eff6ff' : '#f3f4f6', color: allApproved ? '#2563eb' : '#9ca3af', cursor: allApproved ? 'pointer' : 'not-allowed', opacity: checkState === 'checking' ? 0.6 : 1 }}
            >{checkState === 'checking' ? 'Đang kiểm...' : 'Kiểm vật tư'}</button>
            <button
              disabled={checkState !== 'ok'}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: checkState === 'ok' ? 'pointer' : 'not-allowed', background: checkState === 'ok' ? '#16a34a' : '#e5e7eb', color: checkState === 'ok' ? '#fff' : '#9ca3af' }}
            >Sản xuất</button>
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
          Chưa có thông tin định mức vật tư
        </div>
      )}

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

const thStyle: React.CSSProperties       = { padding: '12px 16px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const tdStyle: React.CSSProperties       = { padding: '12px 16px' }
const labelStyle: React.CSSProperties    = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, marginTop: 12 }
const inputStyle: React.CSSProperties    = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }
const btnGreen: React.CSSProperties      = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const btnSecondary: React.CSSProperties  = { padding: '10px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }
