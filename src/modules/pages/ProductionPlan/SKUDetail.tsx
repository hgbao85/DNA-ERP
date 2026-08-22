import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import GenericStatusBadge from '../../../components/StatusBadge'
import Modal from '../../../components/Modal'
import AuditLogTimeline from '../../../components/AuditLogTimeline'
import RefreshButton from '../../../components/RefreshButton'
import { reviewSkuManhQuota, reviewSkuDetailQuota } from '../../../services/sku-api'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import type { ManhChildGroup, ManhRow, MaterialType, Sku } from '../../../types/sku'
import { STATUS_MAP, SKU_ENTITY } from '../../../constants/skuStatus'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'

// ─── Status ───────────────────────────────────────────────────────────────────

export { STATUS_MAP, SKU_ENTITY }

export function StatusBadge({ status }: { status: string }) {
  return <GenericStatusBadge {...(STATUS_MAP[status] ?? STATUS_MAP.IN_PROGRESS)} />
}

/** 3 nhóm định mức chi tiết — vẫn dùng để gắn nhãn/lọc hiển thị dù giờ chỉ còn 1 quyết định
 *  duyệt duy nhất cho cả 3 (xem secStatus trong SKUDetail). */
type SecKey = 'daySon' | 'vatTuPhuKien' | 'baoBiDongGoi'

export function SKUDetail({
  pf,
  readOnly = false,
  onBack,
  onApproveDetail,
  onApproveParts,
  onApproveBossRequest,
  onBossReject,
  onRefresh,
  refreshing = false,
}: {
  pf: Sku
  readOnly?: boolean
  onBack: () => void
  /** KHSX duyệt xong toàn bộ nhóm định mức chi tiết → gửi Sếp duyệt. */
  onApproveDetail?: () => Promise<void>
  /** KHSX duyệt xong toàn bộ nhóm định mức mảnh → gửi bộ phận nhập định mức chi tiết. */
  onApproveParts?: () => Promise<void>
  onApproveBossRequest?: () => Promise<void>
  onBossReject?: (reason?: string) => Promise<void>
  onRefresh?: () => void
  refreshing?: boolean
}) {
  const { isBoss } = useAuth()
  const { logAction, getLogsFor } = useAuditLog()
  const mt = pf.quotaManagement?.materialType
  const manh = pf.manhData

  // Mảnh/chi tiết là 2 nhánh độc lập - "đã forward" (KHSX chốt xong, xem advanceForwardedTrack ở
  // BE) không còn suy ra được từ status (chỉ còn 3 giá trị tổng quát), đọc thẳng 2 mốc thời gian.
  const partsAlreadyApproved = !!pf.manhForwardedAt
  const detailAlreadyApproved = !!pf.detailForwardedAt
  const approvedEntry = (at?: string) => ({ status: 'APPROVED' as const, at: new Date(at ?? pf.createdAt) })

  type SecEntry = { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null

  // ── Định mức mảnh (5 nhóm vật tư: Sắt/Dây/Đinh/Tán rút/Nút nhựa — 1 acc Sắt nhập chung,
  // 1 quyết định duyệt duy nhất cho cả mảnh, không còn tách riêng theo từng nhóm như trước) ──
  const [manhSecStatus, setManhSecStatus] = useState<SecEntry>(() => {
    const review = pf.manhReviewStatus
    // Fallback "coi như đã duyệt" chỉ áp dụng cho SKU cũ CHƯA TỪNG có manhReviewStatus (trước khi
    // field này tồn tại) — không áp dụng khi field đã tồn tại nhưng rỗng (vd Sếp vừa từ chối,
    // xóa trắng quyết định cũ để KHSX duyệt lại dù mảnh đã từng forward xong trước đó).
    const fallback = review === undefined && partsAlreadyApproved ? approvedEntry(pf.proposedAt ?? undefined) : null
    return review ? { status: review.status, at: new Date(review.reviewedAt), reason: review.reason } : fallback
  })
  // Mục chưa có nội dung thì nút Duyệt/Từ chối bị disable (xem ManhPiecesSection) — vẫn phải chờ
  // account Sắt nhập dữ liệu thật rồi KHSX mới duyệt được, không có đường tắt nào để coi mục rỗng
  // là "đã xong".
  const manhAllApproved = manhSecStatus?.status === 'APPROVED'
  const manhAnyRejected = manhSecStatus?.status === 'REJECTED'

  const [manhApproveModalOpen, setManhApproveModalOpen] = useState(false)
  const confirmManhApprove = async () => {
    setManhApproveModalOpen(false)
    setManhSecStatus({ status: 'APPROVED', at: new Date() })
    try {
      await reviewSkuManhQuota(pf.id, 'APPROVED')
      logAction(SKU_ENTITY, String(pf.id), 'sku.parts_section_approved', 'Định mức mảnh')
    } catch (e: unknown) {
      setManhSecStatus(null)
      alert(e instanceof Error ? e.message : 'Không thể duyệt định mức mảnh')
    }
  }

  const [manhRejectModalOpen, setManhRejectModalOpen] = useState(false)
  const [manhRejectReason, setManhRejectReason] = useState('')
  const confirmManhReject = async () => {
    const reason = manhRejectReason.trim() || undefined
    setManhRejectModalOpen(false)
    setManhSecStatus({ status: 'REJECTED', at: new Date(), reason })
    try {
      await reviewSkuManhQuota(pf.id, 'REJECTED', reason)
      logAction(SKU_ENTITY, String(pf.id), 'sku.parts_section_rejected', reason ? `Định mức mảnh — ${reason}` : 'Định mức mảnh')
    } catch (e: unknown) {
      setManhSecStatus(null)
      alert(e instanceof Error ? e.message : 'Không thể từ chối định mức mảnh')
    }
  }

  // Không còn gate duyệt/từ chối theo nhóm — filter này chỉ để lọc HIỂN THỊ children theo nhóm
  // vật tư bên trong bảng mảnh (xem ManhPiecesSection), không ảnh hưởng quyết định duyệt.
  type ManhSecFilter = 'all' | ManhChildGroup
  const [filterManhSec, setFilterManhSec] = useState<ManhSecFilter>('all')

  const [approvingParts, setApprovingParts] = useState(false)

  const handleApproveParts = async () => {
    if (!onApproveParts) return
    setApprovingParts(true)
    try {
      await onApproveParts()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Không thể gửi bộ phận Định mức chi tiết')
    } finally {
      setApprovingParts(false)
    }
  }

  // ── Định mức chi tiết (Sơn, Phụ kiện, Bao bì — 1 quyết định duyệt duy nhất cho cả 3 nhóm,
  // Sắt/Đinh đã chuyển sang định mức mảnh) ──────────────────────────────────────────────────
  const [secStatus, setSecStatus] = useState<SecEntry>(() => {
    const review = pf.quotaManagement?.reviewStatus
    // Cùng lý do với fallback của manhSecStatus ở trên — chỉ áp dụng cho SKU cũ chưa từng có
    // reviewStatus, không áp dụng khi field tồn tại nhưng rỗng (vừa bị Sếp từ chối).
    const fallback = review === undefined && detailAlreadyApproved ? approvedEntry(pf.proposedAt ?? undefined) : null
    return review ? { status: review.status, at: new Date(review.reviewedAt), reason: review.reason } : fallback
  })
  // Cùng nguyên tắc với manhAllApproved — mục rỗng không được coi là "đã xong", phải có dữ liệu +
  // được duyệt thật thì mới tính.
  const detailApproved = secStatus?.status === 'APPROVED'
  const detailRejected = secStatus?.status === 'REJECTED'

  // Nút "Xác nhận hoàn tất — Định mức chi tiết" chỉ phụ thuộc CHÍNH nhánh chi tiết - không còn chờ
  // mảnh (2 nhánh độc lập, xem showManhActionBar/showDetailActionBar). Gửi sếp duyệt thật sự chỉ
  // xảy ra khi CẢ HAI nhánh đã forward (server tự kiểm - xem advanceForwardedTrack ở BE).
  const readyToForwardDetail = detailApproved
  const detailBlockedByRejection = detailRejected

  // Duyệt/từ chối định mức chi tiết đều phải qua modal xác nhận, và một khi đã có quyết định
  // thì phần hiển thị tự ẩn 2 nút này — account chuyên trách tự thấy trạng thái "Bị từ chối"
  // (đọc thẳng quotaManagement.reviewStatus) và sửa/nộp lại ngay, không cần KHSX phải bấm nút
  // gửi lại riêng.
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const confirmSectionApprove = async () => {
    setApproveModalOpen(false)
    setSecStatus({ status: 'APPROVED', at: new Date() })
    try {
      await reviewSkuDetailQuota(pf.id, 'APPROVED')
      logAction(SKU_ENTITY, String(pf.id), 'sku.detail_section_approved', 'Định mức chi tiết')
    } catch (e: unknown) {
      setSecStatus(null)
      alert(e instanceof Error ? e.message : 'Không thể duyệt định mức chi tiết')
    }
  }

  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const confirmSectionReject = async () => {
    const reason = rejectReason.trim() || undefined
    setRejectModalOpen(false)
    setSecStatus({ status: 'REJECTED', at: new Date(), reason })
    try {
      await reviewSkuDetailQuota(pf.id, 'REJECTED', reason)
      logAction(SKU_ENTITY, String(pf.id), 'sku.detail_section_rejected', reason ? `Định mức chi tiết — ${reason}` : 'Định mức chi tiết')
    } catch (e: unknown) {
      setSecStatus(null)
      alert(e instanceof Error ? e.message : 'Không thể từ chối định mức chi tiết')
    }
  }

  // Không còn gate duyệt/từ chối theo nhóm — filter này chỉ để lọc HIỂN THỊ (ẩn/hiện từng bảng
  // Sơn/Phụ kiện/Bao bì), không ảnh hưởng quyết định duyệt.
  type SecFilter = 'all' | SecKey
  const [filterSec, setFilterSec] = useState<SecFilter>('all')

  const [approvingDetail, setApprovingDetail] = useState(false)
  const [confirmApproveDetail, setConfirmApproveDetail] = useState(false)

  const handleApproveDetail = async () => {
    if (!onApproveDetail) return
    setApprovingDetail(true)
    try {
      await onApproveDetail()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Không thể gửi sếp duyệt')
    } finally {
      setApprovingDetail(false)
    }
  }

  type DetailTab = 'manh' | 'chitiet'
  // Mảnh và chi tiết là 2 nhánh độc lập, tiến song song - cả 2 tab luôn hiện, không còn tab nào
  // bị khoá chờ nhánh kia xong (chuyên viên chi tiết có thể nhập ngay từ khi tạo SKU).
  const showDetailTab = true
  // Ưu tiên mở tab của nhánh CHƯA forward xong (còn việc cần xử lý) - mảnh trước nếu cả 2 đều
  // chưa xong, tương tự tinh thần cũ nhưng không còn phụ thuộc thứ tự tuyến tính.
  const defaultTab: DetailTab = !partsAlreadyApproved ? 'manh' : !detailAlreadyApproved ? 'chitiet' : 'manh'
  const [detailTab, setDetailTab] = useState<DetailTab>(defaultTab)

  // KHSX được duyệt/từ chối từng mục (mảnh: 1 quyết định cho cả 5 nhóm; chi tiết: Sơn, Phụ kiện,
  // Bao bì) bất kể đang ở giai đoạn pipeline nào — MaterialSection/ManhPiecesSection tự ẩn nút khi mục đã có quyết
  // định hoặc chưa có nội dung, nên không cần khóa cứng theo status ở đây. Nhờ vậy khi Sếp từ
  // chối (xem rejectToDetailReview), nút Duyệt/Từ chối của TẤT CẢ mục tự hiện lại ngay mà không cần
  // chờ đi lại từ đầu qua từng bước, và không bộ phận chuyên trách nào phải nhập lại dữ liệu.
  const canReview = !readOnly && !isBoss
  // Thanh "xác nhận hoàn tất" của mỗi nhánh hiện tới khi nhánh đó CHƯA forward - 2 nhánh độc lập,
  // hiện song song, không còn khoá theo vị trí pipeline của status như trước.
  const showManhActionBar = canReview && !partsAlreadyApproved
  const showDetailActionBar = canReview && !detailAlreadyApproved
  const noop = () => {}

  // Sếp duyệt: xem gộp cả chi tiết + mảnh trên 1 màn hình (không cần chuyển tab) cho tiện duyệt.
  // "Danh sách SKU" (readOnly, chỉ xem lại) vẫn dùng layout tab giống KHSX như bình thường.
  const finalReviewMode = isBoss && !readOnly

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

      {/* Lý do Sếp từ chối lần gần nhất — BE tự xoá field này khi SKU được duyệt xong (xem
          SkusService.approve), nên chỉ còn hiện khi thật sự đang chờ xử lý lại. Hiện cho cả KHSX
          (người phải sửa) lẫn Sếp (nhắc lại lý do lần trước khi SKU quay lại chờ duyệt). */}
      {pf.bossRejectReason && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>
          <strong style={{ flexShrink: 0 }}>⚠ Sếp đã từ chối lần gần nhất:</strong>
          <span>{pf.bossRejectReason}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      {finalReviewMode ? (
        <>
          {/* Sếp duyệt — xem gộp cả 2 phần trên 1 màn hình, không cần chuyển tab. Mảnh hiện
              trước vì đây là bước nhập đầu tiên trong flow hiện tại. */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Định mức mảnh</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ManhPiecesSection
                readOnly hideStatusBadge entry={manhSecStatus} onApprove={noop} onReject={noop}
                rows={manh?.pieces ?? []}
              />
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Định mức chi tiết</div>
          {mt ? (
            <DetailLinesTable rows={buildDetailRows(mt)} />
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
                ['all', 'Tất cả'], ['sat', 'Sắt'], ['day', 'Dây'], ['dinh', 'Đinh'],
                ['tanRut', 'Tán rút'], ['nutNhua', 'Nút nhựa'],
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

          {/* Manh section — 1 quyết định duyệt duy nhất cho cả 5 nhóm vật tư */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ManhPiecesSection
              readOnly={!canReview} entry={manhSecStatus}
              onApprove={() => setManhApproveModalOpen(true)}
              onReject={() => { setManhRejectModalOpen(true); setManhRejectReason('') }}
              rows={manh?.pieces ?? []}
              filterGroup={filterManhSec === 'all' ? undefined : filterManhSec}
            />
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
                {approvingParts ? 'Đang gửi...' : 'Xác nhận hoàn tất — Định mức mảnh'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Định mức chi tiết */}
      {detailTab === 'chitiet' && (mt ? (
        <div style={{ marginBottom: 24 }}>
          {/* Section filter + 1 quyết định duyệt duy nhất cho cả 3 nhóm */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Danh sách định mức chi tiết</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {([
                  ['all', 'Tất cả'], ['daySon', 'Sơn'],
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
              {secStatus?.status && <StatusBadge status={secStatus.status} />}
              {canReview && !secStatus?.status && (
                <>
                  {(() => {
                    const totalDetailItems = (Array.isArray(mt.daySon) ? mt.daySon.length : 0)
                      + (Array.isArray(mt.vatTuPhuKien) ? mt.vatTuPhuKien.length : 0)
                      + (Array.isArray(mt.baoBiDongGoi) ? mt.baoBiDongGoi.length : 0)
                    return (
                      <>
                        <button
                          onClick={() => setApproveModalOpen(true)}
                          disabled={totalDetailItems === 0}
                          title={totalDetailItems === 0 ? 'Chưa có dữ liệu để duyệt' : undefined}
                          style={{
                            padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none',
                            cursor: totalDetailItems === 0 ? 'not-allowed' : 'pointer',
                            background: 'rgba(22,163,74,0.12)', color: '#16a34a',
                            opacity: totalDetailItems === 0 ? 0.45 : 1,
                          }}
                        >Duyệt</button>
                        <button
                          onClick={() => { setRejectModalOpen(true); setRejectReason('') }}
                          disabled={totalDetailItems === 0}
                          title={totalDetailItems === 0 ? 'Chưa có dữ liệu để từ chối' : undefined}
                          style={{
                            padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none',
                            cursor: totalDetailItems === 0 ? 'not-allowed' : 'pointer',
                            background: 'rgba(220,38,38,0.10)', color: '#dc2626',
                            opacity: totalDetailItems === 0 ? 0.45 : 1,
                          }}
                        >Từ chối</button>
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
          {secStatus?.status === 'REJECTED' && secStatus.reason && (
            <div style={{ marginBottom: 12, fontSize: 12, color: '#dc2626', fontStyle: 'italic' }}>{secStatus.reason}</div>
          )}

          {/* Bảng gộp cả 3 nhóm — quyết định duyệt/từ chối đã chuyển lên header chung phía trên */}
          <DetailLinesTable rows={buildDetailRows(mt).filter(r => filterSec === 'all' || r.group === filterSec)} />

          {/* Actions */}
          {showDetailActionBar && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              {!readyToForwardDetail && !detailBlockedByRejection && (
                <span style={{ fontSize: 12, color: '#d97706' }}>Cần nhập và duyệt đủ tất cả các mục mới được chuyển đến công đoạn tiếp theo</span>
              )}
              {detailBlockedByRejection && (
                <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>Có nhóm bị từ chối — đang chờ bộ phận nhập lại</span>
              )}
              <button
                onClick={() => setConfirmApproveDetail(true)}
                disabled={!readyToForwardDetail || approvingDetail}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                  cursor: readyToForwardDetail && !approvingDetail ? 'pointer' : 'not-allowed',
                  background: readyToForwardDetail ? '#2e7d32' : '#e5e7eb',
                  color: readyToForwardDetail ? '#fff' : '#9ca3af',
                  opacity: approvingDetail ? 0.7 : 1,
                }}
              >
                {approvingDetail ? 'Đang gửi...' : 'Xác nhận hoàn tất — Định mức chi tiết'}
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

      {/* Cả 2 nhánh đã forward xong (server tự phát hiện, xem advanceForwardedTrack ở BE) - báo
          cho KHSX biết SKU đã sang tay Sếp mà không cần suy ra từ việc 2 nút hành động đã ẩn. */}
      {!isBoss && !readOnly && pf.status === 'WAITING_BOSS_APPROVAL' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Đã gửi sếp duyệt</span>
        </div>
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
      </div>

      {!readOnly && (
        <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 20 }}>
          <AuditLogTimeline entries={getLogsFor(SKU_ENTITY, String(pf.id))} />
        </div>
      )}
      </div>

      {/* Modal xác nhận duyệt định mức mảnh */}
      <Modal open={manhApproveModalOpen} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận duyệt — Định mức mảnh</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              Xác nhận duyệt định mức mảnh (cả 5 nhóm vật tư)? Không thể sửa lại quyết định này sau khi xác nhận.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setManhApproveModalOpen(false)} style={btnSecondary}>Hủy</button>
              <button onClick={confirmManhApprove} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff' }}>Xác nhận duyệt</button>
            </div>
      </Modal>

      {/* Modal từ chối định mức mảnh */}
      <Modal open={manhRejectModalOpen} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Từ chối — Định mức mảnh</h3>
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
              <button onClick={() => setManhRejectModalOpen(false)} style={btnSecondary}>Hủy</button>
              <button onClick={confirmManhReject} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff' }}>Xác nhận từ chối</button>
            </div>
      </Modal>

      {/* Modal xác nhận duyệt định mức chi tiết */}
      <Modal open={approveModalOpen} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận duyệt — Định mức chi tiết</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              Xác nhận duyệt định mức chi tiết (cả 3 nhóm Sơn/Phụ kiện/Bao bì)? Không thể sửa lại quyết định này sau khi xác nhận.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setApproveModalOpen(false)} style={btnSecondary}>Hủy</button>
              <button onClick={confirmSectionApprove} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#16a34a', color: '#fff' }}>Xác nhận duyệt</button>
            </div>
      </Modal>

      {/* Modal từ chối định mức chi tiết */}
      <Modal open={rejectModalOpen} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Từ chối — Định mức chi tiết</h3>
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
              <button onClick={() => setRejectModalOpen(false)} style={btnSecondary}>Hủy</button>
              <button onClick={confirmSectionReject} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff' }}>Xác nhận từ chối</button>
            </div>
      </Modal>

      {/* Modal xác nhận hoàn tất nhánh chi tiết */}
      <Modal open={confirmApproveDetail} maxWidth={420} zIndex={2000}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Xác nhận hoàn tất — Định mức chi tiết</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              Định mức chi tiết đã được duyệt. Xác nhận chốt xong nhánh này? Khi định mức mảnh cũng
              đã chốt xong, SKU sẽ tự động gửi sếp duyệt.
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
// Nút hành động + modal xác nhận cho bước duyệt gộp cuối (Sếp duyệt) — hiện nút khi active, xác
// nhận qua modal, gọi onConfirm, rồi hiện nhãn "đã xong" khi doneActive. Truyền thêm onReject để
// hiện kèm nút "Từ chối" (modal riêng, có ô nhập lý do): trả SKU về bước nhập định mức mảnh (bước
// đầu tiên).

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

// ─── DetailLinesTable ─────────────────────────────────────────────────────────
// Định mức chi tiết (Sơn/Phụ kiện/Bao bì) hiện gộp thành 1 bảng duy nhất (cột "Nhóm" badge)
// — giống hệt kiểu bảng gộp bên trang nhập (SpecDetailQuotaPage.tsx) — thay vì 3 khối riêng
// như MaterialSection cũ, vì 3 nhóm giờ chỉ còn 1 quyết định duyệt duy nhất (xem secStatus).

type DetailRow = { id: string; group: SecKey; name: string; specs: string | null; qty: string | null; unit: string | null }

const DETAIL_GROUP_LABELS: Record<SecKey, string> = { daySon: 'Sơn', vatTuPhuKien: 'Phụ kiện', baoBiDongGoi: 'Bao bì' }
const DETAIL_GROUP_BADGE: Record<SecKey, { bg: string; fg: string }> = {
  daySon: { bg: '#eff6ff', fg: '#1d4ed8' },
  vatTuPhuKien: { bg: '#ede9fe', fg: '#6d28d9' },
  baoBiDongGoi: { bg: '#d1fae5', fg: '#065f46' },
}

function buildDetailRows(mt: MaterialType): DetailRow[] {
  return [
    ...(Array.isArray(mt.daySon) ? mt.daySon : []).map((it, i): DetailRow => ({
      id: `daySon-${it.id ?? i}`, group: 'daySon', name: it.name, specs: it.specifications ?? null,
      qty: it.kg != null ? String(it.kg) : null, unit: it.unit ?? null,
    })),
    ...(Array.isArray(mt.vatTuPhuKien) ? mt.vatTuPhuKien : []).map((it, i): DetailRow => ({
      id: `vatTuPhuKien-${it.id ?? i}`, group: 'vatTuPhuKien', name: it.name, specs: it.specifications ?? null,
      qty: it.quantity != null ? String(it.quantity) : null, unit: it.unit ?? null,
    })),
    ...(Array.isArray(mt.baoBiDongGoi) ? mt.baoBiDongGoi : []).map((it, i): DetailRow => ({
      id: `baoBiDongGoi-${it.id ?? i}`, group: 'baoBiDongGoi', name: it.name, specs: it.specifications ?? null,
      qty: it.quantity != null ? String(it.quantity) : null, unit: it.unit ?? null,
    })),
  ]
}

function DetailLinesTable({ rows }: { rows: DetailRow[] }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={{ width: 36, padding: '7px', textAlign: 'center', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>#</th>
            <th style={{ width: 90, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Nhóm</th>
            <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Vật tư</th>
            <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Quy cách</th>
            <th style={{ width: 100, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Số lượng</th>
            <th style={{ width: 70, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>ĐVT</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text3)', textAlign: 'center', fontStyle: 'italic' }}>Đang chờ NV Định mức chi tiết nhập</td>
            </tr>
          ) : rows.map((r, i) => {
            const badge = DETAIL_GROUP_BADGE[r.group]
            return (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '9px 7px' }}>{i + 1}</td>
                <td style={{ padding: '9px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: badge.fg, background: badge.bg, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                    {DETAIL_GROUP_LABELS[r.group]}
                  </span>
                </td>
                <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500 }}>{r.name}</td>
                <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{r.specs || '—'}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)' }}>{r.qty ?? '—'}</td>
                <td style={{ padding: '9px 14px', color: 'var(--text3)' }}>{r.unit || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── ManhPiecesSection ────────────────────────────────────────────────────────
// Bản "mảnh -> vật tư con" của MaterialSection ngay bên trên — cùng khung header/màu/nút
// duyệt-từ chối (1 quyết định DUY NHẤT cho cả mảnh), chỉ khác phần thân: mỗi mảnh 1 card chứa
// bảng vật tư con thuộc 5 nhóm (Sắt/Dây/Đinh/Tán rút/Nút nhựa) — không phải bảng phẳng. Nút
// duyệt/từ chối luôn xét trên TOÀN BỘ children (mọi nhóm), `filterGroup` chỉ lọc HIỂN THỊ.

const CHILD_GROUP_LABELS: Record<ManhChildGroup, string> = {
  sat: 'Sắt', day: 'Dây', dinh: 'Đinh', tanRut: 'Tán rút', nutNhua: 'Nút nhựa', vatTuTP: 'Vật tư thành phẩm',
}
const CHILD_GROUP_BADGE: Record<ManhChildGroup, { bg: string; fg: string }> = {
  sat: { bg: '#e3f2fd', fg: '#1565c0' },
  day: { bg: '#fff3e0', fg: '#e65100' },
  dinh: { bg: '#f3e5f5', fg: '#7b1fa2' },
  tanRut: { bg: '#e8f5e9', fg: '#2e7d32' },
  nutNhua: { bg: '#fce4ec', fg: '#ad1457' },
  vatTuTP: { bg: '#ede7f6', fg: '#4527a0' },
}

// "Mảnh có đan" = có đủ cả 3 nhóm Dây + Đinh + Nút nhựa (Tán rút không tính) - đúng quy tắc
// BE dùng để set Piece.isWoven (xem SkusService.syncIsWoven). Tính trên TOÀN BỘ r.children
// (không phải `children` đã lọc theo filterGroup) - lọc theo nhóm chỉ ảnh hưởng hiển thị bảng
// bên dưới, không được đổi câu trả lời "mảnh này có đan không".
const WOVEN_GROUPS: ManhChildGroup[] = ['day', 'dinh', 'nutNhua']
const wovenStatus = (r: ManhRow): { isWoven: boolean; missing: ManhChildGroup[] } => {
  const present = new Set(r.children.map(c => c.group))
  const missing = WOVEN_GROUPS.filter(g => !present.has(g))
  return { isWoven: missing.length === 0, missing }
}

function ManhPiecesSection({
  rows, entry, readOnly = false, hideStatusBadge = false, onApprove, onReject, filterGroup,
}: {
  rows: ManhRow[]
  entry: { status: 'APPROVED' | 'REJECTED'; at: Date; reason?: string } | null
  readOnly?: boolean
  hideStatusBadge?: boolean
  onApprove: () => void
  onReject: () => void
  filterGroup?: ManhChildGroup
}) {
  const status = entry?.status ?? null
  const totalChildren = rows.reduce((s, r) => s + r.children.length, 0)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: '#fef3c7', padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#b45309', fontWeight: 700, fontSize: 12 }}>
            Định mức mảnh <span style={{ fontWeight: 400, opacity: 0.7 }}>({rows.length} mảnh · {totalChildren} dòng vật tư)</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {status && !hideStatusBadge && <StatusBadge status={status} />}
            {/* Chưa có vật tư con nào thì vẫn hiện nút nhưng disable — báo rõ đang chặn vì thiếu
                dữ liệu, thay vì âm thầm coi mục này là "đã xong". Xét trên TOÀN BỘ children (mọi
                nhóm), không phụ thuộc filterGroup đang lọc hiển thị gì. */}
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
          {rows.map(r => {
            const children = filterGroup ? r.children.filter(c => c.group === filterGroup) : r.children
            return (
            <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
                background: 'var(--surface2)', borderBottom: children.length > 0 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{r.name}</span>
                {r.qtyPerSku && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#e65100', background: '#fff3e0', borderRadius: 4, padding: '2px 7px' }}>×{r.qtyPerSku} / SKU</span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{children.length} dòng vật tư</span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {r.needsHan && <span style={{ fontSize: 11, fontWeight: 600, color: '#ef6c00', background: '#fff3e0', borderRadius: 4, padding: '2px 7px' }}>Hàn</span>}
                  {r.needsSon && <span style={{ fontSize: 11, fontWeight: 600, color: '#00695c', background: '#e0f2f1', borderRadius: 4, padding: '2px 7px' }}>Sơn</span>}
                  {(() => {
                    const { isWoven, missing } = wovenStatus(r)
                    return isWoven ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#2e7d32' }}>✓ Có đan</span>
                    ) : (
                      <span
                        title={missing.length < WOVEN_GROUPS.length ? `Thiếu ${missing.map(g => CHILD_GROUP_LABELS[g]).join(', ')}` : undefined}
                        style={{ fontSize: 12, color: 'var(--text3)' }}
                      >
                        Không đan
                      </span>
                    )
                  })()}
                </div>
              </div>
              {children.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={{ width: 36, padding: '7px', textAlign: 'center', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>#</th>
                      <th style={{ width: 80, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Nhóm</th>
                      <th style={{ width: '22%', padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Vật tư</th>
                      <th style={{ width: '14%', padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Quy cách</th>
                      <th style={{ width: 90, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Chiều dài / Số chân/cây</th>
                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Công đoạn phôi</th>
                      <th style={{ width: 90, padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>Số lượng</th>
                      <th style={{ width: 60, padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>ĐVT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((c, i) => {
                      const badge = CHILD_GROUP_BADGE[c.group]
                      return (
                      <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '9px 7px' }}>{i + 1}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: badge.fg, background: badge.bg, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                            {CHILD_GROUP_LABELS[c.group]}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500 }}>
                          {c.name}
                          {c.note && <span style={{ color: 'var(--text3)', fontWeight: 400 }}> ({c.note})</span>}
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--text3)', fontSize: 12 }}>{c.specs || '—'}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text3)' }}>
                          {c.group === 'sat' ? (c.length || '—') : c.group === 'vatTuTP' ? (c.piecesPerBar || '—') : '—'}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          {c.group === 'sat' && c.processSteps && c.processSteps.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {c.processSteps.map(s => (
                                <span
                                  key={s}
                                  style={{
                                    fontSize: 11, fontWeight: 500, color: 'var(--text2)', background: 'var(--surface2)',
                                    border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap',
                                  }}
                                >
                                  {PROCESS_STEP_LABELS[s]}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)' }}>{c.qty || '—'}</td>
                        <td style={{ padding: '9px 14px', color: 'var(--text3)', fontSize: 12 }}>{c.unit || '—'}</td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const btnSecondary: React.CSSProperties = { padding: '9px 20px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }
