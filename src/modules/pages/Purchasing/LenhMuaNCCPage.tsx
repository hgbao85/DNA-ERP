import { useEffect, useState } from 'react'
import { ChevronLeft, ClipboardList, FileCheck2, Paperclip, X } from 'lucide-react'
import { useInspection, PROPOSAL_STATUS_LABELS, type PurchaseProposal, type PurchaseProposalItem } from '../../../context/InspectionContext'
import { useAuth, type User } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import { getMaterials, uploadDocument } from '../../../services/api'
import { visibleProposalsFor, buildBuyerByMaterialId, splitItemsByOwner, rollupStatusOf, type MaterialBuyerMap } from '../../../utils/purchasingRouting'
import PurchaseProposalAuditTrail from '../../../components/PurchaseProposalAuditTrail'

/** Tên vật tư kèm chiều dài cây phải đặt (CHỈ vật tư sắt có, xem
 *  PurchaseProposalItem.stockLengthMm) - buyQty vô nghĩa nếu Purchasing không biết đặt cây dài
 *  bao nhiêu, nhất là từ khi solver có thể đề xuất cây KHÁC 6000mm mặc định (2026-08-26, Sếp mở
 *  lại auto_scan). Dùng chung cho mọi chỗ hiện tên vật tư trong màn này. */
function ItemName({ item }: { item: PurchaseProposalItem }) {
  return (
    <>
      {item.name}
      {item.stockLengthMm != null && (
        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#e65100' }}>
          · cây {item.stockLengthMm}mm
        </span>
      )}
    </>
  )
}

export default function LenhMuaNCCPage() {
  const { user } = useAuth()
  const { proposals: allProposals, bossApproveProposal } = useInspection()
  const { data: materials, isLoading: materialsLoading } = useFetch(getMaterials)
  const buyerByMaterialId = buildBuyerByMaterialId(materials ?? [])
  // Purchasing chỉ thấy đề xuất chứa vật tư mình được gán mua (Material.buyerId) — xem purchasingRouting.ts
  // Status 'purchasing' (đang mua hàng, chờ nhận) đã chuyển sang màn "Theo dõi mua hàng", còn 'purchased'
  // (đã nhận đủ hàng) đã chuyển sang màn "Lịch sử đã mua" — cả 2 không còn hiển thị ở đây.
  // materials chưa tải xong -> buyerByMaterialId RỖNG -> mọi đề xuất trông như "chưa gán ai" ->
  // hiện NHẦM cho mọi nhân viên mua hàng rồi biến mất khi tải xong (D.p7-buyer-filter-loading-
  // flash, 2026-08-22). Chặn ở đây - rỗng lúc đang tải thay vì lộ nhầm đề xuất của người khác.
  //
  // Lọc theo ITEM của mình (2026-08-25) - trước đây lọc theo `p.status` (rollup) khiến 1 đề xuất
  // gộp biến mất khỏi màn này ngay khi rollup lên 'purchasing'/'purchased', dù phần vật tư của
  // MÌNH trong đó vẫn còn chờ xử lý.
  const proposals = materialsLoading
    ? []
    : visibleProposalsFor(user, allProposals, buyerByMaterialId).filter(p => {
        const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
        return mine.some(isPending)
      })

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Lệnh mua vật tư</h2>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Dựa vào số lượng cần mua dưới đây để làm phiếu so sánh giá, xin Sếp ký duyệt, rồi tải file đã ký lên để Kho được phép nhận hàng.
      </div>

      {proposals.length > 0 ? (
        <ProposalSection
          user={user}
          buyerByMaterialId={buyerByMaterialId}
          proposals={proposals}
          onBossApprove={bossApproveProposal}
        />
      ) : (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
          Không có lệnh mua nào cần xử lý
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 12px' }

/**
 * Dòng CHƯA được duyệt mua - tập mà nút "Sếp đã duyệt" tác động tới.
 *
 * Cố ý tính bằng cách LOẠI TRỪ 'purchasing'/'purchased' thay vì liệt kê 'new': từ 2026-08-27 luồng
 * chỉ còn NEW -> PURCHASING -> PURCHASED, nhưng dữ liệu cũ còn dòng kẹt ở 'quoting'/'submitted'/
 * 'rejected' của luồng báo giá đã gỡ - chúng phải hiện ra và duyệt được ở đây, nếu không sẽ treo
 * vĩnh viễn (BE bossApprove() nhận đúng 4 trạng thái này, xem PENDING_APPROVAL_STATUSES).
 */
const isPending = (item: PurchaseProposalItem) =>
  item.status !== 'purchasing' && item.status !== 'purchased'

const ACCEPT_ATTR = 'image/*,application/pdf,.pdf,.xls,.xlsx'
const MAX_FILE_BYTES = 10 * 1024 * 1024

/**
 * Popup "Sếp đã duyệt" - chọn file phiếu Sếp đã ký tay rồi xác nhận (2026-08-27).
 *
 * Upload HOÃN tới lúc bấm Xác nhận (không upload ngay lúc chọn file) - cùng idiom
 * AdminEntityPage.tsx: người dùng chọn nhầm file rồi đóng popup là chuyện thường, upload ngay sẽ
 * để lại file rác vĩnh viễn trên Cloudinary vì không có đường xoá.
 */
function BossApproveModal({ itemCount, onClose, onConfirm }: {
  itemCount: number
  onClose: () => void
  onConfirm: (file: File) => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Chỉ ảnh mới xem trước được; PDF/Excel hiện tên file. Tính URL đồng bộ theo `file` (không qua
  // state riêng - tránh setState trong effect) - effect chỉ lo THU HỒI object URL khi đổi/đóng để
  // không giữ blob trong bộ nhớ tab.
  const previewUrl = file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  const pick = (f: File | undefined) => {
    setErr('')
    if (!f) return
    if (f.size > MAX_FILE_BYTES) {
      setErr(`File ${(f.size / 1024 / 1024).toFixed(1)}MB - vượt giới hạn 10MB`)
      return
    }
    setFile(f)
  }

  const confirm = async () => {
    if (!file || busy) return
    setBusy(true)
    setErr('')
    try {
      await onConfirm(file)
      onClose()
    } catch (e) {
      // Giữ popup mở kèm lỗi tại chỗ - đóng popup ở đây sẽ khiến người dùng mất file vừa chọn và
      // chỉ còn banner chung chung ở đầu trang, không rõ thao tác nào hỏng.
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <FileCheck2 size={17} color="#2563eb" />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Sếp đã duyệt</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ display: 'flex', padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
            Tải lên phiếu so sánh giá <strong>đã có chữ ký của Sếp</strong> để xác nhận {itemCount} vật tư dưới đây được duyệt mua.
            Sau bước này Kho mới nhận hàng được.
          </div>

          <label
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 16px', border: '1.5px dashed var(--border)', borderRadius: 10, cursor: busy ? 'default' : 'pointer', background: 'var(--surface2)' }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 6 }} />
            ) : (
              <Paperclip size={22} color="var(--text3)" />
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: file ? 'var(--text)' : 'var(--text3)', wordBreak: 'break-all', textAlign: 'center' }}>
              {file ? file.name : 'Chọn file từ máy tính'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Ảnh, PDF hoặc Excel · tối đa 10MB</span>
            <input
              type="file"
              accept={ACCEPT_ATTR}
              hidden
              disabled={busy}
              onChange={e => {
                pick(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>

          {err && (
            <div style={{ marginTop: 12, padding: '8px 10px', fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8 }}>
              {err}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: busy ? 'default' : 'pointer' }}
          >
            Huỷ
          </button>
          <button
            onClick={() => void confirm()}
            disabled={!file || busy}
            style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: !file || busy ? '#93c5fd' : '#2563eb', color: '#fff', cursor: !file || busy ? 'default' : 'pointer' }}
          >
            {busy ? 'Đang tải lên…' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProposalSection({ user, buyerByMaterialId, proposals, onBossApprove }: {
  user: User | null
  buyerByMaterialId: MaterialBuyerMap
  proposals: PurchaseProposal[]
  onBossApprove: (id: string, approvalFileUrl: string) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Đếm theo ITEM của mình (2026-08-25) - p.status (rollup) không còn phản ánh đúng "còn việc gì
  // của TÔI chưa làm" khi đề xuất gộp nhiều người mua.
  const pendingCount = proposals.filter(p => {
    const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
    return mine.some(isPending)
  }).length
  const selected = proposals.find(p => p.id === selectedId) ?? null

  // Rollup CỦA RIÊNG PHẦN MÌNH trong 1 đề xuất (2026-08-25) - KHÔNG dùng thẳng `p.status` (rollup
  // của CẢ đề xuất, gồm cả phần đồng nghiệp khác): 1 đề xuất gộp nhiều người mua có thể rollup
  // 'purchasing' vì đồng nghiệp đã duyệt xong, trong khi phần CỦA TÔI còn chưa duyệt - hiện nhầm
  // trạng thái ở đây khiến người dùng tưởng đã xong (báo cáo thật từ Trâm, 2026-08-25).
  const myRollupStatus = (p: PurchaseProposal): PurchaseProposal['status'] => {
    const { mine } = splitItemsByOwner(user, p.items, buyerByMaterialId)
    return mine.length > 0 ? rollupStatusOf(mine) : p.status
  }

  const itemStatusTag = (status: PurchaseProposal['status']) => {
    const cfg = PROPOSAL_STATUS_LABELS[status]
    return <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: '2px 8px' }}>{cfg.label}</span>
  }

  const statusTag = (p: PurchaseProposal) => itemStatusTag(myRollupStatus(p))

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const p = selected
    const { mine, others } = splitItemsByOwner(user, p.items, buyerByMaterialId)
    const pendingItems = mine.filter(isPending)
    const doneItems = mine.filter(item => !isPending(item))

    return (
      <div style={{ marginBottom: 24, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Back bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => setSelectedId(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text2)' }}
          >
            <ChevronLeft size={14} /> Danh sách
          </button>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{p.salesOrderCode ?? '—'}</span>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{p.skuCode}{p.skuName ? ` — ${p.skuName}` : ''}</span>
          <div style={{ flex: 1 }} />
          {statusTag(p)}
          {p.deadline && (
            <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
              Deadline: {new Date(p.deadline).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
          {others.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--surface2)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                {others.length} vật tư khác trong đề xuất này do đồng nghiệp phụ trách mua:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {others.map((item, idx) => (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>
                    {item.name} {itemStatusTag(item.status)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Chờ Sếp duyệt (của mình) ── */}
          {pendingItems.length > 0 && (<div style={{ borderTop: others.length > 0 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                    <th style={th}>Kho</th>
                    <th style={th}>Vật tư</th>
                    <th style={{ ...th, textAlign: 'right' }}>Tồn thực</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cần mua</th>
                    <th style={th}>ĐVT</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{item.khoLabel}</td>
                      <td style={{ ...td, fontWeight: 600 }}><ItemName item={item} /></td>
                      <td style={{ ...td, textAlign: 'right', color: '#dc2626' }}>{item.actualStock}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#d97706' }}>{item.buyQty}</td>
                      <td style={{ ...td, color: 'var(--text3)' }}>{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 14px', borderTop: '1px solid #fde68a', background: '#fffbeb' }}>
              <button
                onClick={() => setApprovingId(p.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer' }}
              >
                <FileCheck2 size={14} /> Sếp đã duyệt
              </button>
            </div>
          </div>)}

          {/* ── Đã duyệt mua (của mình) ── */}
          {doneItems.length > 0 && (<div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {doneItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}><ItemName item={item} /></span>
                {itemStatusTag(item.status)}
                {item.approvalFileUrl && (
                  <a
                    href={item.approvalFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563eb', fontWeight: 600 }}
                  >
                    <Paperclip size={12} /> Xem file Sếp duyệt
                  </a>
                )}
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>theo dõi ở &quot;Theo dõi mua hàng&quot;/&quot;Lịch sử đã mua&quot;</span>
              </div>
            ))}
          </div>)}
        </div>
      </div>

      <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 20 }}>
        <PurchaseProposalAuditTrail proposalId={p.id} />
      </div>

      {approvingId === p.id && (
        <BossApproveModal
          itemCount={pendingItems.length}
          onClose={() => setApprovingId(null)}
          onConfirm={async file => {
            const url = await uploadDocument(file)
            await onBossApprove(p.id, url)
            setSelectedId(null)
          }}
        />
      )}
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <ClipboardList size={16} color="#d97706" />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>Đề xuất mua từ Quản lý SX</span>
        {pendingCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
            {pendingCount} chờ xử lý
          </span>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>PO</th>
              <th style={th}>PI</th>
              <th style={th}>Mã nhà máy</th>
              <th style={th}>Kho phụ trách</th>
              <th style={th}>Deadline</th>
              <th style={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map(p => {
              const khos = [...new Set(p.items.map(i => i.khoLabel))].join(', ')
              return (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{p.salesOrderCode ?? '—'}</td>
                  <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text3)' }}>{p.piCode}</td>
                  <td style={td}>
                    <span style={{ fontWeight: 600 }}>{p.skuCode}</span>
                    {p.skuName && <span style={{ marginLeft: 6, color: 'var(--text3)', fontSize: 12 }}>{p.skuName}</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{khos}</td>
                  <td style={{ ...td, color: p.deadline ? '#dc2626' : 'var(--text3)', fontSize: 12, fontWeight: p.deadline ? 600 : 400 }}>
                    {p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={td}>{statusTag(p)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
