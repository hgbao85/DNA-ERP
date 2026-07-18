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
import type { ManhGroup, ManhRow, PlanForm } from '../../../types/plan-form'
import { STATUS_MAP, PLANFORM_ENTITY, isPartsApproved } from '../../../constants/planFormStatus'

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
  onApproveBossRequest,
  onQlsxApproveLocal,
  onQlsxSendBoss,
  onQlsxReject,
  onBossReject,
  onRefresh,
  refreshing = false,
}: {
  pf: PlanForm
  readOnly?: boolean
  onBack: () => void
  /** KHSX duyệt xong toàn bộ nhóm định mức chi tiết → gửi QLSX duyệt. */
  onApproveDetail?: () => Promise<void>
  /** KHSX duyệt xong toàn bộ nhóm định mức mảnh → gửi bộ phận nhập định mức chi tiết. */
  onApproveParts?: () => Promise<void>
  onApproveBossRequest?: () => Promise<void>
  onQlsxApproveLocal?: () => Promise<void>
  onQlsxSendBoss?: () => Promise<void>
  onQlsxReject?: (reason?: string) => Promise<void>
  onBossReject?: (reason?: string) => Promise<void>
  onRefresh?: () => void
  refreshing?: boolean
}) {
  const { user, isBoss } = useAuth()
  const isProdMgr = user?.mfgRole === 'PRODUCTION_MANAGER'
  const { logAction, getLogsFor } = useAuditLog()
  const mt = pf.quotaManagement?.materialType
  const manh = pf.manhData

  // Mảnh đã được duyệt khi status vượt qua giai đoạn APPROVED_PARTS (đã gửi bộ phận nhập chi tiết)
  const partsAlreadyApproved = isPartsApproved(pf.status)
  // Chi tiết đã được duyệt khi status vượt qua giai đoạn APPROVED_DETAIL (đã gửi QLSX duyệt)
  const detailAlreadyApproved = ['WAITING_QLSX_APPROVAL', 'WAITING_BOSS_APPROVAL', 'APPROVED'].includes(pf.status)
  const approvedEntry = (at?: string) => ({ status: 'APPROVED' as const, at: new Date(at ?? pf.createdAt) })

  type SecEntry = { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null

  // ── Định mức mảnh (2 nhóm: Sắt, Dây) ────────────────────────────────────────
  const [manhSecStatus, setManhSecStatus] = useState<Record<ManhGroup, SecEntry>>(() => {
    const review = pf.manhReviewStatus
    // Fallback "coi như đã duyệt" chỉ áp dụng cho SKU cũ CHƯA TỪNG có manhReviewStatus (trước khi
    // field này tồn tại) — không áp dụng khi field đã tồn tại nhưng rỗng (vd QLSX/Sếp vừa từ chối,
    // xóa trắng quyết định cũ để KHSX duyệt lại từng mục dù mảnh đã từng qua giai đoạn APPROVED_PARTS).
    const fallback = review === undefined && partsAlreadyApproved ? approvedEntry(pf.proposedAt ?? undefined) : null
    const fromReview = (k: ManhGroup): SecEntry => {
      const r = review?.[k]
      return r ? { status: r.status, at: new Date(r.reviewedAt), reason: r.reason } : fallback
    }
    return { sat: fromReview('sat'), daySon: fromReview('daySon') }
  })
  // Mục chưa có nội dung thì nút Duyệt/Từ chối bị disable (xem ManhSteelSection/MaterialSection) —
  // vẫn phải chờ bộ phận chuyên trách nhập dữ liệu thật rồi KHSX mới duyệt được, không có đường tắt
  // nào để coi mục rỗng là "đã xong".
  const manhAllApproved = (['sat', 'daySon'] as ManhGroup[])
    .every(k => manhSecStatus[k]?.status === 'APPROVED')
  const manhAnyRejected = (['sat', 'daySon'] as ManhGroup[]).some(k => manhSecStatus[k]?.status === 'REJECTED')

  type ManhSecModal = { key: ManhGroup; title: string } | null
  const [manhApproveModal, setManhApproveModal] = useState<ManhSecModal>(null)
  const confirmManhApprove = () => {
    if (!manhApproveModal) return
    const { key, title } = manhApproveModal
    setManhSecStatus(p => ({ ...p, [key]: { status: 'APPROVED', at: new Date() } }))
    ;(api as any).reviewPlanFormManhQuota(pf.id, key, 'APPROVED').catch(() => {})
    logAction(PLANFORM_ENTITY, String(pf.id), 'planform.parts_section_approved', title)
    setManhApproveModal(null)
  }

  const [manhRejectModal, setManhRejectModal] = useState<ManhSecModal>(null)
  const [manhRejectReason, setManhRejectReason] = useState('')
  const confirmManhReject = () => {
    if (!manhRejectModal) return
    const reason = manhRejectReason.trim() || undefined
    setManhSecStatus(p => ({ ...p, [manhRejectModal.key]: { status: 'REJECTED', at: new Date(), reason } }))
    ;(api as any).reviewPlanFormManhQuota(pf.id, manhRejectModal.key, 'REJECTED', reason).catch(() => {})
    logAction(PLANFORM_ENTITY, String(pf.id), 'planform.parts_section_rejected', reason ? `${manhRejectModal.title} — ${reason}` : manhRejectModal.title)
    setManhRejectModal(null)
  }

  type ManhSecFilter = 'all' | ManhGroup
  const [filterManhSec, setFilterManhSec] = useState<ManhSecFilter>('all')

  const [approvingParts, setApprovingParts] = useState(false)

  const handleApproveParts = async () => {
    if (!onApproveParts) return
    setApprovingParts(true)
    try { await onApproveParts() } finally { setApprovingParts(false) }
  }

  // ── Định mức chi tiết (3 nhóm: Sơn/Đinh, Phụ kiện, Bao bì — Sắt đã chuyển sang định mức mảnh) ──
  type SecKey = 'daySon' | 'vatTuPhuKien' | 'baoBiDongGoi'

  const [secStatus, setSecStatus] = useState<Record<SecKey, SecEntry>>(() => {
    const review = pf.quotaManagement?.reviewStatus
    // Cùng lý do với fallback của manhSecStatus ở trên — chỉ áp dụng cho SKU cũ chưa từng có
    // reviewStatus, không áp dụng khi field tồn tại nhưng rỗng (vừa bị QLSX/Sếp từ chối).
    const fallback = review === undefined && detailAlreadyApproved ? approvedEntry(pf.proposedAt ?? undefined) : null
    const fromReview = (k: SecKey): SecEntry => {
      const r = review?.[k]
      return r ? { status: r.status, at: new Date(r.reviewedAt), reason: r.reason } : fallback
    }
    return { daySon: fromReview('daySon'), vatTuPhuKien: fromReview('vatTuPhuKien'), baoBiDongGoi: fromReview('baoBiDongGoi') }
  })
  // Cùng nguyên tắc với manhAllApproved — mục rỗng không được coi là "đã xong", phải có dữ liệu +
  // được duyệt thật thì mới tính.
  const allSectionsApproved = (['daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as SecKey[])
    .every(k => secStatus[k]?.status === 'APPROVED')

  const anySectionRejected = (['daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as SecKey[]).some(k => secStatus[k]?.status === 'REJECTED')

  // Nút "Gửi QLSX duyệt" phải chờ TẤT CẢ mục được duyệt — cả định mức mảnh lẫn chi tiết. Bình thường
  // mảnh đã được duyệt xong xuôi trước khi tới bước chi tiết nên manhAllApproved luôn đúng ở đây;
  // riêng trường hợp QLSX/Sếp từ chối (rejectToDetailReview xóa trắng cả reviewStatus lẫn
  // manhReviewStatus) thì KHSX phải duyệt lại cả 2 phần mới được gửi lại, không chỉ phần chi tiết.
  const readyForQlsx = allSectionsApproved && manhAllApproved
  const qlsxBlockedByRejection = anySectionRejected || manhAnyRejected

  // Duyệt/từ chối 1 nhóm định mức chi tiết đều phải qua modal xác nhận, và một khi đã có quyết định
  // (secStatus[k] khác null) thì MaterialSection tự ẩn 2 nút này — account chuyên trách tự thấy trạng
  // thái "Bị từ chối" (đọc thẳng quotaManagement.reviewStatus) và sửa/nộp lại ngay, không cần KHSX
  // phải bấm nút gửi lại riêng.
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
  const [confirmApproveDetail, setConfirmApproveDetail] = useState(false)

  const handleApproveDetail = async () => {
    if (!onApproveDetail) return
    setApprovingDetail(true)
    try { await onApproveDetail() } finally { setApprovingDetail(false) }
  }

  type DetailTab = 'manh' | 'chitiet'
  // Tab chi tiết hiển thị khi mảnh đã qua duyệt, HOẶC khi đã có dữ liệu chi tiết từ trước (vd SKU bị
  // QLSX/Sếp từ chối nên status quay về WAITING_PARTS, nhưng dữ liệu chi tiết vẫn còn — vẫn cần xem lại được).
  const showDetailTab = partsAlreadyApproved || (['daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as SecKey[]).some(k => (mt?.[k]?.length ?? 0) > 0)
  // Ưu tiên mở tab "Định mức mảnh" nếu nó CHƯA duyệt xong — kể cả khi status đã ở giai đoạn chi tiết
  // (vd QLSX/Sếp vừa từ chối: rejectToDetailReview xóa trắng cả manhReviewStatus lẫn reviewStatus,
  // nên Sắt/Dây cũng cần duyệt lại). Không làm vậy thì KHSX mở SKU lên sẽ rơi thẳng vào tab chi tiết,
  // dễ tưởng chỉ cần duyệt lại chi tiết mà không biết mảnh cũng đang chờ.
  const defaultTab: DetailTab = partsAlreadyApproved && manhAllApproved ? 'chitiet' : 'manh'
  const [detailTab, setDetailTab] = useState<DetailTab>(defaultTab)

  // KHSX được duyệt/từ chối từng mục (mảnh: Sắt/Dây; chi tiết: Sơn/Đinh, Phụ kiện, Bao bì) bất kể
  // đang ở giai đoạn pipeline nào — MaterialSection/ManhSteelSection tự ẩn nút khi mục đã có quyết
  // định hoặc chưa có nội dung, nên không cần khóa cứng theo status ở đây. Nhờ vậy khi QLSX/Sếp từ
  // chối (xem rejectToDetailReview), nút Duyệt/Từ chối của TẤT CẢ mục tự hiện lại ngay mà không cần
  // chờ đi lại từ đầu qua từng bước, và không bộ phận chuyên trách nào phải nhập lại dữ liệu.
  const canReview = !readOnly && !isBoss && !isProdMgr
  // Thanh "chuyển tiếp công đoạn" (Gửi bộ phận chi tiết / Gửi QLSX duyệt) chỉ hiện đúng lúc pipeline
  // đang ở giai đoạn tương ứng — khác với canReview, đây là hành động chuyển trạng thái nên vẫn cần
  // khóa theo status.
  const showManhActionBar = canReview && pf.status === 'APPROVED_PARTS'
  const showDetailActionBar = canReview && pf.status === 'APPROVED_DETAIL'
  const noop = () => {}

  // Sếp/QLSX duyệt: xem gộp cả chi tiết + mảnh trên 1 màn hình (không cần chuyển tab) cho tiện duyệt.
  // "Danh sách SKU" (readOnly, chỉ xem lại) vẫn dùng layout tab giống KHSX như bình thường.
  const finalReviewMode = (isBoss || isProdMgr) && !readOnly

  // QLSX duyệt cục bộ (qlsxReviewStatus) trước, rồi nút "Gửi sếp duyệt" mới hiện ra — 2 bước, giống
  // hệt cơ chế duyệt từng nhóm định mức mảnh của KHSX (xem ManhSteelSection/MaterialSection bên dưới),
  // chỉ khác là áp dụng cho cả màn gộp.
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
          {/* Sếp/QLSX duyệt — xem gộp cả 2 phần trên 1 màn hình, không cần chuyển tab. Mảnh hiện
              trước vì đây là bước nhập đầu tiên trong flow hiện tại. */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Định mức mảnh</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ManhSteelSection
                readOnly hideStatusBadge entry={manhSecStatus.sat} onApprove={noop} onReject={noop}
                rows={manh?.sat ?? []}
              />
              <MaterialSection
                title="Dây" color="#1d4ed8" bg="#eff6ff" readOnly hideStatusBadge
                entry={manhSecStatus.daySon} onApprove={noop} onReject={noop}
                items={(manh?.daySon ?? []).map(i => ({
                  name: i.name,
                  spec: i.specifications || null,
                  unitQty: i.kg != null ? `${i.kg} kg` : (i.unit ?? null),
                }))}
              />
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Định mức chi tiết</div>
          {mt ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <MaterialSection
                title="Sơn / Đinh" color="#1d4ed8" bg="#eff6ff" readOnly hideStatusBadge
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
        </>
      ) : (
      <>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([
          ['manh', 'Định mức mảnh'],
          ...(showDetailTab ? [['chitiet', 'Định mức chi tiết']] : []),
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
        <div style={{ marginBottom: 24 }}>
          {/* Section filter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Danh sách định mức mảnh</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {([
                ['all', 'Tất cả'], ['sat', 'Sắt'], ['daySon', 'Dây'],
              ] as [ManhSecFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilterManhSec(key)}
                  style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: filterManhSec === key ? '#2e7d32' : 'var(--surface2)',
                    color: filterManhSec === key ? '#fff' : 'var(--text)',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Manh sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(filterManhSec === 'all' || filterManhSec === 'sat') && (
              <ManhSteelSection
                readOnly={!canReview} entry={manhSecStatus.sat}
                onApprove={() => setManhApproveModal({ key: 'sat', title: 'Sắt' })}
                onReject={() => { setManhRejectModal({ key: 'sat', title: 'Sắt' }); setManhRejectReason('') }}
                rows={manh?.sat ?? []}
              />
            )}
            {(filterManhSec === 'all' || filterManhSec === 'daySon') && (
              <MaterialSection
                title="Dây" color="#1d4ed8" bg="#eff6ff" readOnly={!canReview}
                entry={manhSecStatus.daySon}
                onApprove={() => setManhApproveModal({ key: 'daySon', title: 'Dây' })}
                onReject={() => { setManhRejectModal({ key: 'daySon', title: 'Dây' }); setManhRejectReason('') }}
                items={(manh?.daySon ?? []).map(i => ({
                  name: i.name,
                  spec: i.specifications || null,
                  unitQty: i.kg != null ? `${i.kg} kg` : (i.unit ?? null),
                }))}
              />
            )}
          </div>

          {/* Actions */}
          {showManhActionBar && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              {!manhAllApproved && !manhAnyRejected && (
                <span style={{ fontSize: 12, color: '#d97706' }}>Cần nhập và duyệt đủ tất cả các mục mới được chuyển đến công đoạn tiếp theo</span>
              )}
              {manhAnyRejected && (
                <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>Có nhóm bị từ chối — đang chờ bộ phận nhập lại</span>
              )}
              <button
                onClick={handleApproveParts}
                disabled={!manhAllApproved || approvingParts}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                  cursor: manhAllApproved && !approvingParts ? 'pointer' : 'not-allowed',
                  background: manhAllApproved ? '#2e7d32' : '#e5e7eb',
                  color: manhAllApproved ? '#fff' : '#9ca3af',
                  opacity: approvingParts ? 0.7 : 1,
                }}
              >
                {approvingParts ? 'Đang gửi...' : 'Gửi bộ phận Định mức chi tiết'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Định mức chi tiết */}
      {detailTab === 'chitiet' && (mt ? (
        <div style={{ marginBottom: 24 }}>
          {/* Section filter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Danh sách định mức chi tiết</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {([
                ['all', 'Tất cả'], ['daySon', 'Sơn / Đinh'],
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
            {(filterSec === 'all' || filterSec === 'daySon') && (
              <MaterialSection
                title="Sơn / Đinh" color="#1d4ed8" bg="#eff6ff" readOnly={!canReview}
                entry={secStatus.daySon}
                onApprove={() => setApproveModal({ key: 'daySon', title: 'Sơn / Đinh' })}
                onReject={() => { setRejectModal({ key: 'daySon', title: 'Sơn / Đinh' }); setRejectReason('') }}
                items={(Array.isArray(mt.daySon) ? mt.daySon : []).map(i => ({
                  name: i.name,
                  spec: i.specifications || null,
                  unitQty: i.kg != null ? `${i.kg} kg` : (i.unit ?? null),
                }))}
              />
            )}
            {(filterSec === 'all' || filterSec === 'vatTuPhuKien') && (
              <MaterialSection
                title="Vật tư phụ kiện" color="#6d28d9" bg="#ede9fe" readOnly={!canReview}
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
                title="Bao bì đóng gói" color="#065f46" bg="#d1fae5" readOnly={!canReview}
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
          {showDetailActionBar && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              {/* allSectionsApproved xong nhưng vẫn chưa readyForQlsx nghĩa là mảnh (tab khác) đang
                  chặn — chỉ xảy ra khi QLSX/Sếp vừa từ chối. Nói rõ ra để KHSX không tưởng nhầm mục
                  nào trên chính tab này còn thiếu. */}
              {!readyForQlsx && !qlsxBlockedByRejection && allSectionsApproved && !manhAllApproved && (
                <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>⚠ Định mức mảnh (tab bên cạnh) cũng cần được duyệt lại</span>
              )}
              {!readyForQlsx && !qlsxBlockedByRejection && !allSectionsApproved && (
                <span style={{ fontSize: 12, color: '#d97706' }}>Cần nhập và duyệt đủ tất cả các mục mới được chuyển đến công đoạn tiếp theo</span>
              )}
              {qlsxBlockedByRejection && (
                <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>Có nhóm bị từ chối — đang chờ bộ phận nhập lại</span>
              )}
              <button
                onClick={() => setConfirmApproveDetail(true)}
                disabled={!readyForQlsx || approvingDetail}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                  cursor: readyForQlsx && !approvingDetail ? 'pointer' : 'not-allowed',
                  background: readyForQlsx ? '#2e7d32' : '#e5e7eb',
                  color: readyForQlsx ? '#fff' : '#9ca3af',
                  opacity: approvingDetail ? 0.7 : 1,
                }}
              >
                {approvingDetail ? 'Đang gửi...' : 'Gửi QLSX duyệt'}
              </button>
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
          rejectConfirmText='Từ chối SKU này? SKU sẽ quay lại cho KHSX duyệt lại từng mục định mức (mảnh + chi tiết). Dữ liệu đã nhập vẫn được giữ nguyên, không bộ phận nào phải nhập lại.'
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
            rejectConfirmText='Từ chối SKU này? SKU sẽ quay lại cho KHSX duyệt lại từng mục định mức (mảnh + chi tiết). Dữ liệu đã nhập vẫn được giữ nguyên, không bộ phận nào phải nhập lại.'
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

      {/* Modal xác nhận duyệt nhóm định mức mảnh */}
      <Modal open={!!manhApproveModal} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận duyệt — {manhApproveModal?.title}</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              Xác nhận duyệt định mức mảnh {manhApproveModal?.title}? Không thể sửa lại quyết định này sau khi xác nhận.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setManhApproveModal(null)} style={btnSecondary}>Hủy</button>
              <button onClick={confirmManhApprove} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff' }}>Xác nhận duyệt</button>
            </div>
      </Modal>

      {/* Modal từ chối nhóm định mức mảnh */}
      <Modal open={!!manhRejectModal} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Từ chối — {manhRejectModal?.title}</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text3)' }}>Nhập lý do từ chối (không bắt buộc)</p>
            <textarea
              value={manhRejectReason}
              onChange={e => setManhRejectReason(e.target.value)}
              placeholder="Vd: Sai kích thước, thiếu mảnh..."
              rows={3}
              autoFocus
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setManhRejectModal(null)} style={btnSecondary}>Hủy</button>
              <button onClick={confirmManhReject} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff' }}>Xác nhận từ chối</button>
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

      {/* Modal xác nhận gửi QLSX duyệt */}
      <Modal open={confirmApproveDetail} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận gửi QLSX duyệt</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              Toàn bộ định mức mảnh và định mức chi tiết đã được duyệt. Xác nhận gửi Quản lý sản xuất duyệt?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmApproveDetail(false)} style={btnSecondary}>Hủy</button>
              <button
                onClick={async () => { setConfirmApproveDetail(false); await handleApproveDetail() }}
                disabled={approvingDetail}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#2e7d32', color: '#fff' }}
              >Xác nhận gửi</button>
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
// Sếp và QLSX vì 2 bên từ chối giống hệt nhau: trả SKU về bước nhập định mức mảnh (bước đầu tiên).

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
            {/* Đã có quyết định (duyệt/từ chối) thì khoá 2 nút này. Chưa có nội dung thì vẫn hiện
                nút nhưng disable — để KHSX thấy rõ đang bị chặn vì thiếu dữ liệu, không phải vì
                mục này "coi như xong". */}
            {!readOnly && !status && (
              <>
                <button
                  onClick={onApprove}
                  disabled={items.length === 0}
                  title={items.length === 0 ? 'Chưa có dữ liệu để duyệt' : undefined}
                  style={{
                    padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none',
                    cursor: items.length === 0 ? 'not-allowed' : 'pointer',
                    background: 'rgba(22,163,74,0.12)', color: '#16a34a',
                    opacity: items.length === 0 ? 0.45 : 1,
                  }}
                >Duyệt</button>
                <button
                  onClick={onReject}
                  disabled={items.length === 0}
                  title={items.length === 0 ? 'Chưa có dữ liệu để từ chối' : undefined}
                  style={{
                    padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none',
                    cursor: items.length === 0 ? 'not-allowed' : 'pointer',
                    background: 'rgba(220,38,38,0.10)', color: '#dc2626',
                    opacity: items.length === 0 ? 0.45 : 1,
                  }}
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

// ─── ManhSteelSection ─────────────────────────────────────────────────────────
// Bản "mảnh -> loại sắt con" của MaterialSection ngay bên dưới — cùng khung header/màu/nút
// duyệt-từ chối, chỉ khác phần thân: mỗi mảnh 1 card chứa bảng loại sắt con (không phải bảng phẳng).

function ManhSteelSection({
  rows, entry, readOnly = false, hideStatusBadge = false, onApprove, onReject,
}: {
  rows: ManhRow[]
  entry: { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null
  readOnly?: boolean
  hideStatusBadge?: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const status = entry?.status ?? null
  const totalChildren = rows.reduce((s, r) => s + r.children.length, 0)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: '#fef3c7', padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#b45309', fontWeight: 700, fontSize: 12 }}>
            Sắt <span style={{ fontWeight: 400, opacity: 0.7 }}>({rows.length} mảnh · {totalChildren} loại sắt)</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {status && !hideStatusBadge && <StatusBadge status={status} />}
            {/* Chưa có loại sắt con nào thì vẫn hiện nút nhưng disable — báo rõ đang chặn vì thiếu
                dữ liệu, thay vì âm thầm coi mục này là "đã xong". */}
            {!readOnly && !status && (
              <>
                <button
                  onClick={onApprove}
                  disabled={totalChildren === 0}
                  title={totalChildren === 0 ? 'Chưa có dữ liệu để duyệt' : undefined}
                  style={{
                    padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none',
                    cursor: totalChildren === 0 ? 'not-allowed' : 'pointer',
                    background: 'rgba(22,163,74,0.12)', color: '#16a34a',
                    opacity: totalChildren === 0 ? 0.45 : 1,
                  }}
                >Duyệt</button>
                <button
                  onClick={onReject}
                  disabled={totalChildren === 0}
                  title={totalChildren === 0 ? 'Chưa có dữ liệu để từ chối' : undefined}
                  style={{
                    padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none',
                    cursor: totalChildren === 0 ? 'not-allowed' : 'pointer',
                    background: 'rgba(220,38,38,0.10)', color: '#dc2626',
                    opacity: totalChildren === 0 ? 0.45 : 1,
                  }}
                >Từ chối</button>
              </>
            )}
          </div>
        </div>
        {status === 'REJECTED' && entry?.reason && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626', fontStyle: 'italic' }}>{entry.reason}</div>
        )}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text3)' }}>—</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
          {rows.map(r => (
            <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
                background: 'var(--surface2)', borderBottom: r.children.length > 0 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{r.name}</span>
                {r.qtyPerSku && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#e65100', background: '#fff3e0', borderRadius: 4, padding: '2px 7px' }}>×{r.qtyPerSku} / SKU</span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{r.children.length} loại sắt</span>
              </div>
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
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties      = { padding: '7px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text3)' }
const tdStyle: React.CSSProperties      = { padding: '8px 12px' }
const btnSecondary: React.CSSProperties = { padding: '9px 20px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }
