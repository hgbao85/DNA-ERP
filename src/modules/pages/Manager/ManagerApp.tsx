'use client'
import { useState } from 'react'
import { LayoutDashboard, Package, LogOut, CalendarClock, Warehouse, ClipboardCheck, Check, X, ChevronLeft } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useInspection, type PurchaseProposal, type ProposalQuote } from '../../../context/InspectionContext'
import { format } from 'date-fns'
import SKUReviewPage from '../ProductionPlan/SKUReviewPage'
import SKUListPage from '../ProductionPlan/SKUListPage'
import VatTuDashboardPage from '../ProductionPlan/VatTuDashboardPage'
import ThongKePagePlan from '../Manufacturing/ThongKePagePlan'
import MfgWarehousesPage from '../Manufacturing/MfgWarehousesPage'
import PIListPage from '../ProductionPlan/PIListPage'

const ACCENT    = '#2e7d32'
const ACCENT_BG = '#e8f5e9'

type Page           = 'cho-duyet' | 'thong-ke' | 'sku-list' | 'vat-tu' | 'kho'
type ChoDuyetFilter = 'dinh-muc' | 'so-sanh-gia' | 'lenh-sx'


// ── So sánh giá section ───────────────────────────────────────────────────────

function SoSanhGiaSection({ proposals, onApprove, onReject }: {
  proposals: PurchaseProposal[]
  onApprove: (id: string, chosen: Record<string, string>) => void
  onReject:  (id: string, reason: string) => void
}) {
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [rejectMode,   setRejectMode]   = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  // chosen[itemName] = supplierName selected by manager
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const fmt = (n: number) => n.toLocaleString('vi-VN')

  const submittedProposals = proposals.filter(p => p.status === 'submitted')
  const pendingCount = proposals.filter(p => p.status === 'submitted').length
  const selected = submittedProposals.find(p => p.id === selectedId) ?? null

  const openDetail = (p: PurchaseProposal) => {
    setSelectedId(p.id)
    setRejectMode(false)
    setRejectReason('')
    // Pre-fill chosen from existing chosenSuppliers or cheapest per item
    const init: Record<string, string> = {}
    p.items.forEach(item => {
      if (p.chosenSuppliers?.[item.name]) {
        init[item.name] = p.chosenSuppliers[item.name]
      } else {
        const offers: ProposalQuote[] = p.quotes?.[item.name] ?? []
        const cheapest = offers
          .filter(q => q.unitPrice != null && q.unitPrice > 0)
          .sort((a, b) => (a.unitPrice ?? 0) - (b.unitPrice ?? 0))[0]
        if (cheapest) init[item.name] = cheapest.supplierName
      }
    })
    setChosen(init)
  }

  const allChosen = (p: PurchaseProposal) =>
    p.items.every(item => !!chosen[item.name])

  const statusBadge = (p: PurchaseProposal) => {
    if (p.status === 'submitted') return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--text2)', background: 'var(--surface2)' }}>Chờ duyệt</span>
    return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, border: '1px solid #fca5a5', color: '#dc2626', background: '#fff5f5' }}>Từ chối</span>
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const p = selected
    const isPending  = p.status === 'submitted'

    const totalChosen = p.items.reduce((sum, item) => {
      const suppName = chosen[item.name] ?? p.chosenSuppliers?.[item.name]
      const offer = (p.quotes?.[item.name] ?? []).find(q => q.supplierName === suppName)
      return sum + (offer?.unitPrice ?? 0) * item.buyQty
    }, 0)

    return (
      <div>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setSelectedId(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text2)', marginBottom: 10 }}
          >
            <ChevronLeft size={13} /> Danh sách
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{p.poNumber}</h2>
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>{p.skuCode}{p.skuName ? ` — ${p.skuName}` : ''}</span>
            <div style={{ flex: 1 }} />
            {statusBadge(p)}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 16 }}>
            {p.deadline && <span>Deadline: <strong style={{ color: 'var(--text2)' }}>{new Date(p.deadline).toLocaleDateString('vi-VN')}</strong></span>}
            <span>Gửi lúc {p.submittedAt ? format(new Date(p.submittedAt), 'HH:mm dd/MM/yyyy') : '—'}</span>
            {totalChosen > 0 && <span>Tổng dự kiến: <strong style={{ color: 'var(--text)' }}>{fmt(totalChosen)}đ</strong></span>}
          </div>
        </div>

        {/* Per-item NCC selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {p.items.map((item, idx) => {
            const offers: ProposalQuote[] = p.quotes?.[item.name] ?? []
            const prices = offers.map(q => q.unitPrice).filter((x): x is number => x != null && x > 0)
            const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null
            const chosenName = isPending ? chosen[item.name] : (p.chosenSuppliers?.[item.name] ?? chosen[item.name])

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
                  <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text3)' }}>Không có báo giá</div>
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
                        const isChosen  = q.supplierName === chosenName
                        const isCheapest = cheapestPrice != null && q.unitPrice === cheapestPrice && offers.length > 1
                        const total = q.unitPrice != null && q.unitPrice > 0 ? q.unitPrice * item.buyQty : null
                        return (
                          <tr
                            key={qi}
                            onClick={() => isPending && setChosen(prev => ({ ...prev, [item.name]: q.supplierName }))}
                            style={{
                              borderTop: '1px solid var(--border)',
                              cursor: isPending ? 'pointer' : 'default',
                              background: isChosen ? 'var(--surface2)' : undefined,
                            }}
                            onMouseEnter={e => { if (isPending && !isChosen) e.currentTarget.style.background = 'var(--surface2)' }}
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
        {isPending && (
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
                  onClick={() => { onApprove(p.id, chosen); setSelectedId(null) }}
                  disabled={!allChosen(p)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '7px 20px', fontSize: 13, fontWeight: 600,
                    border: 'none', borderRadius: 6,
                    background: allChosen(p) ? '#18181b' : 'var(--surface2)',
                    color: allChosen(p) ? '#fff' : 'var(--text3)',
                    cursor: allChosen(p) ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Check size={13} /> Duyệt{!allChosen(p) && ' (chọn đủ NCC)'}
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
                    onClick={() => { onReject(p.id, rejectReason || 'Không có lý do'); setSelectedId(null) }}
                    style={{ padding: '6px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, background: '#dc2626', color: '#fff', cursor: 'pointer' }}
                  >Xác nhận từ chối</button>
                </div>
              </div>
            )}
          </div>
        )}

        {p.status === 'rejected' && (
          <div style={{ marginTop: 12, padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--text3)' }}>
            Từ chối: {p.rejectionReason}
          </div>
        )}
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  if (submittedProposals.length === 0) {
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
          {pendingCount > 0 ? `${pendingCount} đề xuất chờ phê duyệt` : 'Tất cả đã được xử lý'}
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
              <th style={th}>Gửi lúc</th>
              <th style={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {submittedProposals.map(p => (
              <tr
                key={p.id}
                onClick={() => openDetail(p)}
                style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{p.poNumber}</td>
                <td style={td}>
                  <span style={{ fontWeight: 600 }}>{p.skuCode}</span>
                  {p.skuName && <span style={{ marginLeft: 6, color: 'var(--text3)', fontSize: 12 }}>{p.skuName}</span>}
                </td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{p.items.length}</td>
                <td style={{ ...td, fontSize: 12, color: p.deadline ? 'var(--text2)' : 'var(--text3)' }}>
                  {p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : '—'}
                </td>
                <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>
                  {p.submittedAt ? format(new Date(p.submittedAt), 'HH:mm dd/MM/yyyy') : '—'}
                </td>
                <td style={td}>{statusBadge(p)}</td>
              </tr>
            ))}
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
  { key: 'dinh-muc',    label: 'Định mức'       },
  { key: 'so-sanh-gia', label: 'So sánh giá'    },
  { key: 'lenh-sx',     label: 'Lệnh sản xuất'  },
]

function ChoDuyetSection({ proposals, onApprove, onReject }: {
  proposals: PurchaseProposal[]
  onApprove: (id: string, chosen: Record<string, string>) => void
  onReject:  (id: string, reason: string) => void
}) {
  const pendingCount = proposals.filter(p => p.status === 'submitted').length
  const [filter, setFilter] = useState<ChoDuyetFilter>('so-sanh-gia')

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {CHO_DUYET_FILTERS.map(f => {
          const active = filter === f.key
          const badge  = f.key === 'so-sanh-gia' && pendingCount > 0 ? pendingCount : 0
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
              {badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#dc2626', color: '#fff' }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {filter === 'dinh-muc'    && <SKUReviewPage />}
      {filter === 'so-sanh-gia' && <SoSanhGiaSection proposals={proposals} onApprove={onApprove} onReject={onReject} />}
      {filter === 'lenh-sx'     && <PIListPage />}
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

export default function ManagerApp() {
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
