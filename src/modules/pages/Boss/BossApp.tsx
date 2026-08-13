'use client'
import { useState } from 'react'
import { LayoutDashboard, Package, LogOut, CalendarClock, Warehouse, ClipboardCheck, Check, X, ChevronLeft } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useInspection, PROPOSAL_ENTITY, type PurchaseProposal, type PurchaseProposalItem, type ProposalQuote } from '../../../context/InspectionContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import AuditLogTimeline from '../../../components/AuditLogTimeline'
import { format } from 'date-fns'
import SKUReviewPage from '../ProductionPlan/SKUReviewPage'
import SKUListPage from '../ProductionPlan/SKUListPage'
import VatTuDashboardPage from '../ProductionPlan/VatTuDashboardPage'
import ThongKePagePlan from '../Manufacturing/ThongKePagePlan'
import MfgWarehousesPage from '../Manufacturing/MfgWarehousesPage'
import LenhSXPage from '../ProductionPlan/LenhSXPage'


const ACCENT    = '#2e7d32'
const ACCENT_BG = '#e8f5e9'

type Page           = 'cho-duyet' | 'thong-ke' | 'sku-list' | 'vat-tu' | 'kho'
type ChoDuyetFilter = 'sku-moi' | 'so-sanh-gia' | 'lenh-sx'


// ── So sánh giá section ───────────────────────────────────────────────────────

// Các PurchaseProposal con của cùng 1 đơn gốc (do KHSX tạo) chia sẻ chung requestId
// (xem markProposalCreated, InspectionContext.tsx) — nhóm lại để Boss duyệt 1 lần/đơn.
function groupByRequestId(proposals: PurchaseProposal[]): PurchaseProposal[][] {
  const map = new Map<string, PurchaseProposal[]>()
  proposals.forEach(p => {
    if (!map.has(p.requestId)) map.set(p.requestId, [])
    map.get(p.requestId)!.push(p)
  })
  return [...map.values()]
}

function SoSanhGiaSection({ proposals, onApprove, onReject }: {
  proposals: PurchaseProposal[]
  onApprove: (id: string, chosen: Record<string, string>) => void
  onReject:  (id: string, reason: string) => void
}) {
  const { getLogsFor } = useAuditLog()
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [rejectMode,   setRejectMode]   = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  // chosen[materialId] = quoteId đã chọn (KHÔNG phải supplierName - trùng tên NCC hoặc còn báo giá
  // cũ chưa dọn sau 1 vòng "Báo giá lại" sẽ khớp nhầm nếu dùng tên, xem D.h3-quote-id-not-name).
  // Key theo materialId (KHÔNG phải item.name - 2 vật tư khác nhau có thể trùng tên hiển thị, vd
  // nhiều loại "Sắt phi" khác đường kính - xem purchasing-api.ts D.p6-quote-key-collision).
  // Gộp item của mọi kho trong đơn.
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const itemKey = (item: PurchaseProposalItem) => String(item.materialId)
  const fmt = (n: number) => n.toLocaleString('vi-VN')

  const groups = groupByRequestId(proposals)
  // Đơn hiện trong hàng chờ duyệt ngay khi có ít nhất 1 kho báo giá xong — không cần chờ đủ mới thấy.
  const visibleGroups = groups.filter(g => g.some(p => p.status === 'submitted'))
  const pendingCount = visibleGroups.length
  const selectedGroup = visibleGroups.find(g => g[0].requestId === selectedRequestId) ?? null

  const openDetail = (group: PurchaseProposal[]) => {
    setSelectedRequestId(group[0].requestId)
    setRejectMode(false)
    setRejectReason('')
    // Pre-fill chosen (theo quoteId) từ chosenSuppliers cũ hoặc NCC rẻ nhất, gộp item của mọi kho
    // trong đơn. Nhánh chosenSuppliers vẫn phải tra theo tên (BE chỉ trả lại tên NCC đã chọn ở
    // đó, không phải quoteId) - nhưng đây chỉ là giá trị GỢI Ý ban đầu, Sếp vẫn thấy đúng dòng
    // nào đang highlight và tự bấm lại nếu sai trước khi Duyệt; điểm mất an toàn thật (gửi thẳng
    // id lên BE lúc bấm Duyệt mà không tra lại theo tên) đã bỏ ở approveProposal().
    const init: Record<string, string> = {}
    group.forEach(p => {
      p.items.forEach(item => {
        const key = itemKey(item)
        const offers: ProposalQuote[] = p.quotes?.[key] ?? []
        if (p.chosenSuppliers?.[key]) {
          const match = offers.find(q => q.supplierName === p.chosenSuppliers![key])
          if (match?.id) init[key] = match.id
        } else {
          const cheapest = offers
            .filter(q => q.unitPrice != null && q.unitPrice > 0)
            .sort((a, b) => (a.unitPrice ?? 0) - (b.unitPrice ?? 0))[0]
          if (cheapest?.id) init[key] = cheapest.id
        }
      })
    })
    setChosen(init)
  }

  const allChosen = (group: PurchaseProposal[]) =>
    group.every(p => p.items.every(item => !!chosen[itemKey(item)]))

  // Duyệt chỉ mở khoá khi TẤT CẢ kho liên quan đến đơn đã báo giá xong — không duyệt lẻ từng kho.
  const allSubmitted = (group: PurchaseProposal[]) =>
    group.every(p => p.status === 'submitted')

  const quotedCount = (group: PurchaseProposal[]) =>
    group.filter(p => p.status !== 'new' && p.status !== 'quoting').length

  const handleApprove = (group: PurchaseProposal[]) => {
    group.forEach(p => {
      const chosenForP: Record<string, string> = {}
      p.items.forEach(item => { const key = itemKey(item); if (chosen[key]) chosenForP[key] = chosen[key] })
      onApprove(p.id, chosenForP)
    })
    setSelectedRequestId(null)
  }

  const handleReject = (group: PurchaseProposal[]) => {
    const reason = rejectReason || 'Không có lý do'
    // Từ chối áp dụng cho cả đơn — kể cả kho chưa kịp báo giá xong.
    group.forEach(p => onReject(p.id, reason))
    setSelectedRequestId(null)
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selectedGroup) {
    const group = selectedGroup
    const meta = group[0]
    const items = group.flatMap(p => p.items)
    const mergedQuotes: Record<string, ProposalQuote[]> = {}
    group.forEach(p => { Object.entries(p.quotes ?? {}).forEach(([name, offers]) => { mergedQuotes[name] = offers }) })
    const submittedAts = group.map(p => p.submittedAt).filter((d): d is string => !!d).sort()
    const latestSubmittedAt = submittedAts[submittedAts.length - 1]
    const ready = allSubmitted(group)

    const totalChosen = items.reduce((sum, item) => {
      const quoteId = chosen[itemKey(item)]
      const offer = (mergedQuotes[itemKey(item)] ?? []).find(q => q.id === quoteId)
      return sum + (offer?.unitPrice ?? 0) * item.buyQty
    }, 0)

    return (
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setSelectedRequestId(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text2)', marginBottom: 10 }}
          >
            <ChevronLeft size={13} /> Danh sách
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{meta.poNumber}</h2>
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>{meta.skuCode}{meta.skuName ? ` — ${meta.skuName}` : ''}</span>
            <div style={{ flex: 1 }} />
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
              border: `1px solid ${ready ? 'var(--border)' : '#fde68a'}`,
              color: ready ? 'var(--text2)' : '#92400e',
              background: ready ? 'var(--surface2)' : '#fffbeb',
            }}>
              {ready ? 'Chờ duyệt' : `${quotedCount(group)}/${group.length} kho đã báo giá`}
            </span>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 16 }}>
            {meta.deadline && <span>Deadline: <strong style={{ color: 'var(--text2)' }}>{new Date(meta.deadline).toLocaleDateString('vi-VN')}</strong></span>}
            <span>Gửi lúc {latestSubmittedAt ? format(new Date(latestSubmittedAt), 'HH:mm dd/MM/yyyy') : '—'}</span>
            {totalChosen > 0 && <span>Tổng dự kiến: <strong style={{ color: 'var(--text)' }}>{fmt(totalChosen)}đ</strong></span>}
          </div>
        </div>

        {/* Per-item NCC selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item, idx) => {
            const offers: ProposalQuote[] = mergedQuotes[itemKey(item)] ?? []
            const prices = offers.map(q => q.unitPrice).filter((x): x is number => x != null && x > 0)
            const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null
            const chosenQuoteId = chosen[itemKey(item)]
            const chosenOffer = offers.find(q => q.id === chosenQuoteId)
            const chosenName = chosenOffer?.supplierName

            return (
              <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
                {/* Item header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.khoLabel}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>·</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Cần mua <strong>{item.buyQty} {item.unit}</strong></span>
                  {chosenName && (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>·</span>
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>Đã chọn: <strong>{chosenName}</strong></span>
                    </>
                  )}
                </div>

                {offers.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text3)' }}>Chưa có báo giá — kho phụ trách chưa gửi</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={{ ...th, width: 36 }}></th>
                        <th style={th}>Nhà cung cấp</th>
                        <th style={{ ...th, textAlign: 'right' }}>Đơn giá</th>
                        <th style={th}>Dự kiến về</th>
                        <th style={{ ...th, textAlign: 'right' }}>Thành tiền</th>
                        <th style={th}>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offers.map((q, qi) => {
                        const isChosen  = !!q.id && q.id === chosenQuoteId
                        const isCheapest = cheapestPrice != null && q.unitPrice === cheapestPrice && offers.length > 1
                        const total = q.unitPrice != null && q.unitPrice > 0 ? q.unitPrice * item.buyQty : null
                        return (
                          <tr
                            key={qi}
                            onClick={() => { if (q.id) setChosen(prev => ({ ...prev, [itemKey(item)]: q.id! })) }}
                            style={{
                              borderTop: '1px solid var(--border)',
                              cursor: 'pointer',
                              background: isChosen ? 'var(--surface2)' : undefined,
                            }}
                            onMouseEnter={e => { if (!isChosen) e.currentTarget.style.background = 'var(--surface2)' }}
                            onMouseLeave={e => { if (!isChosen) e.currentTarget.style.background = '' }}
                          >
                            <td style={{ ...td, width: 36, paddingRight: 0 }}>
                              <div style={{
                                width: 16, height: 16, borderRadius: '50%',
                                border: `2px solid ${isChosen ? '#18181b' : 'var(--border)'}`,
                                background: isChosen ? '#18181b' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {isChosen && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                              </div>
                            </td>
                            <td style={{ ...td, fontWeight: isChosen ? 600 : 400 }}>
                              {q.supplierName}
                              {isCheapest && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text3)' }}>↓ rẻ nhất</span>}
                            </td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: isChosen ? 600 : 400 }}>
                              {q.unitPrice ? fmt(q.unitPrice) + 'đ' : '—'}
                            </td>
                            <td style={{ ...td, color: 'var(--text3)' }}>
                              {q.expectedDate ? new Date(q.expectedDate).toLocaleDateString('vi-VN') : '—'}
                            </td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: isChosen ? 600 : 400 }}>
                              {total ? fmt(total) + 'đ' : '—'}
                            </td>
                            <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{q.note ?? '—'}</td>
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

        {/* Footer actions */}
        <div style={{ marginTop: 14 }}>
          {!rejectMode ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setRejectMode(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 16px', fontSize: 13, fontWeight: 500, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}
              >
                <X size={13} /> Từ chối
              </button>
              <button
                onClick={() => handleApprove(group)}
                disabled={!ready || !allChosen(group)}
                title={!ready ? 'Cần tất cả các kho báo giá xong mới duyệt được' : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '7px 20px', fontSize: 13, fontWeight: 600,
                  border: 'none', borderRadius: 6,
                  background: ready && allChosen(group) ? '#18181b' : 'var(--surface2)',
                  color: ready && allChosen(group) ? '#fff' : 'var(--text3)',
                  cursor: ready && allChosen(group) ? 'pointer' : 'not-allowed',
                }}
              >
                <Check size={13} /> Duyệt{!ready ? ' (chờ đủ kho báo giá)' : !allChosen(group) ? ' (chọn đủ NCC)' : ''}
              </button>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: 'var(--surface)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Lý do từ chối</div>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Nhập lý do..."
                rows={2}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => { setRejectMode(false); setRejectReason('') }}
                  style={{ padding: '6px 14px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text2)' }}
                >Hủy</button>
                <button
                  onClick={() => handleReject(group)}
                  style={{ padding: '6px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, background: '#dc2626', color: '#fff', cursor: 'pointer' }}
                >Xác nhận từ chối</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 20 }}>
        <AuditLogTimeline entries={group.flatMap(p => getLogsFor(PROPOSAL_ENTITY, p.id)).sort((a, b) => a.at.localeCompare(b.at))} />
      </div>
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  if (visibleGroups.length === 0) {
    return (
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>So sánh giá</h2>
        <div style={{ marginTop: 40, padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 14 }}>
          Chưa có đề xuất mua hàng nào được gửi lên
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>So sánh giá</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>
          {pendingCount > 0 ? `${pendingCount} đơn chờ phê duyệt` : 'Tất cả đã được xử lý'}
        </p>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>PO</th>
              <th style={th}>Mã nhà máy</th>
              <th style={{ ...th, textAlign: 'right' }}>Vật tư</th>
              <th style={th}>Deadline</th>
              <th style={th}>Kho đã báo giá</th>
              <th style={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {visibleGroups.map(group => {
              const meta = group[0]
              const ready = allSubmitted(group)
              return (
                <tr
                  key={meta.requestId}
                  onClick={() => openDetail(group)}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{meta.poNumber}</td>
                  <td style={td}>
                    <span style={{ fontWeight: 600 }}>{meta.skuCode}</span>
                    {meta.skuName && <span style={{ marginLeft: 6, color: 'var(--text3)', fontSize: 12 }}>{meta.skuName}</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{group.reduce((n, p) => n + p.items.length, 0)}</td>
                  <td style={{ ...td, fontSize: 12, color: meta.deadline ? 'var(--text2)' : 'var(--text3)' }}>
                    {meta.deadline ? new Date(meta.deadline).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{quotedCount(group)}/{group.length}</td>
                  <td style={td}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      border: `1px solid ${ready ? 'var(--border)' : '#fde68a'}`,
                      color: ready ? 'var(--text2)' : '#92400e',
                      background: ready ? 'var(--surface2)' : '#fffbeb',
                    }}>
                      {ready ? 'Chờ duyệt' : 'Đang chờ kho báo giá'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 14px' }

// ── Tổng hợp chờ duyệt section ────────────────────────────────────────────────

const CHO_DUYET_FILTERS: { key: ChoDuyetFilter; label: string }[] = [
  { key: 'sku-moi',    label: 'SKU mới'       },
  { key: 'so-sanh-gia', label: 'So sánh giá'    },
  { key: 'lenh-sx',     label: 'Lệnh sản xuất'  },
]

function ChoDuyetSection({ proposals, onApprove, onReject }: {
  proposals: PurchaseProposal[]
  onApprove: (id: string, chosen: Record<string, string>) => void
  onReject:  (id: string, reason: string) => void
}) {
  const [filter, setFilter] = useState<ChoDuyetFilter>('so-sanh-gia')

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {CHO_DUYET_FILTERS.map(f => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 16px', fontSize: 13, fontWeight: active ? 600 : 400,
                border: `1px solid ${active ? ACCENT : 'var(--border)'}`,
                borderRadius: 20, cursor: 'pointer',
                background: active ? ACCENT_BG : 'var(--surface)',
                color: active ? ACCENT : 'var(--text2)',
                transition: 'all .15s',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {filter === 'sku-moi'    && <SKUReviewPage />}
      {filter === 'so-sanh-gia' && <SoSanhGiaSection proposals={proposals} onApprove={onApprove} onReject={onReject} />}
      {filter === 'lenh-sx'     && <LenhSXPage />}
    </div>
  )
}

// ── Main app ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'cho-duyet', label: 'Tổng hợp chờ duyệt', icon: <ClipboardCheck  size={16} /> },
  { id: 'thong-ke',  label: 'Tổng hợp lệnh SX',   icon: <CalendarClock   size={16} /> },
  { id: 'sku-list',  label: 'Danh sách SKU',       icon: <LayoutDashboard size={16} /> },
  { id: 'vat-tu',    label: 'Tổng hợp vật tư',     icon: <Package         size={16} /> },
  { id: 'kho',       label: 'Tổng hợp kho',        icon: <Warehouse       size={16} /> },
]

export default function BossApp() {
  const { user, logout } = useAuth()
  const { proposals, approveProposal, rejectProposal } = useInspection()
  const [page, setPage]  = useState<Page>('cho-duyet')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 210, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Giám đốc</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Đông Nam Á Corp</div>
        </div>

        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {NAV_ITEMS.map(item => {
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '8px 10px', marginBottom: 2, border: 'none',
                  borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                  background: active ? ACCENT_BG : 'transparent',
                  color: active ? ACCENT : 'var(--text)',
                  fontWeight: active ? 600 : 400,
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT_BG, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {user?.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Giám đốc</div>
            </div>
            <button onClick={logout} style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }} title="Đăng xuất">
              <LogOut size={16} color="var(--text3)" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {page === 'cho-duyet' && <ChoDuyetSection proposals={proposals} onApprove={approveProposal} onReject={rejectProposal} />}
        {page === 'thong-ke'  && <ThongKePagePlan />}
        {page === 'sku-list'  && <SKUListPage readOnly />}
        {page === 'vat-tu'    && <VatTuDashboardPage />}
        {page === 'kho'       && <MfgWarehousesPage />}
      </div>
    </div>
  )
}
