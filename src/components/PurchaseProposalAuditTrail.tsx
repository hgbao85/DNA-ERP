'use client'
import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { format } from 'date-fns'
import { ApiError } from '../services/core/apiError'
import { getPurchaseProposalAuditTrail, type BeAuditLogEntry } from '../services/audit-log-api'
import { getUsers } from '../services/api'

// Vết duyệt THẬT từ server (audit_logs) cho đúng 1 PurchaseProposal - khác AuditLogTimeline
// (component cũ, dùng chung cho SKU/User/KCS...) vốn đọc mockStore trong trình duyệt và mất khi
// F5. Dựng riêng thay vì nhét vào AuditLogTimeline vì shape 2 nguồn khác hẳn nhau: BE chỉ trả
// userId (không kèm tên) + action CRUD chung (UPDATE/DELETE) thay vì nhãn nghiệp vụ có sẵn như
// 'proposal.approved' (D.c1-no-audit-on-money-path, xem mục 9.4/11 changelog).

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Chờ báo giá', QUOTING: 'Đang báo giá', SUBMITTED: 'Chờ Sếp duyệt',
  PURCHASING: 'Đang mua hàng', PURCHASED: 'Đã mua', REJECTED: 'Sếp từ chối',
}

interface ChosenLine { materialCode?: string; supplierName?: string; unitPrice?: number | null }
interface DeletedQuote { materialCode?: string; supplierName?: string; unitPrice?: number | null }

function describe(entry: BeAuditLogEntry): { label: string; detail?: string } {
  if (entry.tableName === 'PurchaseProposal') {
    if (entry.action === 'CREATE') return { label: 'Tạo đề xuất mua hàng' }
    const oldStatus = (entry.oldValue as { status?: string } | null)?.status
    const newStatus = (entry.newValue as { status?: string } | null)?.status
    if (oldStatus && newStatus && oldStatus !== newStatus) {
      return { label: `${STATUS_LABEL[oldStatus] ?? oldStatus} → ${STATUS_LABEL[newStatus] ?? newStatus}` }
    }
    return { label: 'Cập nhật đề xuất mua hàng' }
  }
  // tableName === 'PurchaseProposalQuote' - ghi tay ở approve()/requote(), xem service BE.
  const asEvent = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null)
  const newV = asEvent(entry.newValue)
  const oldV = asEvent(entry.oldValue)
  if (newV?.event === 'approve') {
    const chosen = (newV.chosen as ChosenLine[] | undefined) ?? []
    const detail = chosen
      .map(c => `${c.materialCode ?? '?'}: ${c.supplierName ?? '—'}${c.unitPrice ? ` (${c.unitPrice.toLocaleString('vi-VN')}đ)` : ''}`)
      .join('; ')
    return { label: 'Duyệt đề xuất mua — chọn NCC/giá', detail: detail || undefined }
  }
  if (oldV?.event === 'requote') {
    const deleted = (oldV.deletedQuotes as DeletedQuote[] | undefined) ?? []
    return {
      label: `Mở lại báo giá — xoá ${deleted.length} báo giá cũ`,
      detail: typeof oldV.rejectionReason === 'string' ? `Lý do từ chối trước đó: "${oldV.rejectionReason}"` : undefined,
    }
  }
  return { label: 'Cập nhật báo giá' }
}

// Chấp cả 1 id lẻ (LenhMuaNCCPage - 1 đề xuất/kho) và nhiều id (BossApp - 1 nhóm PO có thể gồm
// nhiều đề xuất, mỗi kho phụ trách một đề xuất riêng, xem D.p6-quote-key-collision cùng file).
export default function PurchaseProposalAuditTrail({ proposalId, bare = false }: { proposalId: string | string[]; bare?: boolean }) {
  const ids = Array.isArray(proposalId) ? proposalId : [proposalId]
  const idsKey = ids.join(',')

  const [entries, setEntries] = useState<BeAuditLogEntry[]>([])
  const [nameByUserId, setNameByUserId] = useState<Map<string, string>>(new Map())
  // 403 = vai đang xem không có AUDIT_LOG:VIEW - chỉ BOSS/ADMIN có (role-permissions.constant.ts),
  // Mua hàng/Thủ kho thì KHÔNG. Phải tách riêng khỏi "chưa có hoạt động nào": phát hiện qua browser
  // thật 2026-08-15 - dùng useFetch (chỉ giữ error dạng string, mất statusCode) khiến 403 và rỗng
  // hiện giống hệt nhau, Mua hàng thấy "Chưa có hoạt động nào" dù Boss xem CÙNG proposal thấy đầy
  // đủ lịch sử (D.c1-audit-trail-403-looks-empty).
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Tính lại `ids` từ idsKey (dep ổn định) thay vì đóng lấy biến `ids` ngoài effect - mảng đó
    // là literal mới mỗi lần render nên đưa thẳng vào deps sẽ chạy lại vô hạn.
    const currentIds = idsKey.split(',')
    Promise.all(currentIds.map(getPurchaseProposalAuditTrail))
      .then(results => {
        if (cancelled) return
        setEntries(results.flat().sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
        setForbidden(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setEntries([])
        if (err instanceof ApiError && err.statusCode === 403) {
          setForbidden(true)
        } else {
          setForbidden(false)
          console.error('getPurchaseProposalAuditTrail failed', err)
        }
      })
    // getUsers() chỉ để hiện TÊN thay userId - lỗi ở đây (kể cả 403) không nghiêm trọng bằng lỗi
    // ở trên nên không cần cờ riêng, rơi về Map rỗng thì vẫn hiện "Người dùng đã xoá" hợp lý.
    getUsers()
      .then(users => { if (!cancelled) setNameByUserId(new Map(users.map(u => [String(u.id), u.name]))) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [idsKey])

  const list = entries.map(e => ({
    ...describe(e),
    id: e.id,
    at: e.createdAt,
    actorName: e.userId ? (nameByUserId.get(e.userId) ?? 'Người dùng đã xoá') : 'Hệ thống',
  }))

  const body = forbidden
    ? <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Bạn không có quyền xem lịch sử hoạt động - chỉ Giám đốc/Admin xem được mục này</div>
    : list.length === 0
    ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có hoạt động nào</div>
    : (
      <>
        {list.map((e, idx) => (
          <div key={e.id} style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text3)', marginTop: 5 }} />
              {idx !== list.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 18, background: 'var(--border)', marginTop: 2 }} />}
            </div>
            <div style={{ paddingBottom: idx === list.length - 1 ? 0 : 16, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>
                <strong>{e.actorName}</strong> <span style={{ color: 'var(--text2)' }}>{e.label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace' }}>
                {format(new Date(e.at), 'HH:mm dd/MM/yyyy')}
              </div>
              {e.detail && (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>{e.detail}</div>
              )}
            </div>
          </div>
        ))}
      </>
    )

  if (bare) return body

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <History size={13} color="var(--text3)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Hoạt động</span>
      </div>
      <div style={{ padding: 14 }}>{body}</div>
    </div>
  )
}
