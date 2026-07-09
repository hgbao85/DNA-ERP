import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import { Award, ChevronLeft, Send, ClipboardList, CheckCircle2, Plus, X } from 'lucide-react'
import { useInspection, PROPOSAL_ENTITY, PROPOSAL_STATUS_LABELS, type PurchaseProposal, type ProposalQuote } from '../../../context/InspectionContext'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import { visibleProposalsFor } from '../../../utils/purchasingRouting'
import AuditLogTimeline from '../../../components/AuditLogTimeline'
import * as api from '../../../services/api'
import { format } from 'date-fns'

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])
const vnd = (n?: number | null) => (n == null ? '—' : n.toLocaleString('vi-VN') + 'đ')

interface Supplier { id: number; name: string }
interface SupplierLink { id: number; price?: number | null; leadTimeDays?: number | null; supplier?: Supplier | null }

export default function LenhMuaNCCPage() {
  const { user } = useAuth()
  const { proposals: allProposals, acknowledgeProposal, submitProposalToDirector, requoteProposal } = useInspection()
  // Purchasing chỉ thấy đề xuất của đúng kho mình phụ trách (user.warehouseScope) — xem purchasingRouting.ts
  const proposals = visibleProposalsFor(user, allProposals)

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Lệnh mua — chọn NCC & báo giá</h2>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Nhập báo giá của nhiều nhà cung cấp cho từng vật tư (tối thiểu 1 NCC/vật tư), sau đó gửi Giám đốc so sánh và chọn duyệt.
      </div>

      {proposals.length > 0 ? (
        <ProposalSection
          proposals={proposals}
          onAcknowledge={acknowledgeProposal}
          onSubmitToDirector={submitProposalToDirector}
          onRequote={requoteProposal}
        />
      ) : (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
          Không có lệnh mua nào cần xử lý
        </div>
      )}
    </div>
  )
}

// ─── Modal gợi ý NCC ─────────────────────────────────────────────────────────

function CompareModal({ item, suppliers, onClose, onChoose }: {
  item: { materialId?: number | null; materialName?: string | null; name?: string; buyQty: number; unit?: string | null }
  suppliers?: Supplier[]
  onClose: () => void
  onChoose: (suppId: number, suppName: string, price: number | null, days: number | null) => void
}) {
  const displayName = item.materialName ?? item.name ?? ''
  const { data: links } = useFetch<SupplierLink[]>(
    () => api.getMaterialSuppliers(item.materialId ?? undefined),
    [item.materialId]
  )
  const list = safeArr(links).filter(l => l.supplier)
  const cheapest = list.filter(l => l.price != null).sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0]

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 560, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Gợi ý NCC — {displayName}</h3>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
          Cần mua {item.buyQty} {item.unit ?? ''} · Chọn NCC từ danh sách (giá & ngày tự điền)
        </div>
        {list.length === 0 ? (
          <div style={{ color: '#e65100', fontSize: 13 }}>
            Vật tư này chưa gắn NCC nào. Vào &quot;Vật tư – NCC&quot; để thêm.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--surface2)' }}>
                <th style={th}>NCC</th>
                <th style={{ ...th, textAlign: 'right' }}>Đơn giá</th>
                <th style={{ ...th, textAlign: 'right' }}>Giao (ngày)</th>
                <th style={{ ...th, textAlign: 'right' }}>Thành tiền</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {list.map(l => {
                const isCheap = cheapest && l.id === cheapest.id
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border)', background: isCheap ? '#f1f8e9' : undefined }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {l.supplier?.name}
                      {isCheap && <span style={{ marginLeft: 6, fontSize: 10, color: '#2e7d32', fontWeight: 700 }}>★ rẻ nhất</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{vnd(l.price)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.leadTimeDays ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>
                      {l.price != null ? vnd(l.price * item.buyQty) : '—'}
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => onChoose(l.supplier!.id, l.supplier!.name, l.price ?? null, l.leadTimeDays ?? null)}
                        style={{ padding: '4px 12px', background: '#4527a0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
                      >
                        Chọn
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 12px' }
const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', width: '100%' }

// ─── Đề xuất mua từ Quản lý SX ───────────────────────────────────────────────

function ProposalSection({ proposals, onAcknowledge, onSubmitToDirector, onRequote }: {
  proposals: PurchaseProposal[]
  onAcknowledge: (id: string) => void
  onSubmitToDirector: (id: string, quotes: Record<string, ProposalQuote[]>) => void
  onRequote: (id: string) => void
}) {
  const { getLogsFor } = useAuditLog()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [quoteEdits, setQuoteEdits] = useState<Record<string, Record<string, ProposalQuote[]>>>({})
  const [nccPanel, setNccPanel] = useState<{ proposalId: string; itemName: string; materialId?: number } | null>(null)

  const newCount = proposals.filter(p => p.status === 'new').length
  const selected = proposals.find(p => p.id === selectedId) ?? null

  const getRows = (proposalId: string, itemName: string): ProposalQuote[] =>
    quoteEdits[proposalId]?.[itemName] ?? []

  const setRows = (proposalId: string, itemName: string, rows: ProposalQuote[]) =>
    setQuoteEdits(prev => ({
      ...prev,
      [proposalId]: { ...(prev[proposalId] ?? {}), [itemName]: rows },
    }))

  const addRow = (proposalId: string, itemName: string, supplierName = '', price: number | null = null, days: number | null = null) => {
    const expectedDate = days ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) : undefined
    setRows(proposalId, itemName, [...getRows(proposalId, itemName), { supplierName, unitPrice: price, expectedDate }])
  }

  const removeRow = (proposalId: string, itemName: string, idx: number) =>
    setRows(proposalId, itemName, getRows(proposalId, itemName).filter((_, i) => i !== idx))

  const updateRow = (proposalId: string, itemName: string, idx: number, patch: Partial<ProposalQuote>) =>
    setRows(proposalId, itemName, getRows(proposalId, itemName).map((r, i) => i === idx ? { ...r, ...patch } : r))

  const canSubmit = (p: PurchaseProposal) =>
    p.items.every(item => {
      const rows = getRows(p.id, item.name)
      return rows.some(r => r.supplierName.trim() !== '' && r.unitPrice != null && r.unitPrice > 0)
    })

  const handleSubmit = (p: PurchaseProposal) => {
    const quotes: Record<string, ProposalQuote[]> = {}
    p.items.forEach(item => {
      quotes[item.name] = getRows(p.id, item.name).filter(r => r.supplierName.trim() !== '' && r.unitPrice != null && r.unitPrice > 0)
    })
    onSubmitToDirector(p.id, quotes)
    setSelectedId(null)
  }

  // Báo giá lại sau khi bị từ chối — seed lại đúng các dòng NCC/giá đã báo trước đó để sửa tiếp,
  // không bắt nhập lại từ đầu (quoteEdits và p.quotes cùng shape Record<itemName, ProposalQuote[]>).
  const handleRequote = (p: PurchaseProposal) => {
    if (p.quotes) setQuoteEdits(prev => ({ ...prev, [p.id]: p.quotes! }))
    onRequote(p.id)
  }

  const statusTag = (p: PurchaseProposal) => {
    const cfg = PROPOSAL_STATUS_LABELS[p.status]
    return <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: '2px 8px' }}>{cfg.label}</span>
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const p = selected
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
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{p.poNumber}</span>
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

          {/* ── NEW ── */}
          {p.status === 'new' && (<>
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
                  {p.items.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{item.khoLabel}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{item.name}</td>
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
                onClick={() => onAcknowledge(p.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer' }}
              >
                Tiếp nhận & Báo giá
              </button>
            </div>
          </>)}

          {/* ── QUOTING ── */}
          {p.status === 'quoting' && (
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {p.items.map((item, idx) => {
                const rows = getRows(p.id, item.name)
                const prices = rows.map(r => r.unitPrice).filter((x): x is number => x != null && x > 0)
                const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null
                return (
                  <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.khoLabel}</span>
                      <span style={{ fontSize: 12, color: '#c62828', fontWeight: 600 }}>Cần mua: {item.buyQty} {item.unit}</span>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => setNccPanel({ proposalId: p.id, itemName: item.name, materialId: item.materialId })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', fontSize: 11, cursor: 'pointer', color: 'var(--text2)', whiteSpace: 'nowrap' }}
                      >
                        <Award size={11} /> Gợi ý NCC
                      </button>
                    </div>
                    {rows.length > 0 && (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ textAlign: 'left', background: 'var(--surface)' }}>
                              <th style={th}>NCC</th>
                              <th style={{ ...th, minWidth: 130 }}>Đơn giá (đ)</th>
                              <th style={{ ...th, minWidth: 140 }}>Ngày dự kiến về</th>
                              <th style={th}>Ghi chú</th>
                              <th style={{ ...th, textAlign: 'right' }}>Thành tiền</th>
                              <th style={th}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, ri) => {
                              const price = r.unitPrice ?? null
                              const total = price != null && price > 0 ? price * item.buyQty : null
                              const isCheap = cheapestPrice != null && price === cheapestPrice
                              return (
                                <tr key={ri} style={{ borderTop: '1px solid var(--border)', background: isCheap ? '#f1f8e9' : undefined }}>
                                  <td style={{ ...td, fontWeight: 600 }}>
                                    <input
                                      type="text"
                                      value={r.supplierName}
                                      onChange={e => updateRow(p.id, item.name, ri, { supplierName: e.target.value })}
                                      placeholder="Tên NCC"
                                      style={{ ...inp, width: 160 }}
                                    />
                                    {isCheap && rows.length > 1 && (
                                      <span style={{ marginLeft: 6, fontSize: 10, color: '#2e7d32', fontWeight: 700 }}>★ rẻ nhất</span>
                                    )}
                                  </td>
                                  <td style={td}>
                                    <input
                                      type="number" min={0}
                                      value={r.unitPrice ?? ''}
                                      onChange={e => updateRow(p.id, item.name, ri, { unitPrice: e.target.value ? Number(e.target.value) : null })}
                                      placeholder="VD: 85000"
                                      style={{ ...inp, width: 120 }}
                                    />
                                  </td>
                                  <td style={td}>
                                    <input
                                      type="date"
                                      value={r.expectedDate ?? ''}
                                      onChange={e => updateRow(p.id, item.name, ri, { expectedDate: e.target.value || undefined })}
                                      style={{ ...inp, width: 130 }}
                                    />
                                  </td>
                                  <td style={td}>
                                    <input
                                      type="text"
                                      value={r.note ?? ''}
                                      onChange={e => updateRow(p.id, item.name, ri, { note: e.target.value || undefined })}
                                      placeholder="Ghi chú..."
                                      style={inp}
                                    />
                                  </td>
                                  <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: total ? '#4527a0' : 'var(--text3)' }}>
                                    {total ? total.toLocaleString('vi-VN') + 'đ' : '—'}
                                  </td>
                                  <td style={td}>
                                    {rows.length > 1 && (
                                      <button
                                        onClick={() => removeRow(p.id, item.name, ri)}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: '#c62828' }}
                                      >
                                        <X size={13} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div style={{ padding: '6px 12px' }}>
                      <button
                        onClick={() => addRow(p.id, item.name)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px dashed var(--border)', borderRadius: 6, background: 'none', fontSize: 12, cursor: 'pointer', color: '#4527a0', fontWeight: 600 }}
                      >
                        <Plus size={12} /> Thêm báo giá NCC
                      </button>
                    </div>
                  </div>
                )
              })}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
                {!canSubmit(p) && (
                  <span style={{ fontSize: 12, color: '#e65100' }}>Mỗi vật tư cần ít nhất 1 NCC có đơn giá</span>
                )}
                <button
                  onClick={() => handleSubmit(p)}
                  disabled={!canSubmit(p)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                    background: canSubmit(p) ? '#4527a0' : '#e5e7eb',
                    color: canSubmit(p) ? '#fff' : '#9ca3af',
                    cursor: canSubmit(p) ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Send size={14} /> Gửi Giám đốc duyệt
                </button>
              </div>
            </div>
          )}

          {/* ── SUBMITTED / APPROVED / PURCHASED / REJECTED ── */}
          {(p.status === 'submitted' || p.status === 'purchasing' || p.status === 'purchased' || p.status === 'rejected') && (<>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                    <th style={th}>Vật tư</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cần mua</th>
                    <th style={th}>ĐVT</th>
                    <th style={th}>Nhà cung cấp</th>
                    <th style={{ ...th, textAlign: 'right' }}>Đơn giá</th>
                    <th style={th}>Dự kiến về</th>
                    <th style={{ ...th, textAlign: 'right' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {p.items.flatMap((item, idx) => {
                    const offers: ProposalQuote[] = p.quotes?.[item.name] ?? []
                    const prices = offers.map(q => q.unitPrice).filter((x): x is number => x != null && x > 0)
                    const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null
                    if (offers.length === 0) {
                      return [(
                        <tr key={`${idx}-empty`} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ ...td, fontWeight: 600 }}>{item.name}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{item.buyQty}</td>
                          <td style={{ ...td, color: 'var(--text3)' }}>{item.unit}</td>
                          <td colSpan={4} style={{ ...td, color: 'var(--text3)' }}>—</td>
                        </tr>
                      )]
                    }
                    return offers.map((q, qi) => {
                      const isCheap = cheapestPrice != null && q.unitPrice === cheapestPrice
                      const total = q.unitPrice != null && q.unitPrice > 0 ? q.unitPrice * item.buyQty : null
                      return (
                        <tr key={`${idx}-${qi}`} style={{ borderTop: '1px solid var(--border)', background: isCheap ? '#f1f8e9' : undefined }}>
                          {qi === 0 && <td style={{ ...td, fontWeight: 600 }} rowSpan={offers.length}>{item.name}</td>}
                          {qi === 0 && <td style={{ ...td, textAlign: 'right' }} rowSpan={offers.length}>{item.buyQty}</td>}
                          {qi === 0 && <td style={{ ...td, color: 'var(--text3)' }} rowSpan={offers.length}>{item.unit}</td>}
                          <td style={td}>
                            {q.supplierName}
                            {isCheap && offers.length > 1 && <span style={{ marginLeft: 6, fontSize: 10, color: '#2e7d32', fontWeight: 700 }}>★ rẻ nhất</span>}
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>{q.unitPrice ? q.unitPrice.toLocaleString('vi-VN') + 'đ' : '—'}</td>
                          <td style={{ ...td, color: 'var(--text3)' }}>{q.expectedDate ? new Date(q.expectedDate).toLocaleDateString('vi-VN') : '—'}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#4527a0' }}>{total ? total.toLocaleString('vi-VN') + 'đ' : '—'}</td>
                        </tr>
                      )
                    })
                  })}
                </tbody>
              </table>
            </div>
            {p.status === 'purchasing' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid #fde68a', background: '#fffbeb', fontSize: 13, color: '#92400e' }}>
                <CheckCircle2 size={15} />
                <span>Giám đốc đã duyệt lúc {p.approvedAt ? format(new Date(p.approvedAt), 'HH:mm dd/MM/yyyy') : '—'} — <strong>Đang mua hàng</strong></span>
              </div>
            ) : p.status === 'purchased' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid #86efac', background: '#dcfce7', fontSize: 13, color: '#166534' }}>
                <CheckCircle2 size={15} />
                <span>Đã nhận đủ hàng lúc {p.purchasedAt ? format(new Date(p.purchasedAt), 'HH:mm dd/MM/yyyy') : '—'} — <strong>Hoàn tất mua vật tư</strong></span>
              </div>
            ) : p.status === 'rejected' ? (
              <div style={{ padding: '10px 14px', borderTop: '1px solid #f48fb1', background: '#fce4ec' }}>
                <div style={{ fontSize: 13, color: '#c62828', marginBottom: 8 }}>
                  <strong>Giám đốc từ chối</strong> lúc {p.rejectedAt ? format(new Date(p.rejectedAt), 'HH:mm dd/MM/yyyy') : '—'}: {p.rejectionReason || 'Không có lý do'}
                </div>
                <button
                  onClick={() => handleRequote(p)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: '#c62828', color: '#fff', cursor: 'pointer' }}
                >
                  Báo giá lại
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid #86efac', background: '#f0fdf4', fontSize: 13, color: '#166534' }}>
                <CheckCircle2 size={15} />
                <span>Đã gửi Giám đốc duyệt lúc {p.submittedAt ? format(new Date(p.submittedAt), 'HH:mm dd/MM/yyyy') : '—'}</span>
              </div>
            )}
          </>)}

        </div>
      </div>

      <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 20 }}>
        <AuditLogTimeline entries={getLogsFor(PROPOSAL_ENTITY, p.id)} />
      </div>

      {nccPanel && (() => {
        const prop = proposals.find(pr => pr.id === nccPanel.proposalId)
        const item = prop?.items.find(i => i.name === nccPanel.itemName)
        return (
          <CompareModal
            item={{ name: nccPanel.itemName, materialId: nccPanel.materialId, buyQty: item?.buyQty ?? 0, unit: item?.unit }}
            onClose={() => setNccPanel(null)}
            onChoose={(_, suppName, price, days) => {
              addRow(nccPanel.proposalId, nccPanel.itemName, suppName, price, days)
              setNccPanel(null)
            }}
          />
        )
      })()}
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <ClipboardList size={16} color="#d97706" />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>Đề xuất mua từ Quản lý SX</span>
        {newCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
            {newCount} mới
          </span>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>PO</th>
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
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{p.poNumber}</td>
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
