import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import GenericStatusBadge from '../../../components/StatusBadge'
import Modal from '../../../components/Modal'
import RefreshButton from '../../../components/RefreshButton'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import type { ManhRow, PlanForm } from '../../../types/plan-form'
import { STATUS_MAP } from '../../../constants/planFormStatus'

// ─── Status ───────────────────────────────────────────────────────────────────

export { STATUS_MAP }

export function StatusBadge({ status }: { status: string }) {
  return <GenericStatusBadge {...(STATUS_MAP[status] ?? STATUS_MAP.APPROVED_DETAIL)} />
}

export function SKUDetail({
  pf,
  readOnly = false,
  onBack,
  onApproveDetail,
  onApproveParts,
  onSendForManagerApproval,
  onApproveManagerRequest,
  onRefresh,
  refreshing = false,
}: {
  pf: PlanForm
  readOnly?: boolean
  onBack: () => void
  onApproveDetail?: () => Promise<void>
  onApproveParts?: () => Promise<void>
  onSendForManagerApproval?: () => Promise<void>
  onApproveManagerRequest?: () => Promise<void>
  onRefresh?: () => void
  refreshing?: boolean
}) {
  const { isManager } = useAuth()
  const mt = pf.quotaManagement?.materialType

  // Chi tiết đã được duyệt khi status vượt qua giai đoạn APPROVED_DETAIL (đã gửi bộ phận nhập mảnh)
  const detailAlreadyApproved = ['WAITING_PARTS', 'APPROVED_PARTS', 'APPROVED'].includes(pf.status)
  const approvedEntry = (at?: string) => ({ status: 'APPROVED' as const, at: new Date(at ?? pf.createdAt) })

  type SecEntry = { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null
  type SecKey = 'sat' | 'daySon' | 'vatTuPhuKien' | 'baoBiDongGoi'

  const [secStatus, setSecStatus] = useState<Record<SecKey, SecEntry>>(() => {
    const fallback = detailAlreadyApproved ? approvedEntry(pf.proposedAt ?? undefined) : null
    const review = pf.quotaManagement?.reviewStatus
    const fromReview = (k: SecKey): SecEntry => {
      const r = review?.[k]
      return r ? { status: r.status, at: new Date(r.reviewedAt), reason: r.reason } : fallback
    }
    return { sat: fromReview('sat'), daySon: fromReview('daySon'), vatTuPhuKien: fromReview('vatTuPhuKien'), baoBiDongGoi: fromReview('baoBiDongGoi') }
  })
  const allSectionsApproved = (['sat', 'daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as SecKey[])
    .every(k => secStatus[k]?.status === 'APPROVED')

  const SEC_LABELS: Record<SecKey, string> = { sat: 'Sắt', daySon: 'Dây / Sơn', vatTuPhuKien: 'Vật tư phụ kiện', baoBiDongGoi: 'Bao bì đóng gói' }
  const rejectedSections = (['sat', 'daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as SecKey[])
    .filter(k => secStatus[k]?.status === 'REJECTED')
    .map(k => ({ key: k, title: SEC_LABELS[k], reason: secStatus[k]?.reason }))
  const anySectionRejected = rejectedSections.length > 0

  const approveSection = (k: SecKey) => {
    setSecStatus(p => ({ ...p, [k]: { status: 'APPROVED', at: new Date() } }))
    ;(api as any).reviewPlanFormDetailQuota(pf.id, k, 'APPROVED').catch(() => {})
  }

  type RejectModal = { key: SecKey; title: string } | null
  const [rejectModal, setRejectModal] = useState<RejectModal>(null)
  const [rejectReason, setRejectReason] = useState('')
  const confirmSectionReject = () => {
    if (!rejectModal) return
    const reason = rejectReason.trim() || undefined
    setSecStatus(p => ({
      ...p,
      [rejectModal.key]: { status: 'REJECTED', at: new Date(), reason },
    }))
    ;(api as any).reviewPlanFormDetailQuota(pf.id, rejectModal.key, 'REJECTED', reason).catch(() => {})
    setRejectModal(null)
  }

  type SecFilter = 'all' | SecKey
  const [filterSec, setFilterSec] = useState<SecFilter>('all')

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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {onRefresh && <RefreshButton onRefresh={onRefresh} loading={refreshing} size="sm" />}
          <StatusBadge status={pf.status} />
        </div>
      </div>

      {/* Info strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 28px', padding: '10px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
        <span><span style={{ color: 'var(--text3)' }}>Mã nhà máy: </span><strong>{pf.mfgProduct?.factoryCode ?? '—'}</strong></span>
        <span><span style={{ color: 'var(--text3)' }}>Sản phẩm: </span><strong>{pf.mfgProduct?.name ?? '—'}</strong></span>
        {pf.proposedAt && <span><span style={{ color: 'var(--text3)' }}>Đề xuất: </span><strong>{format(new Date(pf.proposedAt), 'dd/MM/yyyy')}</strong></span>}
      </div>

      {isManager ? (
        <ManagerReviewView pf={pf} readOnly={readOnly} onApproveManagerRequest={onApproveManagerRequest} />
      ) : (
      <>
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
          status={pf.status}
          readOnly={readOnly}
          manhItems={pf.manhItems}
          onApproveParts={onApproveParts}
          onSendForManagerApproval={onSendForManagerApproval}
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
              {anySectionRejected && !sendDone && (
                <button
                  onClick={() => setShowSendConfirm(true)}
                  style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #7c3aed', background: '#faf5ff', color: '#7c3aed', cursor: 'pointer' }}
                >Gửi lại bộ phận Định mức chi tiết</button>
              )}
              {sendDone && (
                <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>✓ Đã gửi lại bộ phận Định mức chi tiết</span>
              )}
              <button
                onClick={handleApproveDetail}
                disabled={!allSectionsApproved || approvingDetail}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                  cursor: allSectionsApproved && !approvingDetail ? 'pointer' : 'not-allowed',
                  background: allSectionsApproved ? '#2e7d32' : '#e5e7eb',
                  color: allSectionsApproved ? '#fff' : '#9ca3af',
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
        </div>
      ) : (
        <div style={{ padding: 20, background: 'var(--surface2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, marginBottom: 24 }}>
          Chưa có thông tin định mức chi tiết
        </div>
      ))}

      {/* Modal xác nhận gửi lại bộ phận Định mức chi tiết */}
      <Modal open={showSendConfirm} maxWidth={440} zIndex={2000}>
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
      </Modal>

      {/* Modal từ chối section */}
      <Modal open={!!rejectModal} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Từ chối — {rejectModal?.title}</h3>
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
      </Modal>
      </>
      )}
    </div>
  )
}

// ─── ManagerReviewView ────────────────────────────────────────────────────────
// Sếp duyệt lần cuối: xem gộp cả định mức chi tiết + định mức mảnh trong 1 màn hình
// (không tách tab như luồng KHSX), rồi duyệt 1 lần để chính thức bắt đầu sản xuất.

function ManagerReviewView({
  pf, readOnly = false, onApproveManagerRequest,
}: {
  pf: PlanForm
  readOnly?: boolean
  onApproveManagerRequest?: () => Promise<void>
}) {
  const mt = pf.quotaManagement?.materialType
  const [processing, setProcessing] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const noop = () => {}

  const reviewEntry = (k: 'sat' | 'daySon' | 'vatTuPhuKien' | 'baoBiDongGoi') => {
    const r = pf.quotaManagement?.reviewStatus?.[k]
    return r
      ? { status: r.status, at: new Date(r.reviewedAt), reason: r.reason }
      : { status: 'APPROVED' as const, at: new Date(pf.proposedAt ?? pf.createdAt) }
  }

  const handleApprove = async () => {
    if (!onApproveManagerRequest) return
    setProcessing(true)
    try { await onApproveManagerRequest() } finally { setProcessing(false) }
  }

  return (
    <div>
      {/* Định mức chi tiết */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Định mức chi tiết</div>
        {mt ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MaterialSection
              title="Sắt" color="#b45309" bg="#fef3c7" readOnly
              entry={reviewEntry('sat')} onApprove={noop} onReject={noop}
              items={(Array.isArray(mt.sat) ? mt.sat : []).map(i => ({
                name: i.name,
                spec: [i.specifications, i.thickness != null ? `dày ${i.thickness}mm` : null].filter(Boolean).join(', ') || null,
                unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
              }))}
            />
            <MaterialSection
              title="Dây / Sơn" color="#1d4ed8" bg="#eff6ff" readOnly
              entry={reviewEntry('daySon')} onApprove={noop} onReject={noop}
              items={(Array.isArray(mt.daySon) ? mt.daySon : []).map(i => ({
                name: i.name,
                spec: i.specifications || null,
                unitQty: i.kg != null ? `${i.kg} kg` : (i.unit ?? null),
              }))}
            />
            <MaterialSection
              title="Vật tư phụ kiện" color="#6d28d9" bg="#ede9fe" readOnly
              entry={reviewEntry('vatTuPhuKien')} onApprove={noop} onReject={noop}
              items={(Array.isArray(mt.vatTuPhuKien) ? mt.vatTuPhuKien : []).map(i => ({
                name: i.name, spec: i.specifications || null,
                unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
              }))}
            />
            <MaterialSection
              title="Bao bì đóng gói" color="#065f46" bg="#d1fae5" readOnly
              entry={reviewEntry('baoBiDongGoi')} onApprove={noop} onReject={noop}
              items={(Array.isArray(mt.baoBiDongGoi) ? mt.baoBiDongGoi : []).map(i => ({
                name: i.name, spec: i.specifications || null,
                unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
              }))}
            />
          </div>
        ) : (
          <div style={{ padding: 20, background: 'var(--surface2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13 }}>
            Chưa có thông tin định mức chi tiết
          </div>
        )}
      </div>

      {/* Định mức mảnh */}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Định mức mảnh</div>
      <DinhMucManh status={pf.status} readOnly manhItems={pf.manhItems} />

      {/* Action bar — duyệt gộp cả 2 phần để chính thức bắt đầu sản xuất */}
      {!readOnly && pf.status === 'WAITING_MANAGER_APPROVAL' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            onClick={() => setConfirmApprove(true)}
            disabled={processing}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              cursor: processing ? 'default' : 'pointer',
              background: '#16a34a', color: '#fff', opacity: processing ? 0.7 : 1,
            }}
          >{processing ? 'Đang xử lý...' : 'Duyệt'}</button>
        </div>
      )}
      {pf.status === 'APPROVED' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Đã duyệt</span>
        </div>
      )}

      {/* Modal xác nhận duyệt */}
      <Modal open={confirmApprove} maxWidth={420} zIndex={2000}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận duyệt</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
          Xác nhận duyệt định mức chi tiết và định mức mảnh của SKU này? Sau khi duyệt, SKU sẽ được thêm vào danh sách.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setConfirmApprove(false)} style={btnSecondary}>Hủy</button>
          <button
            onClick={async () => { setConfirmApprove(false); await handleApprove() }}
            disabled={processing}
            style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff' }}
          >Duyệt</button>
        </div>
      </Modal>
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

type ManhApprovalEntry = { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null

function DinhMucManh({
  status, readOnly = false, manhItems, onApproveParts, onSendForManagerApproval,
}: {
  status: string
  readOnly?: boolean
  manhItems?: ManhRow[]
  onApproveParts?: () => Promise<void>
  onSendForManagerApproval?: () => Promise<void>
}) {
  const { isManager } = useAuth()
  // Dữ liệu mảnh thật do account Sắt nhập (qua updatePlanFormManhQuota); trống cho tới khi có người nhập.
  const rows = manhItems ?? []
  // Mảnh coi như đã duyệt xong khi SKU đã qua giai đoạn APPROVED_PARTS (đang chờ sếp duyệt hoặc đã duyệt xong).
  const partsAlreadyApproved = status === 'WAITING_MANAGER_APPROVAL' || status === 'APPROVED'

  const [approval, setApproval] = useState<ManhApprovalEntry>(() =>
    partsAlreadyApproved ? { status: 'APPROVED', at: new Date() } : null
  )
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [confirmApproveParts, setConfirmApproveParts] = useState(false)
  const [confirmSendForManagerApproval, setConfirmSendForManagerApproval] = useState(false)
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

  const handleSendForManagerApproval = async () => {
    if (!onSendForManagerApproval) return
    setProcessing(true)
    try { await onSendForManagerApproval() } finally { setProcessing(false) }
  }

  // Chỉ duyệt được khi đã có dữ liệu mảnh thật (status APPROVED_PARTS = account Sắt đã nhập xong)
  const showApproveRejectBtns = !readOnly && status === 'APPROVED_PARTS'

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Section header */}
      <div style={{
        background: isLocallyApproved ? '#f0fdf4' : isLocallyRejected ? '#fff5f5' : 'var(--surface2)',
        border: '1px solid var(--border)', borderRadius: 12,
        padding: '10px 14px', marginBottom: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            Danh sách mảnh phôi
          </span>
          <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
            ({rows.length} mảnh · {rows.reduce((s, r) => s + r.children.length, 0)} loại sắt)
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
                onClick={() => setConfirmApproveParts(true)}
                disabled={isLocallyApproved || processing}
                style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: isLocallyApproved ? 'default' : 'pointer', background: isLocallyApproved ? '#16a34a' : 'rgba(22,163,74,0.12)', color: isLocallyApproved ? '#fff' : '#16a34a' }}
              >Duyệt</button>
              <button
                onClick={() => { setShowRejectModal(true); setRejectReason('') }}
                style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: isLocallyRejected ? '#dc2626' : 'rgba(220,38,38,0.10)', color: isLocallyRejected ? '#fff' : '#dc2626' }}
              >Từ chối</button>
            </>
          )}
        </div>
      </div>

      {/* Danh sách mảnh — mỗi mảnh một card, bố cục giống bên nhập chi tiết định mức mảnh */}
      {rows.length === 0 ? (
        <div style={{ padding: 20, background: 'var(--surface2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
          Chưa có dữ liệu mảnh — đang chờ account Sắt nhập định mức mảnh cho SKU này.
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {rows.map(r => (
          <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
              background: 'var(--surface2)', borderBottom: r.children.length > 0 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{r.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{r.children.length} loại sắt</span>
            </div>

            {/* Children table */}
            {r.children.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ width: 36, padding: '7px', textAlign: 'center', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>#</th>
                    <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Loại sắt</th>
                    <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Quy cách</th>
                    <th style={{ width: 100, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Chiều dài</th>
                    <th style={{ width: 100, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Số lượng</th>
                  </tr>
                </thead>
                <tbody>
                  {r.children.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '9px 7px' }}>{i + 1}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text3)', fontSize: 12 }}>{c.specs || '—'}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text3)' }}>{c.length || '—'}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)' }}>{c.qty || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
      )}

      {/* Action bar — KHSX: chỉ hiện khi đã có dữ liệu mảnh thật chờ duyệt (APPROVED_PARTS) */}
      {!readOnly && !isManager && status === 'APPROVED_PARTS' && (
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
            onClick={() => setConfirmSendForManagerApproval(true)}
            disabled={!isLocallyApproved || processing}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              cursor: isLocallyApproved && !processing ? 'pointer' : 'default',
              background: isLocallyApproved && !processing ? '#16a34a' : '#e5e7eb',
              color: isLocallyApproved ? '#fff' : '#9ca3af',
              opacity: processing ? 0.7 : 1,
            }}
          >{processing ? 'Đang xử lý...' : 'Gửi sếp duyệt'}</button>
        </div>
      )}
      {/* KHSX: đã gửi, đang chờ sếp duyệt */}
      {!isManager && status === 'WAITING_MANAGER_APPROVAL' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>✓ Đã gửi sếp duyệt — đang chờ phê duyệt</span>
        </div>
      )}

      {partsAlreadyApproved && status === 'APPROVED' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Đã bắt đầu sản xuất</span>
        </div>
      )}

      {/* Modal từ chối mảnh */}
      <Modal open={showRejectModal} maxWidth={420} zIndex={2000}>
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
      </Modal>

      {/* Modal xác nhận gửi lại bộ phận định mức mảnh */}
      <Modal open={showSendBackModal} maxWidth={420} zIndex={2000}>
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
      </Modal>

      {/* Modal xác nhận duyệt mảnh */}
      <Modal open={confirmApproveParts} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận duyệt mảnh</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              Xác nhận duyệt định mức mảnh phôi? Sau khi duyệt, đơn hàng sẽ sẵn sàng để gửi sếp duyệt.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmApproveParts(false)} style={btnSecondary}>Hủy</button>
              <button
                onClick={async () => {
                  setConfirmApproveParts(false)
                  await handleApproveParts()
                  setApproval({ status: 'APPROVED', at: new Date() })
                }}
                disabled={processing}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff' }}
              >Xác nhận duyệt mảnh</button>
            </div>
      </Modal>

      {/* Modal xác nhận gửi sếp duyệt (KHSX) */}
      <Modal open={confirmSendForManagerApproval} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận gửi sếp duyệt</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              Xác nhận gửi danh sách mảnh phôi cho sếp phê duyệt? SKU này sẽ chuyển sang trạng thái &quot;Chờ sếp duyệt&quot;.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmSendForManagerApproval(false)} style={btnSecondary}>Hủy</button>
              <button
                onClick={async () => { setConfirmSendForManagerApproval(false); await handleSendForManagerApproval() }}
                disabled={processing}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff' }}
              >Gửi sếp duyệt</button>
            </div>
      </Modal>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties      = { padding: '7px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text3)' }
const tdStyle: React.CSSProperties      = { padding: '8px 12px' }
const btnSecondary: React.CSSProperties = { padding: '9px 20px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }
