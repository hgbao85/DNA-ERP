import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import GenericStatusBadge from '../../../components/StatusBadge'
import Modal from '../../../components/Modal'
import AuditLogTimeline from '../../../components/AuditLogTimeline'
import RefreshButton from '../../../components/RefreshButton'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import type { ManhRow, PlanForm, QuotaReviewStatus } from '../../../types/plan-form'
import { STATUS_MAP, PLANFORM_ENTITY } from '../../../constants/planFormStatus'

// ─── Status ───────────────────────────────────────────────────────────────────

export { STATUS_MAP, PLANFORM_ENTITY }

export function StatusBadge({ status }: { status: string }) {
  return <GenericStatusBadge {...(STATUS_MAP[status] ?? STATUS_MAP.APPROVED_DETAIL)} />
}

export function SKUDetail({
  pf,
  readOnly = false,
  onBack,
  onApproveDetail,
  onApproveParts,
  onSendForQlsxApproval,
  onApproveBossRequest,
  onQlsxApproveLocal,
  onQlsxSendBoss,
  onQlsxReject,
  onBossReject,
  onSendBackDetail,
  onSendBackManh,
  onRefresh,
  refreshing = false,
}: {
  pf: PlanForm
  readOnly?: boolean
  onBack: () => void
  onApproveDetail?: () => Promise<void>
  onApproveParts?: () => Promise<void>
  onSendForQlsxApproval?: () => Promise<void>
  onApproveBossRequest?: () => Promise<void>
  onQlsxApproveLocal?: () => Promise<void>
  onQlsxSendBoss?: () => Promise<void>
  onQlsxReject?: (reason?: string) => Promise<void>
  onBossReject?: (reason?: string) => Promise<void>
  onSendBackDetail?: () => Promise<void>
  onSendBackManh?: () => Promise<void>
  onRefresh?: () => void
  refreshing?: boolean
}) {
  const { user, isBoss } = useAuth()
  const isProdMgr = user?.mfgRole === 'PRODUCTION_MANAGER'
  const { logAction, getLogsFor } = useAuditLog()
  const mt = pf.quotaManagement?.materialType

  // Chi tiết đã được duyệt khi status vượt qua giai đoạn APPROVED_DETAIL (đã gửi bộ phận nhập mảnh)
  const detailAlreadyApproved = ['WAITING_PARTS', 'APPROVED_PARTS', 'WAITING_QLSX_APPROVAL', 'WAITING_BOSS_APPROVAL', 'APPROVED'].includes(pf.status)
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

  // Duyệt/từ chối 1 nhóm định mức chi tiết đều phải qua modal xác nhận, và một khi đã có quyết định
  // (secStatus[k] khác null) thì MaterialSection tự ẩn 2 nút này — không cho bấm lại/đổi ý ngoài luồng
  // "Gửi lại bộ phận Định mức chi tiết" chính thức.
  type SecModal = { key: SecKey; title: string } | null
  const [approveModal, setApproveModal] = useState<SecModal>(null)
  const confirmSectionApprove = () => {
    if (!approveModal) return
    const { key, title } = approveModal
    setSecStatus(p => ({ ...p, [key]: { status: 'APPROVED', at: new Date() } }))
    ;(api as any).reviewPlanFormDetailQuota(pf.id, key, 'APPROVED').catch(() => {})
    logAction(PLANFORM_ENTITY, String(pf.id), 'planform.detail_section_approved', title)
    setApproveModal(null)
  }

  const [rejectModal, setRejectModal] = useState<SecModal>(null)
  const [rejectReason, setRejectReason] = useState('')
  const confirmSectionReject = () => {
    if (!rejectModal) return
    const reason = rejectReason.trim() || undefined
    setSecStatus(p => ({
      ...p,
      [rejectModal.key]: { status: 'REJECTED', at: new Date(), reason },
    }))
    ;(api as any).reviewPlanFormDetailQuota(pf.id, rejectModal.key, 'REJECTED', reason).catch(() => {})
    logAction(PLANFORM_ENTITY, String(pf.id), 'planform.detail_section_rejected', reason ? `${rejectModal.title} — ${reason}` : rejectModal.title)
    setRejectModal(null)
  }

  type SecFilter = 'all' | SecKey
  const [filterSec, setFilterSec] = useState<SecFilter>('all')

  const [approvingDetail, setApprovingDetail] = useState(false)
  const [showSendConfirm, setShowSendConfirm] = useState(false)
  const [sendingBackDetail, setSendingBackDetail] = useState(false)

  const handleApproveDetail = async () => {
    if (!onApproveDetail) return
    setApprovingDetail(true)
    try { await onApproveDetail() } finally { setApprovingDetail(false) }
  }

  const handleSendBackDetail = async () => {
    if (!onSendBackDetail) return
    setSendingBackDetail(true)
    try { await onSendBackDetail() } finally { setSendingBackDetail(false) }
  }

  type DetailTab = 'chitiet' | 'manh'
  // Manh tab hiển thị khi chi tiết đã qua duyệt, HOẶC khi đã có dữ liệu mảnh từ trước (vd SKU bị
  // QLSX/Sếp từ chối nên status quay về WAITING_DETAIL, nhưng manhItems vẫn còn — vẫn cần xem lại được).
  const showManhTab = detailAlreadyApproved || (pf.manhItems?.length ?? 0) > 0
  const defaultTab: DetailTab = detailAlreadyApproved ? 'manh' : 'chitiet'
  const [detailTab, setDetailTab] = useState<DetailTab>(defaultTab)

  const canEditDetail = !readOnly && !isBoss && pf.status === 'APPROVED_DETAIL'
  const noop = () => {}

  // Sếp/QLSX duyệt: xem gộp cả chi tiết + mảnh trên 1 màn hình (không cần chuyển tab) cho tiện duyệt.
  // "Danh sách SKU" (readOnly, chỉ xem lại) vẫn dùng layout tab giống KHSX như bình thường.
  const finalReviewMode = (isBoss || isProdMgr) && !readOnly

  // QLSX duyệt cục bộ (qlsxReviewStatus) trước, rồi nút "Gửi sếp duyệt" mới hiện ra — 2 bước, giống
  // hệt cơ chế duyệt mảnh của KHSX (xem DinhMucManh bên dưới), chỉ khác là áp dụng cho cả màn gộp.
  const [qlsxApproved, setQlsxApproved] = useState(!!pf.qlsxReviewStatus)
  const handleQlsxApproveLocal = async () => {
    if (!onQlsxApproveLocal) return
    await onQlsxApproveLocal()
    setQlsxApproved(true)
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Trạng thái/dữ liệu có thể đã đổi ở phiên đăng nhập khác (vd bộ phận nhập định mức vừa
              gửi lại sau khi bị từ chối) — cho phép lấy lại bản mới nhất mà không cần tải lại cả trang. */}
          {onRefresh && <RefreshButton onRefresh={onRefresh} loading={refreshing} size="sm" />}
          <StatusBadge status={pf.status} />
        </div>
      </div>

      {/* Info strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 28px', padding: '10px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
        <span><span style={{ color: 'var(--text3)' }}>Mã nhà máy: </span><strong>{pf.mfgProduct?.factoryCode ?? '—'}</strong></span>
        <span><span style={{ color: 'var(--text3)' }}>Khách hàng: </span><strong>{pf.customerName || '—'}</strong></span>
        {pf.proposedAt && <span><span style={{ color: 'var(--text3)' }}>Thời gian tạo: </span><strong>{format(new Date(pf.proposedAt), 'dd/MM/yyyy')}</strong></span>}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      {finalReviewMode ? (
        <>
          {/* Sếp/QLSX duyệt — xem gộp cả 2 phần trên 1 màn hình, không cần chuyển tab */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Định mức chi tiết</div>
            {mt ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <MaterialSection
                  title="Sắt" color="#b45309" bg="#fef3c7" readOnly hideStatusBadge
                  entry={secStatus.sat} onApprove={noop} onReject={noop}
                  items={(Array.isArray(mt.sat) ? mt.sat : []).map(i => ({
                    name: i.name,
                    spec: [i.specifications, i.chieuDai ? `dài ${i.chieuDai}` : null, i.thickness != null ? `dày ${i.thickness}mm` : null].filter(Boolean).join(', ') || null,
                    unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
                  }))}
                />
                <MaterialSection
                  title="Dây / Sơn" color="#1d4ed8" bg="#eff6ff" readOnly hideStatusBadge
                  entry={secStatus.daySon} onApprove={noop} onReject={noop}
                  items={(Array.isArray(mt.daySon) ? mt.daySon : []).map(i => ({
                    name: i.name,
                    spec: i.specifications || null,
                    unitQty: i.kg != null ? `${i.kg} kg` : (i.unit ?? null),
                  }))}
                />
                <MaterialSection
                  title="Vật tư phụ kiện" color="#6d28d9" bg="#ede9fe" readOnly hideStatusBadge
                  entry={secStatus.vatTuPhuKien} onApprove={noop} onReject={noop}
                  items={(Array.isArray(mt.vatTuPhuKien) ? mt.vatTuPhuKien : []).map(i => ({
                    name: i.name, spec: i.specifications || null,
                    unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
                  }))}
                />
                <MaterialSection
                  title="Bao bì đóng gói" color="#065f46" bg="#d1fae5" readOnly hideStatusBadge
                  entry={secStatus.baoBiDongGoi} onApprove={noop} onReject={noop}
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

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Định mức mảnh</div>
          <DinhMucManh planFormId={pf.id} status={pf.status} readOnly hideStatusBadge manhItems={pf.manhItems} manhReviewStatus={pf.manhReviewStatus} />
        </>
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
          planFormId={pf.id}
          status={pf.status}
          readOnly={readOnly}
          manhItems={pf.manhItems}
          manhReviewStatus={pf.manhReviewStatus}
          onApproveParts={onApproveParts}
          onSendForQlsxApproval={onSendForQlsxApproval}
          onSendBackManh={onSendBackManh}
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
                onApprove={() => setApproveModal({ key: 'sat', title: 'Sắt' })}
                onReject={() => { setRejectModal({ key: 'sat', title: 'Sắt' }); setRejectReason('') }}
                items={(Array.isArray(mt.sat) ? mt.sat : []).map(i => ({
                  name: i.name,
                  spec: [i.specifications, i.chieuDai ? `dài ${i.chieuDai}` : null, i.thickness != null ? `dày ${i.thickness}mm` : null].filter(Boolean).join(', ') || null,
                  unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
                }))}
              />
            )}
            {(filterSec === 'all' || filterSec === 'daySon') && (
              <MaterialSection
                title="Dây / Sơn" color="#1d4ed8" bg="#eff6ff" readOnly={!canEditDetail}
                entry={secStatus.daySon}
                onApprove={() => setApproveModal({ key: 'daySon', title: 'Dây / Sơn' })}
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
                onApprove={() => setApproveModal({ key: 'vatTuPhuKien', title: 'Vật tư phụ kiện' })}
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
                onApprove={() => setApproveModal({ key: 'baoBiDongGoi', title: 'Bao bì đóng gói' })}
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
              {anySectionRejected && (
                <button
                  onClick={() => setShowSendConfirm(true)}
                  disabled={sendingBackDetail}
                  style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #7c3aed', background: '#faf5ff', color: '#7c3aed', cursor: sendingBackDetail ? 'not-allowed' : 'pointer', opacity: sendingBackDetail ? 0.7 : 1 }}
                >{sendingBackDetail ? 'Đang gửi...' : 'Gửi lại bộ phận Định mức chi tiết'}</button>
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
          {detailAlreadyApproved && !isBoss && (
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
      </>
      )}

      {/* Sếp duyệt lần cuối — gộp cả chi tiết + mảnh, không phụ thuộc tab đang xem */}
      {isBoss && !readOnly && (
        <FinalReviewAction
          active={pf.status === 'WAITING_BOSS_APPROVAL'}
          buttonLabel="Duyệt"
          confirmTitle="Xác nhận duyệt"
          confirmText="Xác nhận duyệt định mức chi tiết và định mức mảnh của SKU này? Sau khi duyệt, SKU sẽ được thêm vào danh sách."
          confirmLabel="Duyệt"
          onConfirm={onApproveBossRequest}
          doneActive={pf.status === 'APPROVED'}
          doneLabel="✓ Đã duyệt"
          onReject={onBossReject}
          rejectConfirmText='Từ chối SKU này? Toàn bộ định mức sẽ được gửi lại cho các bộ phận nhập liệu làm lại từ đầu (định mức chi tiết). Dữ liệu đã nhập vẫn được giữ nguyên để sửa tiếp.'
        />
      )}

      {/* QLSX duyệt — 2 bước: Duyệt (cục bộ) rồi mới Gửi sếp duyệt (chuyển status thật) */}
      {isProdMgr && !readOnly && (
        <>
          <FinalReviewAction
            active={pf.status === 'WAITING_QLSX_APPROVAL' && !qlsxApproved}
            buttonLabel="Duyệt"
            confirmTitle="Xác nhận duyệt"
            confirmText="Xác nhận duyệt định mức chi tiết và định mức mảnh của SKU này?"
            confirmLabel="Duyệt"
            onConfirm={handleQlsxApproveLocal}
            onReject={onQlsxReject}
            rejectConfirmText='Từ chối SKU này? Toàn bộ định mức sẽ được gửi lại cho các bộ phận nhập liệu làm lại từ đầu (định mức chi tiết). Dữ liệu đã nhập vẫn được giữ nguyên để sửa tiếp.'
          />
          <FinalReviewAction
            active={pf.status === 'WAITING_QLSX_APPROVAL' && qlsxApproved}
            buttonLabel="Gửi sếp duyệt"
            confirmTitle="Xác nhận gửi sếp duyệt"
            confirmText='Xác nhận gửi SKU này cho sếp phê duyệt lần cuối? SKU sẽ chuyển sang trạng thái "Chờ sếp duyệt".'
            confirmLabel="Gửi sếp duyệt"
            onConfirm={onQlsxSendBoss}
            doneActive={pf.status === 'WAITING_BOSS_APPROVAL' || pf.status === 'APPROVED'}
            doneLabel="✓ Đã gửi sếp duyệt"
          />
        </>
      )}
      </div>

      {!readOnly && (
        <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 20 }}>
          <AuditLogTimeline entries={getLogsFor(PLANFORM_ENTITY, String(pf.id))} />
        </div>
      )}
      </div>

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
                onClick={async () => { setShowSendConfirm(false); await handleSendBackDetail() }}
                disabled={sendingBackDetail}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff', opacity: sendingBackDetail ? 0.7 : 1 }}
              >{sendingBackDetail ? 'Đang gửi...' : 'Xác nhận gửi lại'}</button>
            </div>
      </Modal>

      {/* Modal xác nhận duyệt section */}
      <Modal open={!!approveModal} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận duyệt — {approveModal?.title}</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              Xác nhận duyệt định mức {approveModal?.title}? Không thể sửa lại quyết định này sau khi xác nhận.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setApproveModal(null)} style={btnSecondary}>Hủy</button>
              <button onClick={confirmSectionApprove} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff' }}>Xác nhận duyệt</button>
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
    </div>
  )
}

// ─── FinalReviewAction ────────────────────────────────────────────────────────
// Nút hành động + modal xác nhận dùng chung cho các bước duyệt gộp (Sếp duyệt cuối, QLSX duyệt/gửi
// sếp) — cùng 1 cơ chế: hiện nút khi active, xác nhận qua modal, gọi onConfirm, rồi (tuỳ chỗ dùng)
// hiện nhãn "đã xong" khi doneActive. Khác nhau chỉ ở label/text/handler do nơi gọi truyền vào.
// Truyền thêm onReject để hiện kèm nút "Từ chối" (modal riêng, có ô nhập lý do) — dùng chung cho cả
// Sếp và QLSX vì 2 bên từ chối giống hệt nhau: trả SKU về bước nhập định mức chi tiết từ đầu.

function FinalReviewAction({
  active, buttonLabel, confirmTitle, confirmText, confirmLabel, onConfirm, doneActive = false, doneLabel,
  onReject, rejectConfirmText,
}: {
  active: boolean
  buttonLabel: string
  confirmTitle: string
  confirmText: string
  confirmLabel: string
  onConfirm?: () => Promise<void>
  doneActive?: boolean
  doneLabel?: string
  onReject?: (reason?: string) => Promise<void>
  rejectConfirmText?: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectProcessing, setRejectProcessing] = useState(false)

  const handleConfirm = async () => {
    if (!onConfirm) return
    setProcessing(true)
    try { await onConfirm() } finally { setProcessing(false) }
  }

  const handleReject = async () => {
    if (!onReject) return
    setRejectProcessing(true)
    try { await onReject(rejectReason.trim() || undefined) } finally { setRejectProcessing(false); setRejectReason('') }
  }

  return (
    <>
      {active && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          {onReject && (
            <button
              onClick={() => setRejecting(true)}
              disabled={rejectProcessing}
              style={{
                padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: '1px solid #dc2626', background: '#fff5f5', color: '#dc2626',
                cursor: rejectProcessing ? 'default' : 'pointer', opacity: rejectProcessing ? 0.7 : 1,
              }}
            >{rejectProcessing ? 'Đang xử lý...' : 'Từ chối'}</button>
          )}
          <button
            onClick={() => setConfirming(true)}
            disabled={processing}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              cursor: processing ? 'default' : 'pointer',
              background: '#16a34a', color: '#fff', opacity: processing ? 0.7 : 1,
            }}
          >{processing ? 'Đang xử lý...' : buttonLabel}</button>
        </div>
      )}
      {doneActive && doneLabel && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{doneLabel}</span>
        </div>
      )}
      <Modal open={confirming} maxWidth={420} zIndex={2000}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>{confirmTitle}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>{confirmText}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setConfirming(false)} style={btnSecondary}>Hủy</button>
          <button
            onClick={async () => { setConfirming(false); await handleConfirm() }}
            disabled={processing}
            style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff' }}
          >{confirmLabel}</button>
        </div>
      </Modal>
      {onReject && (
        <Modal open={rejecting} maxWidth={420} zIndex={2000}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Từ chối SKU</h3>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text2)' }}>{rejectConfirmText}</p>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Lý do từ chối (không bắt buộc)"
            rows={3}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setRejecting(false)} style={btnSecondary}>Hủy</button>
            <button
              onClick={async () => { setRejecting(false); await handleReject() }}
              disabled={rejectProcessing}
              style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff' }}
            >Xác nhận từ chối</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── MaterialSection ──────────────────────────────────────────────────────────

type MaterialRow = { name: string; spec: string | null; unitQty: string | null }

function MaterialSection({
  title, color, bg, items, entry, readOnly = false, hideStatusBadge = false, onApprove, onReject,
}: {
  title: string; color: string; bg: string
  items: MaterialRow[]
  entry: { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null
  readOnly?: boolean
  hideStatusBadge?: boolean
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
            {status && !hideStatusBadge && <StatusBadge status={status} />}
            {/* Đã có quyết định (duyệt/từ chối) thì khoá 2 nút này — chỉ đổi được qua luồng "Gửi lại". */}
            {!readOnly && !status && (
              <>
                <button
                  onClick={onApprove}
                  style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
                >Duyệt</button>
                <button
                  onClick={onReject}
                  style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(220,38,38,0.10)', color: '#dc2626' }}
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
  planFormId, status, readOnly = false, hideStatusBadge = false, manhItems, manhReviewStatus, onApproveParts, onSendForQlsxApproval, onSendBackManh,
}: {
  planFormId: number
  status: string
  readOnly?: boolean
  hideStatusBadge?: boolean
  manhItems?: ManhRow[]
  manhReviewStatus?: QuotaReviewStatus
  onApproveParts?: () => Promise<void>
  onSendForQlsxApproval?: () => Promise<void>
  onSendBackManh?: () => Promise<void>
}) {
  const { isBoss, user } = useAuth()
  const isProdMgr = user?.mfgRole === 'PRODUCTION_MANAGER'
  const { logAction } = useAuditLog()
  // Dữ liệu mảnh thật do account Sắt nhập (qua updatePlanFormManhQuota); trống cho tới khi có người nhập.
  const rows = manhItems ?? []
  // Mảnh coi như đã duyệt xong khi SKU đã qua giai đoạn WAITING_QLSX_APPROVAL trở đi — dùng làm fallback
  // cho các SKU cũ chưa có manhReviewStatus (trước khi trường này tồn tại).
  const partsAlreadyApproved = ['WAITING_QLSX_APPROVAL', 'WAITING_BOSS_APPROVAL', 'APPROVED'].includes(status)

  // Quyết định duyệt/từ chối mảnh phải đọc từ manhReviewStatus (đã lưu ở PlanForm) — KHÔNG được suy ra
  // từ status, vì APPROVED_PARTS được set ngay khi account Sắt nhập xong, trước khi KHSX kịp duyệt.
  const [approval, setApproval] = useState<ManhApprovalEntry>(() => {
    if (manhReviewStatus) return { status: manhReviewStatus.status, at: new Date(manhReviewStatus.reviewedAt), reason: manhReviewStatus.reason }
    return partsAlreadyApproved ? { status: 'APPROVED', at: new Date() } : null
  })
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [confirmApproveParts, setConfirmApproveParts] = useState(false)
  const [confirmSendForQlsxApproval, setConfirmSendForQlsxApproval] = useState(false)
  const [showSendBackModal, setShowSendBackModal] = useState(false)
  const [sendingBackManh, setSendingBackManh] = useState(false)

  const isLocallyApproved = approval?.status === 'APPROVED'
  const isLocallyRejected = approval?.status === 'REJECTED'

  const confirmReject = async () => {
    const reason = rejectReason.trim() || undefined
    setShowRejectModal(false)
    setProcessing(true)
    try {
      await (api as any).reviewPlanFormManhQuota(planFormId, 'REJECTED', reason)
      logAction(PLANFORM_ENTITY, String(planFormId), 'planform.parts_rejected', reason)
      setApproval({ status: 'REJECTED', at: new Date(), reason })
    } finally {
      setProcessing(false)
    }
  }

  const handleApproveParts = async () => {
    setProcessing(true)
    try {
      await (api as any).reviewPlanFormManhQuota(planFormId, 'APPROVED')
      logAction(PLANFORM_ENTITY, String(planFormId), 'planform.parts_approved')
      setApproval({ status: 'APPROVED', at: new Date() })
      if (onApproveParts) await onApproveParts()
    } finally {
      setProcessing(false)
    }
  }

  const handleSendForQlsxApproval = async () => {
    if (!onSendForQlsxApproval) return
    setProcessing(true)
    try { await onSendForQlsxApproval() } finally { setProcessing(false) }
  }

  const handleSendBackManh = async () => {
    if (!onSendBackManh) return
    setSendingBackManh(true)
    try { await onSendBackManh() } finally { setSendingBackManh(false) }
  }

  // Chỉ duyệt được khi đã có dữ liệu mảnh thật (status APPROVED_PARTS = account Sắt đã nhập xong) và
  // chưa có quyết định — đã duyệt/từ chối rồi thì khoá, chỉ đổi được qua luồng "Gửi lại".
  const showApproveRejectBtns = !readOnly && !isBoss && status === 'APPROVED_PARTS' && !approval

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
          {approval && !hideStatusBadge && <StatusBadge status={approval.status} />}
          {/* Đã có quyết định thì khoá 2 nút này — chỉ đổi được qua luồng "Gửi lại". */}
          {showApproveRejectBtns && (
            <>
              <button
                onClick={() => setConfirmApproveParts(true)}
                disabled={processing}
                style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
              >Duyệt</button>
              <button
                onClick={() => { setShowRejectModal(true); setRejectReason('') }}
                disabled={processing}
                style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(220,38,38,0.10)', color: '#dc2626' }}
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
              {r.qtyPerSku && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#e65100', background: '#fff3e0', borderRadius: 4, padding: '2px 7px' }}>×{r.qtyPerSku} / SKU</span>
              )}
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
      {!readOnly && !isBoss && !isProdMgr && status === 'APPROVED_PARTS' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          {!isLocallyApproved && !isLocallyRejected && (
            <span style={{ fontSize: 12, color: '#d97706' }}>Cần duyệt danh sách mảnh mới chuyển đến công đoạn tiếp theo</span>
          )}
          {isLocallyRejected && (
            <button
              onClick={() => setShowSendBackModal(true)}
              disabled={sendingBackManh}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #7c3aed', background: '#faf5ff', color: '#7c3aed', cursor: sendingBackManh ? 'not-allowed' : 'pointer', opacity: sendingBackManh ? 0.7 : 1 }}
            >{sendingBackManh ? 'Đang gửi...' : 'Gửi lại bộ phận định mức mảnh'}</button>
          )}
          <button
            onClick={() => setConfirmSendForQlsxApproval(true)}
            disabled={!isLocallyApproved || processing}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              cursor: isLocallyApproved && !processing ? 'pointer' : 'default',
              background: isLocallyApproved && !processing ? '#16a34a' : '#e5e7eb',
              color: isLocallyApproved ? '#fff' : '#9ca3af',
              opacity: processing ? 0.7 : 1,
            }}
          >{processing ? 'Đang xử lý...' : 'Gửi Quản lý sản xuất duyệt'}</button>
        </div>
      )}
      {/* KHSX: đã gửi QLSX duyệt, đang chờ phê duyệt */}
      {!isBoss && !isProdMgr && status === 'WAITING_QLSX_APPROVAL' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>✓ Đã gửi Quản lý sản xuất duyệt — đang chờ phê duyệt</span>
        </div>
      )}
      {/* KHSX: QLSX đã duyệt và gửi sếp, đang chờ sếp duyệt lần cuối */}
      {!isBoss && !isProdMgr && status === 'WAITING_BOSS_APPROVAL' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>✓ Đã gửi sếp duyệt — đang chờ phê duyệt</span>
        </div>
      )}

      {partsAlreadyApproved && status === 'APPROVED' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Đã thêm vào danh sách SKU</span>
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
                onClick={async () => { setShowSendBackModal(false); await handleSendBackManh() }}
                disabled={sendingBackManh}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff', opacity: sendingBackManh ? 0.7 : 1 }}
              >{sendingBackManh ? 'Đang gửi...' : 'Xác nhận gửi lại'}</button>
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
                onClick={async () => { setConfirmApproveParts(false); await handleApproveParts() }}
                disabled={processing}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff' }}
              >Xác nhận duyệt mảnh</button>
            </div>
      </Modal>

      {/* Modal xác nhận gửi Quản lý sản xuất duyệt (KHSX) */}
      <Modal open={confirmSendForQlsxApproval} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận gửi Quản lý sản xuất duyệt</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              Xác nhận gửi danh sách mảnh phôi cho Quản lý sản xuất phê duyệt? SKU này sẽ chuyển sang trạng thái &quot;Chờ QLSX duyệt&quot;.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmSendForQlsxApproval(false)} style={btnSecondary}>Hủy</button>
              <button
                onClick={async () => { setConfirmSendForQlsxApproval(false); await handleSendForQlsxApproval() }}
                disabled={processing}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff' }}
              >Gửi Quản lý sản xuất duyệt</button>
            </div>
      </Modal>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties      = { padding: '7px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text3)' }
const tdStyle: React.CSSProperties      = { padding: '8px 12px' }
const btnSecondary: React.CSSProperties = { padding: '9px 20px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }
