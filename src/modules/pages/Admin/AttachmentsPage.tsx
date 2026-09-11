'use client'

/**
 * Quản lý tệp đính kèm (2026-09-11) - xem docs/changelog-2026-09-11-audit-upload-file.md.
 *
 * 3 nơi trong hệ thống lưu ảnh/file bằng chứng theo kiểu CHỈ TẠO, không sửa/xóa được (audit-trail
 * cố ý bất biến - xem doc comment BE QcReview.failedQty/PurchaseProposalItem.approvalFileUrl):
 * ảnh lỗi KCS (QcReview.photoUrl), ảnh lỗi kiểm chuyển kho (TransferCheckDefect.imageUrl), phiếu
 * Sếp đã ký duyệt mua hàng (PurchaseProposalItem.approvalFileUrl). Người dùng xác nhận muốn có 1
 * cửa "sửa sai" khi lỡ chọn nhầm file - CHỈ mở cho ADMIN (route BE chặn @RequireRole(ADMIN), trang
 * này cũng chỉ nằm trong AdminApp nên không cần check role lại ở FE), và mọi lần sửa/xóa đều tự
 * động ghi vào audit log THẬT phía server (bảng AuditLog, tra qua GET /audit-logs) - xem BE
 * (QcReview đã trong AUDITED_MODELS tự ghi qua Prisma extension; 2 chỗ còn lại ghi tay qua
 * writeAuditLog()). ĐÃ XÁC NHẬN sống 2026-09-11 (xóa 1 ảnh QcReview qua trang này, query lại
 * GET /audit-logs?tableName=QcReview thấy đúng dòng UPDATE với oldValue/newValue.photoUrl khớp).
 * LƯU Ý: trang "Nhật ký hoạt động" (AuditLogPage.tsx) hiện vẫn đọc mockStore trong trình duyệt,
 * CHƯA cutover sang bảng AuditLog thật (khác PurchaseProposalAuditTrail - component riêng, đã đọc
 * đúng /audit-logs) - nên log ghi ở đây KHÔNG hiện trong "Nhật ký hoạt động" cho tới khi trang đó
 * được cutover (ngoài phạm vi việc này, không sửa ở đây).
 *
 * KHÔNG đặt trong BusinessDataPage.tsx - trang đó ghi rõ "chỉ xem, không duyệt/thao tác tại đây",
 * trái mục đích tính năng này (có thao tác sửa/xóa thật).
 *
 * approvalFileUrl (tab 3) — sửa lại lần 2 cùng ngày, theo yêu cầu người dùng: ban đầu chỉ cho THAY
 * (đọc doc comment schema "bằng chứng duy nhất" thì tưởng xóa là vô nghĩa nghiệp vụ), nhưng rà lại
 * `PurchaseProposalsService.receiveItem()` (BE) xác nhận nó KHÔNG hề đọc `approvalFileUrl` - chỉ
 * dựa vào `item.status` - nên field này thuần là bằng chứng lịch sử, xóa không phá luồng nhận hàng
 * nào. Nay cho XÓA HẲN luôn (giống 2 tab kia), có confirm dialog riêng nhắc rõ đây là bằng chứng
 * duyệt mua để tránh bấm nhầm.
 */
import { useMemo, useState } from 'react'
import { Image as ImageIcon, Truck, FileCheck2, Trash2, Upload, ExternalLink } from 'lucide-react'
import { tabBtn } from '../../../styles/buttons'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import { useInspection } from '../../../context/InspectionContext'
import * as api from '../../../services/api'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'

const ACCENT = '#3949ab'
const RED = '#c62828'

type Tab = 'kcs-photos' | 'transfer-check-photos' | 'approval-files'

// Đặt tên tab theo CHỨC VỤ/bộ phận thao tác (2026-09-11, theo góp ý người dùng) thay vì mô tả loại
// file - ngắn gọn hơn, khớp cách người dùng nghĩ ("của KCS", "của Mua hàng") hơn là nghĩ theo loại
// dữ liệu kỹ thuật (QcReview/TransferCheckDefect/PurchaseProposalItem).
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'kcs-photos', label: 'KCS', icon: <ImageIcon size={14} /> },
  { id: 'transfer-check-photos', label: 'Kho', icon: <Truck size={14} /> },
  { id: 'approval-files', label: 'Mua hàng', icon: <FileCheck2 size={14} /> },
]

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }
const btnDanger: React.CSSProperties = { ...btnGhost, color: RED, borderColor: 'rgba(198,40,40,0.35)' }

/** Hàng chung cho 3 tab: thumbnail/link + thông tin + nút hành động. `onReplace` nhận File đã
 *  chọn (upload thật do caller tự lo, khác nhau giữa ảnh/document). */
function AttachmentRow({ thumbnailUrl, fileUrl, title, meta, busy, onReplace, onDelete, replaceLabel, deleteLabel, accept }: {
  thumbnailUrl?: string | null; fileUrl: string
  title: string; meta: string[]
  busy: boolean
  onReplace: (file: File) => void
  onDelete?: () => void
  replaceLabel: string
  deleteLabel?: string
  accept: string
}) {
  return (
    <div style={card}>
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }} />
      ) : (
        <a href={fileUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: ACCENT, flexShrink: 0 }}>
          <ExternalLink size={20} />
        </a>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{meta.join(' · ')}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <label style={{ ...btnGhost, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          <Upload size={12} /> {busy ? 'Đang xử lý…' : replaceLabel}
          <input type="file" accept={accept} hidden disabled={busy}
            onChange={e => { const f = e.target.files?.[0]; if (f) onReplace(f); e.target.value = '' }} />
        </label>
        {onDelete && (
          <button onClick={onDelete} disabled={busy} style={{ ...btnDanger, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            <Trash2 size={12} /> {deleteLabel ?? 'Xóa ảnh'}
          </button>
        )}
      </div>
    </div>
  )
}

function KcsPhotosTab() {
  const { data: reviews, isLoading, error, refetch } = useFetch(() => api.getAllQcReviews(), [])
  const { ask, confirmModal } = useConfirm()
  const [busyId, setBusyId] = useState<string | null>(null)

  const withPhoto = useMemo(() => (reviews ?? []).filter(r => r.photoUrl), [reviews])

  const replace = async (id: string, file: File) => {
    setBusyId(id)
    try {
      const url = await api.uploadImage(file)
      await api.updateQcReviewPhoto(id, url)
      await refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Không đổi được ảnh')
    } finally {
      setBusyId(null)
    }
  }
  const remove = (id: string) => {
    ask({ message: 'Xóa hẳn ảnh lỗi KCS này? Không thể hoàn tác.', danger: true, confirmLabel: 'Xóa ảnh' }, async () => {
      setBusyId(id)
      try {
        await api.updateQcReviewPhoto(id, null)
        await refetch()
      } finally {
        setBusyId(null)
      }
    })
  }

  const sourceOf = (r: { id: string; steelIssueId: string | null; productionBatchId: string | null; cutBundleId: string | null; stepBundleId: string | null; pieceStepBundleId: string | null }) => {
    if (r.cutBundleId) return `Đợt cắt #${r.cutBundleId}`
    if (r.stepBundleId) return `Đợt công đoạn phụ #${r.stepBundleId}`
    if (r.pieceStepBundleId) return `Đợt VTTP #${r.pieceStepBundleId}`
    if (r.productionBatchId) return `Lô SX #${r.productionBatchId}`
    if (r.steelIssueId) return `Lô nhận sắt #${r.steelIssueId}`
    return `Review #${r.id}`
  }

  if (isLoading) return <LoadingState />
  if (error || !reviews) return <LoadErrorState error={error ?? 'Không tải được dữ liệu'} onRetry={refetch} />

  return (
    <div>
      {confirmModal}
      {withPhoto.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chưa có ảnh lỗi KCS nào</div>}
      {withPhoto.map(r => (
        <AttachmentRow key={r.id}
          thumbnailUrl={r.photoUrl} fileUrl={r.photoUrl!}
          title={sourceOf(r)}
          meta={[`Lỗi ${r.failedQty}`, r.defectReasonLabel ?? 'Không rõ nguyên nhân', new Date(r.reviewedAt).toLocaleString('vi-VN')]}
          busy={busyId === r.id}
          onReplace={f => replace(r.id, f)}
          onDelete={() => remove(r.id)}
          replaceLabel="Đổi ảnh"
          accept="image/*"
        />
      ))}
    </div>
  )
}

function TransferCheckPhotosTab() {
  const { data: defects, isLoading, error, refetch } = useFetch(() => api.getTransferCheckDefects(), [])
  const { ask, confirmModal } = useConfirm()
  const [busyId, setBusyId] = useState<string | null>(null)

  const replace = async (id: string, file: File) => {
    setBusyId(id)
    try {
      const url = await api.uploadImage(file)
      await api.updateTransferCheckDefectPhoto(id, url)
      await refetch()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Không đổi được ảnh')
    } finally {
      setBusyId(null)
    }
  }
  const remove = (id: string) => {
    ask({ message: 'Xóa hẳn ảnh lỗi kiểm chuyển kho này? Không thể hoàn tác.', danger: true, confirmLabel: 'Xóa ảnh' }, async () => {
      setBusyId(id)
      try {
        await api.updateTransferCheckDefectPhoto(id, null)
        await refetch()
      } finally {
        setBusyId(null)
      }
    })
  }

  if (isLoading) return <LoadingState />
  if (error || !defects) return <LoadErrorState error={error ?? 'Không tải được dữ liệu'} onRetry={refetch} />

  return (
    <div>
      {confirmModal}
      {defects.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chưa có ảnh lỗi kiểm chuyển kho nào</div>}
      {defects.map(d => (
        <AttachmentRow key={d.id}
          thumbnailUrl={d.imageUrl} fileUrl={d.imageUrl!}
          title={d.reason}
          meta={[`PI item #${d.productionInvoiceItemId}`, `Mảnh #${d.pieceId}`, new Date(d.checkedAt).toLocaleString('vi-VN')]}
          busy={busyId === d.id}
          onReplace={f => replace(d.id, f)}
          onDelete={() => remove(d.id)}
          replaceLabel="Đổi ảnh"
          accept="image/*"
        />
      ))}
    </div>
  )
}

function ApprovalFilesTab() {
  const { proposals, updateApprovalFile } = useInspection()
  const { ask, confirmModal } = useConfirm()
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const rows = useMemo(() => proposals.flatMap(p => p.items
    .filter(it => it.approvalFileUrl && it.itemId)
    .map(it => ({ proposalId: p.id, piCode: p.piCode, skuCode: p.skuCode, skuName: p.skuName, item: it }))),
    [proposals])

  // GỌI QUA CONTEXT (updateApprovalFile), KHÔNG gọi thẳng services/purchasing-api.ts - context tự
  // cập nhật lại `proposals` sau khi BE ghi xong (xem InspectionContext.tsx), thiếu bước đó thì BE
  // ghi đúng nhưng UI vẫn hiện dữ liệu cũ tới khi tải lại trang (bug đã gặp lúc live-test).
  const replace = async (proposalId: string, itemId: string, file: File) => {
    const key = `${proposalId}:${itemId}`
    setBusyKey(key)
    try {
      const url = await api.uploadDocument(file)
      await updateApprovalFile(proposalId, itemId, url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Không thay được file')
    } finally {
      setBusyKey(null)
    }
  }
  const remove = (proposalId: string, itemId: string) => {
    ask({
      message: 'Xóa hẳn phiếu Sếp đã ký duyệt mua hàng này? Đây là bằng chứng duyệt mua - chỉ xóa khi thật sự cần (vd Sếp yêu cầu). Không thể hoàn tác.',
      danger: true, confirmLabel: 'Xóa file',
    }, async () => {
      const key = `${proposalId}:${itemId}`
      setBusyKey(key)
      try {
        await updateApprovalFile(proposalId, itemId, null)
      } finally {
        setBusyKey(null)
      }
    })
  }

  return (
    <div>
      {confirmModal}
      {rows.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chưa có phiếu duyệt mua hàng nào</div>}
      {rows.map(({ proposalId, piCode, skuCode, skuName, item }) => (
        <AttachmentRow key={`${proposalId}:${item.itemId}`}
          fileUrl={item.approvalFileUrl!}
          title={item.name}
          meta={[piCode, skuName ? `${skuCode} — ${skuName}` : skuCode, `${item.buyQty} ${item.unit}`]}
          busy={busyKey === `${proposalId}:${item.itemId}`}
          onReplace={f => replace(proposalId, item.itemId!, f)}
          onDelete={() => remove(proposalId, item.itemId!)}
          replaceLabel="Thay file"
          deleteLabel="Xóa file"
          accept="image/*,.pdf,.xls,.xlsx"
        />
      ))}
    </div>
  )
}

export default function AttachmentsPage() {
  const [tab, setTab] = useState<Tab>('kcs-photos')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <ImageIcon size={18} color={ACCENT} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Quản lý tệp đính kèm</h2>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
        Sửa/xóa ảnh hoặc file khi lỡ chọn nhầm - mọi thao tác đều được ghi vào audit log phía server
        (tra được qua API GET /audit-logs; trang &quot;Nhật ký hoạt động&quot; hiện chưa đọc nguồn này).
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ ...tabBtn(tab === t.id, ACCENT), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'kcs-photos' && <KcsPhotosTab />}
      {tab === 'transfer-check-photos' && <TransferCheckPhotosTab />}
      {tab === 'approval-files' && <ApprovalFilesTab />}
    </div>
  )
}
