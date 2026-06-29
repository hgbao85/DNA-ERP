import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, Loader2 } from 'lucide-react'
import * as api from '../../../services/api'
import type { PlanForm } from '../../../types/plan-form'

// ─── Status ───────────────────────────────────────────────────────────────────

export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED_DETAIL: { label: 'Duyệt ĐM chi tiết', color: '#1d4ed8', bg: '#dbeafe' },
  APPROVED_PARTS:  { label: 'Duyệt mảnh',        color: '#7c3aed', bg: '#ede9fe' },
  APPROVED:        { label: 'Đã duyệt',           color: '#16a34a', bg: '#dcfce7' },
  REJECTED:        { label: 'Từ chối',            color: '#dc2626', bg: '#fee2e2' },
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.APPROVED_DETAIL
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 20,
      color: s.color, background: s.bg, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

export function SKUDetail({
  pf,
  readOnly = false,
  onBack,
  onApproveDetail,
  onApproveParts,
  onStartProduction,
}: {
  pf: PlanForm
  readOnly?: boolean
  onBack: () => void
  onApproveDetail?: () => Promise<void>
  onApproveParts?: () => Promise<void>
  onStartProduction?: () => Promise<void>
}) {
  const mt = pf.quotaManagement?.materialType

  // Chi tiết đã được duyệt khi status vượt qua giai đoạn APPROVED_DETAIL
  const detailAlreadyApproved = ['APPROVED_PARTS', 'APPROVED'].includes(pf.status)
  const approvedEntry = (at?: string) => ({ status: 'APPROVED' as const, at: new Date(at ?? pf.createdAt) })

  type SecEntry = { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null
  type SecKey = 'sat' | 'daySon' | 'vatTuPhuKien' | 'baoBiDongGoi'

  const [secStatus, setSecStatus] = useState<Record<SecKey, SecEntry>>(() => {
    const e = detailAlreadyApproved ? approvedEntry(pf.proposedAt ?? undefined) : null
    return { sat: e, daySon: e, vatTuPhuKien: e, baoBiDongGoi: e }
  })
  const allSectionsApproved = (['sat', 'daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as SecKey[])
    .every(k => secStatus[k]?.status === 'APPROVED')

  const SEC_LABELS: Record<SecKey, string> = { sat: 'Sắt', daySon: 'Dây / Sơn', vatTuPhuKien: 'Vật tư phụ kiện', baoBiDongGoi: 'Bao bì đóng gói' }
  const rejectedSections = (['sat', 'daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as SecKey[])
    .filter(k => secStatus[k]?.status === 'REJECTED')
    .map(k => ({ key: k, title: SEC_LABELS[k], reason: secStatus[k]?.reason }))
  const anySectionRejected = rejectedSections.length > 0

  const approveSection = (k: SecKey) =>
    setSecStatus(p => ({ ...p, [k]: { status: 'APPROVED', at: new Date() } }))
  const approveAllSections = () =>
    (['sat', 'daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as SecKey[]).forEach(approveSection)

  type RejectModal = { key: SecKey; title: string } | null
  const [rejectModal, setRejectModal] = useState<RejectModal>(null)
  const [rejectReason, setRejectReason] = useState('')
  const confirmSectionReject = () => {
    if (!rejectModal) return
    setSecStatus(p => ({
      ...p,
      [rejectModal.key]: { status: 'REJECTED', at: new Date(), reason: rejectReason.trim() || undefined },
    }))
    setRejectModal(null)
  }

  type SecFilter = 'all' | SecKey
  const [filterSec, setFilterSec] = useState<SecFilter>('all')

  // Warehouse check
  type CheckState = 'idle' | 'checking' | 'ok' | 'missing'
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [missingMats, setMissingMats] = useState<{ name: string; required: number; unit: string; available: number }[]>([])
  const [showBuyModal, setShowBuyModal] = useState(false)

  const handleCheck = async () => {
    setCheckState('checking')
    try {
      const warehouseItems: any[] = await (api as any).getAllMfgWarehouseItems()
      const required: { name: string; required: number; unit: string }[] = []
      ;(Array.isArray(mt?.sat) ? mt!.sat : []).forEach((i: any) => {
        if (i.name) required.push({ name: i.name, required: i.quantity ?? 1, unit: i.unit ?? '' })
      })
      ;(Array.isArray(mt?.daySon) ? mt!.daySon : []).forEach((i: any) => {
        if (i.name) required.push({ name: i.name, required: i.kg ?? i.quantity ?? 1, unit: i.unit ?? 'kg' })
      })
      ;(Array.isArray(mt?.vatTuPhuKien) ? mt!.vatTuPhuKien : []).forEach((i: any) => {
        if (i.name) required.push({ name: i.name, required: i.quantity ?? 1, unit: i.unit ?? 'cái' })
      })
      ;(Array.isArray(mt?.baoBiDongGoi) ? mt!.baoBiDongGoi : []).forEach((i: any) => {
        if (i.name) required.push({ name: i.name, required: i.quantity ?? 1, unit: i.unit ?? 'thùng' })
      })
      const missing = required.flatMap(req => {
        const avail = warehouseItems.find((w: any) =>
          w.name?.toLowerCase().trim() === req.name.toLowerCase().trim()
        )?.quantity ?? 0
        return avail < req.required ? [{ ...req, available: avail }] : []
      })
      setMissingMats(missing)
      setCheckState(missing.length === 0 ? 'ok' : 'missing')
    } catch {
      setCheckState('idle')
    }
  }

  const [approvingDetail, setApprovingDetail] = useState(false)
  const [showSendConfirm, setShowSendConfirm] = useState(false)
  const [sendDone, setSendDone] = useState(false)
  const handleApproveDetail = async () => {
    if (!onApproveDetail) return
    setApprovingDetail(true)
    try { await onApproveDetail() } finally { setApprovingDetail(false) }
  }

  type DetailTab = 'chitiet' | 'manh'
  // Manh tab chỉ hiển thị khi chi tiết đã qua duyệt
  const showManhTab = detailAlreadyApproved
  const defaultTab: DetailTab = detailAlreadyApproved ? 'manh' : 'chitiet'
  const [detailTab, setDetailTab] = useState<DetailTab>(defaultTab)

  const canEditDetail = !readOnly && pf.status === 'APPROVED_DETAIL'

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
        <div style={{ marginLeft: 'auto' }}>
          <StatusBadge status={pf.status} />
        </div>
      </div>

      {/* Info strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 28px', padding: '10px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
        <span><span style={{ color: 'var(--text3)' }}>Mã nhà máy: </span><strong>{pf.mfgProduct?.factoryCode ?? '—'}</strong></span>
        <span><span style={{ color: 'var(--text3)' }}>Sản phẩm: </span><strong>{pf.mfgProduct?.name ?? '—'}</strong></span>
        {pf.proposedAt && <span><span style={{ color: 'var(--text3)' }}>Đề xuất: </span><strong>{format(new Date(pf.proposedAt), 'dd/MM/yyyy')}</strong></span>}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([
          ['chitiet', 'Định mức chi tiết'],
          ...(showManhTab ? [['manh', 'Định mức mảnh']] : []),
        ] as [DetailTab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setDetailTab(id)}
            style={{
              padding: '8px 20px', fontSize: 13,
              fontWeight: detailTab === id ? 700 : 500,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: detailTab === id ? '#2e7d32' : 'var(--text2)',
              borderBottom: detailTab === id ? '2px solid #2e7d32' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Định mức mảnh */}
      {detailTab === 'manh' && (
        <DinhMucManh
          pfId={pf.id}
          status={pf.status}
          readOnly={readOnly}
          onApproveParts={onApproveParts}
          onStartProduction={onStartProduction}
        />
      )}

      {/* Tab: Định mức chi tiết */}
      {detailTab === 'chitiet' && (mt ? (
        <div style={{ marginBottom: 24 }}>
          {/* Section filter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Danh sách định mức chi tiết</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {([
                ['all', 'Tất cả'], ['sat', 'Sắt'], ['daySon', 'Dây / Sơn'],
                ['vatTuPhuKien', 'Phụ kiện'], ['baoBiDongGoi', 'Bao bì'],
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

          {/* Material sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(filterSec === 'all' || filterSec === 'sat') && (
              <MaterialSection
                title="Sắt" color="#b45309" bg="#fef3c7" readOnly={!canEditDetail}
                entry={secStatus.sat}
                onApprove={() => approveSection('sat')}
                onReject={() => { setRejectModal({ key: 'sat', title: 'Sắt' }); setRejectReason('') }}
                items={(Array.isArray(mt.sat) ? mt.sat : []).map(i => ({
                  name: i.name,
                  spec: [i.specifications, i.thickness != null ? `dày ${i.thickness}mm` : null].filter(Boolean).join(', ') || null,
                  unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
                }))}
              />
            )}
            {(filterSec === 'all' || filterSec === 'daySon') && (
              <MaterialSection
                title="Dây / Sơn" color="#1d4ed8" bg="#eff6ff" readOnly={!canEditDetail}
                entry={secStatus.daySon}
                onApprove={() => approveSection('daySon')}
                onReject={() => { setRejectModal({ key: 'daySon', title: 'Dây / Sơn' }); setRejectReason('') }}
                items={(Array.isArray(mt.daySon) ? mt.daySon : []).map(i => ({
                  name: i.name,
                  spec: i.specifications || null,
                  unitQty: i.kg != null ? `${i.kg} kg` : (i.unit ?? null),
                }))}
              />
            )}
            {(filterSec === 'all' || filterSec === 'vatTuPhuKien') && (
              <MaterialSection
                title="Vật tư phụ kiện" color="#6d28d9" bg="#ede9fe" readOnly={!canEditDetail}
                entry={secStatus.vatTuPhuKien}
                onApprove={() => approveSection('vatTuPhuKien')}
                onReject={() => { setRejectModal({ key: 'vatTuPhuKien', title: 'Vật tư phụ kiện' }); setRejectReason('') }}
                items={(Array.isArray(mt.vatTuPhuKien) ? mt.vatTuPhuKien : []).map(i => ({
                  name: i.name, spec: i.specifications || null,
                  unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
                }))}
              />
            )}
            {(filterSec === 'all' || filterSec === 'baoBiDongGoi') && (
              <MaterialSection
                title="Bao bì đóng gói" color="#065f46" bg="#d1fae5" readOnly={!canEditDetail}
                entry={secStatus.baoBiDongGoi}
                onApprove={() => approveSection('baoBiDongGoi')}
                onReject={() => { setRejectModal({ key: 'baoBiDongGoi', title: 'Bao bì đóng gói' }); setRejectReason('') }}
                items={(Array.isArray(mt.baoBiDongGoi) ? mt.baoBiDongGoi : []).map(i => ({
                  name: i.name, spec: i.specifications || null,
                  unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
                }))}
              />
            )}
          </div>

          {/* Actions */}
          {canEditDetail && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              {!allSectionsApproved && !anySectionRejected && (
                <span style={{ fontSize: 12, color: '#d97706' }}>Cần duyệt đủ 4 loại vật tư chi tiết mới được chuyển đến công đoạn tiếp theo</span>
              )}
              {!allSectionsApproved && filterSec === 'all' && !anySectionRejected && (
                <button
                  onClick={approveAllSections}
                  style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer' }}
                >Duyệt tất cả</button>
              )}
              {anySectionRejected && !sendDone && (
                <button
                  onClick={() => setShowSendConfirm(true)}
                  style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #7c3aed', background: '#faf5ff', color: '#7c3aed', cursor: 'pointer' }}
                >Gửi lại bộ phận Định mức chi tiết</button>
              )}
              {sendDone && (
                <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>✓ Đã gửi lại bộ phận Định mức chi tiết</span>
              )}
              {allSectionsApproved && (
                <button
                  onClick={handleCheck}
                  disabled={checkState === 'checking'}
                  style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', opacity: checkState === 'checking' ? 0.6 : 1 }}
                >
                  {checkState === 'checking' ? <><Loader2 size={13} style={{ display: 'inline', marginRight: 4 }} />Đang kiểm...</> : 'Kiểm vật tư'}
                </button>
              )}
              <button
                onClick={handleApproveDetail}
                disabled={!allSectionsApproved || checkState !== 'ok' || approvingDetail}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                  cursor: allSectionsApproved && checkState === 'ok' && !approvingDetail ? 'pointer' : 'not-allowed',
                  background: allSectionsApproved && checkState === 'ok' ? '#2e7d32' : '#e5e7eb',
                  color: allSectionsApproved && checkState === 'ok' ? '#fff' : '#9ca3af',
                  opacity: approvingDetail ? 0.7 : 1,
                }}
              >
                {approvingDetail ? 'Đang gửi...' : 'Gửi bộ phận nhập mảnh'}
              </button>
            </div>
          )}
          {detailAlreadyApproved && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Đã gửi đến bộ phận nhập mảnh</span>
            </div>
          )}

          {/* Thiếu vật tư */}
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
          {checkState === 'ok' && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#16a34a', fontWeight: 600, textAlign: 'right' }}>✓ Đủ vật tư trong kho</div>
          )}
        </div>
      ) : (
        <div style={{ padding: 20, background: 'var(--surface2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, marginBottom: 24 }}>
          Chưa có thông tin định mức chi tiết
        </div>
      ))}

      {/* Modal mua hàng */}
      {showBuyModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowBuyModal(false) }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 560, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Xác nhận tạo đề xuất mua hàng</h3>
            {/* SKU info */}
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>SKU cần mua vật tư</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', fontSize: 13 }}>
                <span><span style={{ color: '#92400e' }}>Mã nhà máy: </span><strong>{pf.mfgProduct?.factoryCode ?? '—'}</strong></span>
                <span><span style={{ color: '#92400e' }}>Sản phẩm: </span><strong>{pf.mfgProduct?.name ?? '—'}</strong></span>
                {pf.customerName && <span><span style={{ color: '#92400e' }}>Khách hàng: </span><strong>{pf.customerName}</strong></span>}
                {pf.exportOrder?.poNumber && <span><span style={{ color: '#92400e' }}>Mã PO: </span><strong>{pf.exportOrder.poNumber}</strong></span>}
              </div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)', fontSize: 12 }}>Tên vật tư</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: 12 }}>Cần</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: 12 }}>Tồn kho</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: 12 }}>Cần mua thêm</th>
                  </tr>
                </thead>
                <tbody>
                  {missingMats.map((m, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 500 }}>{m.name}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text2)' }}>{m.required} {m.unit}</td>
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
              >Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận gửi lại bộ phận Định mức chi tiết */}
      {showSendConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Gửi lại bộ phận Định mức chi tiết</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text2)' }}>
              Xác nhận gửi lại định mức chi tiết cho bộ phận định mức để chỉnh sửa và hoàn thiện lại?
            </p>
            {rejectedSections.length > 0 && (
              <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rejectedSections.map(sec => (
                  <div key={sec.key} style={{ padding: '8px 12px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>{sec.title}</div>
                    {sec.reason && (
                      <div style={{ fontSize: 11, color: '#dc2626', fontStyle: 'italic', marginTop: 2 }}>{sec.reason}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {rejectedSections.length === 0 && <div style={{ marginBottom: 20 }} />}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSendConfirm(false)} style={btnSecondary}>Hủy</button>
              <button
                onClick={() => { setShowSendConfirm(false); setSendDone(true) }}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff' }}
              >Xác nhận gửi lại</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal từ chối section */}
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
              <button onClick={confirmSectionReject} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff' }}>Xác nhận từ chối</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MaterialSection ──────────────────────────────────────────────────────────

type MaterialRow = { name: string; spec: string | null; unitQty: string | null }

function MaterialSection({
  title, color, bg, items, entry, readOnly = false, onApprove, onReject,
}: {
  title: string; color: string; bg: string
  items: MaterialRow[]
  entry: { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null
  readOnly?: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const status = entry?.status ?? null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: bg, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color, fontWeight: 700, fontSize: 12 }}>
            {title} <span style={{ fontWeight: 400, opacity: 0.7 }}>({items.length} loại)</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {status && <StatusBadge status={status} />}
            {!readOnly && (
              <>
                <button
                  onClick={onApprove}
                  style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: status === 'APPROVED' ? '#16a34a' : 'rgba(22,163,74,0.12)', color: status === 'APPROVED' ? '#fff' : '#16a34a' }}
                >Duyệt</button>
                <button
                  onClick={onReject}
                  style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: status === 'REJECTED' ? '#dc2626' : 'rgba(220,38,38,0.10)', color: status === 'REJECTED' ? '#fff' : '#dc2626' }}
                >Từ chối</button>
              </>
            )}
          </div>
        </div>
        {status === 'REJECTED' && entry?.reason && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626', fontStyle: 'italic' }}>{entry.reason}</div>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text3)' }}>—</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup><col style={{ width: '35%' }} /><col /><col style={{ width: 96 }} /></colgroup>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={thStyle}>Tên vật tư</th>
              <th style={thStyle}>Quy cách</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>ĐVT / SL</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...tdStyle, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</td>
                <td style={{ ...tdStyle, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.spec ?? '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.unitQty ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── DinhMucManh ──────────────────────────────────────────────────────────────

const MOCK_MANH_BY_PF: Record<number, ManhRow[]> = {
  1: [
    { id: 1, code: 'M-001', name: 'Khung chân trước',  material: 'Ống thép 25×25', thickness: 1.2, length: 450, qty: 2, unit: 'thanh', note: 'Cắt góc 45° hai đầu' },
    { id: 2, code: 'M-002', name: 'Khung chân sau',    material: 'Ống thép 25×25', thickness: 1.2, length: 480, qty: 2, unit: 'thanh', note: '' },
    { id: 3, code: 'M-003', name: 'Thanh ngang trên',  material: 'Ống thép 20×20', thickness: 1.0, length: 520, qty: 2, unit: 'thanh', note: '' },
    { id: 4, code: 'M-004', name: 'Thanh ngang dưới',  material: 'Ống thép 20×20', thickness: 1.0, length: 520, qty: 2, unit: 'thanh', note: '' },
    { id: 5, code: 'M-005', name: 'Thanh tựa lưng',    material: 'Ống thép D18',   thickness: 1.2, length: 380, qty: 3, unit: 'thanh', note: 'Uốn cong R200mm' },
    { id: 6, code: 'M-006', name: 'Tấm đỡ ghế',        material: 'Tấm sắt',        thickness: 1.5, length: null, qty: 1, unit: 'tấm',  note: 'Dập lỗ theo bản vẽ' },
  ],
}
const MOCK_MANH_DEFAULT: ManhRow[] = [
  { id: 1, code: 'M-001', name: 'Thanh đứng chính',   material: 'Ống thép 30×30', thickness: 1.5, length: 600, qty: 4, unit: 'thanh', note: '' },
  { id: 2, code: 'M-002', name: 'Thanh ngang khung',  material: 'Ống thép 25×25', thickness: 1.2, length: 480, qty: 4, unit: 'thanh', note: 'Cắt vuông góc' },
  { id: 3, code: 'M-003', name: 'Tấm đáy',            material: 'Tấm sắt CT3',   thickness: 2.0, length: null, qty: 1, unit: 'tấm',  note: '480×380mm' },
  { id: 4, code: 'M-004', name: 'Thanh giằng chéo',   material: 'Ống thép D16',   thickness: 1.2, length: 520, qty: 2, unit: 'thanh', note: 'Uốn đầu, khoan lỗ D8' },
  { id: 5, code: 'M-005', name: 'Tai móc treo',        material: 'Thép tấm 3mm',  thickness: 3.0, length: null, qty: 4, unit: 'cái',  note: 'Dập nguội, mạ kẽm' },
]

interface ManhRow {
  id: number; code: string; name: string; material: string
  thickness: number; length: number | null; qty: number; unit: string; note: string
}

type ManhApprovalEntry = { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null

function DinhMucManh({
  pfId, status, readOnly = false, onApproveParts, onStartProduction,
}: {
  pfId: number
  status: string
  readOnly?: boolean
  onApproveParts?: () => Promise<void>
  onStartProduction?: () => Promise<void>
}) {
  const rows = MOCK_MANH_BY_PF[pfId] ?? MOCK_MANH_DEFAULT
  const partsAlreadyApproved = status === 'APPROVED'

  const [approval, setApproval] = useState<ManhApprovalEntry>(() =>
    partsAlreadyApproved ? { status: 'APPROVED', at: new Date() } : null
  )
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [confirmApproveParts, setConfirmApproveParts] = useState(false)
  const [confirmStartProduction, setConfirmStartProduction] = useState(false)
  const [showSendBackModal, setShowSendBackModal] = useState(false)
  const [sendBackDone, setSendBackDone] = useState(false)

  const isLocallyApproved = approval?.status === 'APPROVED'
  const isLocallyRejected = approval?.status === 'REJECTED'

  const confirmReject = () => {
    setApproval({ status: 'REJECTED', at: new Date(), reason: rejectReason.trim() || undefined })
    setShowRejectModal(false)
  }

  const handleApproveParts = async () => {
    if (!onApproveParts) return
    setProcessing(true)
    try { await onApproveParts() } finally { setProcessing(false) }
  }

  const handleStartProduction = async () => {
    if (!onStartProduction) return
    setProcessing(true)
    try { await onStartProduction() } finally { setProcessing(false) }
  }

  const showApproveRejectBtns = !readOnly && ['APPROVED_DETAIL', 'APPROVED_PARTS'].includes(status)

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        {/* Section header */}
        <div style={{
          background: isLocallyApproved ? '#f0fdf4' : isLocallyRejected ? '#fff5f5' : 'var(--surface2)',
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              Danh sách mảnh phôi
            </span>
            <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
              ({rows.length} mảnh · {rows.reduce((s, r) => s + r.qty, 0)} chi tiết)
            </span>
            {isLocallyRejected && approval?.reason && (
              <div style={{ fontSize: 11, color: '#dc2626', fontStyle: 'italic', marginTop: 2 }}>{approval.reason}</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {approval && <StatusBadge status={approval.status} />}
            {showApproveRejectBtns && (
              <>
                <button
                  onClick={() => setApproval({ status: 'APPROVED', at: new Date() })}
                  style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: isLocallyApproved ? '#16a34a' : 'rgba(22,163,74,0.12)', color: isLocallyApproved ? '#fff' : '#16a34a' }}
                >Duyệt</button>
                <button
                  onClick={() => { setShowRejectModal(true); setRejectReason('') }}
                  style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: isLocallyRejected ? '#dc2626' : 'rgba(220,38,38,0.10)', color: isLocallyRejected ? '#fff' : '#dc2626' }}
                >Từ chối</button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 80 }} /><col /><col style={{ width: 140 }} />
            <col style={{ width: 72 }} /><col style={{ width: 72 }} />
            <col style={{ width: 60 }} /><col style={{ width: 56 }} /><col />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={thStyle}>Mã mảnh</th><th style={thStyle}>Tên mảnh</th>
              <th style={thStyle}>Vật liệu</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Dày</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Dài</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>SL</th>
              <th style={thStyle}>ĐVT</th><th style={thStyle}>Ghi chú</th>
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

      {/* Action bar — always show both buttons for APPROVED_DETAIL and APPROVED_PARTS */}
      {!readOnly && ['APPROVED_DETAIL', 'APPROVED_PARTS'].includes(status) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          {!isLocallyApproved && !isLocallyRejected && (
            <span style={{ fontSize: 12, color: '#d97706' }}>Cần duyệt danh sách mảnh mới chuyển đến công đoạn tiếp theo</span>
          )}
          {isLocallyRejected && !sendBackDone && (
            <button
              onClick={() => setShowSendBackModal(true)}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #7c3aed', background: '#faf5ff', color: '#7c3aed', cursor: 'pointer' }}
            >Gửi lại bộ phận định mức mảnh</button>
          )}
          {sendBackDone && (
            <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>✓ Đã gửi lại bộ phận định mức mảnh</span>
          )}
          <button
            onClick={() => setConfirmStartProduction(true)}
            disabled={!isLocallyApproved || status !== 'APPROVED_PARTS' || processing}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              cursor: isLocallyApproved && status === 'APPROVED_PARTS' && !processing ? 'pointer' : 'default',
              background: isLocallyApproved && status === 'APPROVED_PARTS' && !processing ? '#16a34a' : '#e5e7eb',
              color: isLocallyApproved && status === 'APPROVED_PARTS' ? '#fff' : '#9ca3af',
              opacity: processing ? 0.7 : 1,
            }}
          >{processing ? 'Đang xử lý...' : 'Bắt đầu sản xuất'}</button>
        </div>
      )}
      {partsAlreadyApproved && status === 'APPROVED' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Đã bắt đầu sản xuất</span>
        </div>
      )}

      {/* Modal từ chối mảnh */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Từ chối — Danh sách mảnh phôi</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text3)' }}>Nhập lý do từ chối (không bắt buộc)</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Vd: Sai kích thước, thiếu mảnh..."
              rows={3} autoFocus
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowRejectModal(false)} style={btnSecondary}>Hủy</button>
              <button onClick={confirmReject} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff' }}>Xác nhận từ chối</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận gửi lại bộ phận định mức mảnh */}
      {showSendBackModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Gửi lại bộ phận định mức mảnh</h3>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text2)' }}>
              Xác nhận gửi lại danh sách mảnh phôi cho bộ phận định mức mảnh để chỉnh sửa và hoàn thiện lại?
            </p>
            {approval?.reason && (
              <div style={{ margin: '0 0 20px', padding: '8px 12px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#dc2626', fontStyle: 'italic' }}>
                Lý do từ chối: {approval.reason}
              </div>
            )}
            {!approval?.reason && <div style={{ marginBottom: 20 }} />}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSendBackModal(false)} style={btnSecondary}>Hủy</button>
              <button
                onClick={() => { setShowSendBackModal(false); setSendBackDone(true) }}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff' }}
              >Xác nhận gửi lại</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận duyệt mảnh */}
      {confirmApproveParts && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận duyệt mảnh</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              Xác nhận duyệt định mức mảnh phôi? Sau khi duyệt, đơn hàng sẽ sẵn sàng để bắt đầu sản xuất.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmApproveParts(false)} style={btnSecondary}>Hủy</button>
              <button
                onClick={async () => { setConfirmApproveParts(false); await handleApproveParts() }}
                disabled={processing}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff' }}
              >Xác nhận duyệt mảnh</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận bắt đầu sản xuất */}
      {confirmStartProduction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận bắt đầu sản xuất</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              Xác nhận bắt đầu sản xuất? SKU này sẽ chuyển sang trạng thái "Đã duyệt".
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmStartProduction(false)} style={btnSecondary}>Hủy</button>
              <button
                onClick={async () => { setConfirmStartProduction(false); await handleStartProduction() }}
                disabled={processing}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff' }}
              >Bắt đầu sản xuất</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties      = { padding: '7px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text3)' }
const tdStyle: React.CSSProperties      = { padding: '8px 12px' }
const btnSecondary: React.CSSProperties = { padding: '9px 20px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }
