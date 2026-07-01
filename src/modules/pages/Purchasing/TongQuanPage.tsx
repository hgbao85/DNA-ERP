import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import { ClipboardList, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import RefreshButton from '../../../components/RefreshButton'
import ReasonModal from '../../../components/ReasonModal'
import VatTuCanMuaPage from './VatTuCanMuaPage'
import { useAuth } from '../../../context/AuthContext'
import type { PurchaseOrder } from '../../../types/purchase-order'
import { PO_STATUS_MAP } from '../../../types/purchase-order'

interface Command {
  id: number; code: string; source: string; status: string; createdAt: string
  piCode?: string | null; poNumber?: string | null; productLabel?: string | null; itemCount: number
}

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])

const STEPS = [
  { key: 'QUOTING', label: 'Chờ báo giá' },
  { key: 'ORDERED', label: 'Đã đặt hàng' },
  { key: 'DONE',    label: 'Hoàn thành' },
]
const stepIndex = (s: string) => STEPS.findIndex(x => x.key === s)

function Progress({ status }: { status: string }) {
  const idx = stepIndex(status)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {STEPS.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div title={s.label} style={{
            width: 11, height: 11, borderRadius: '50%',
            background: i <= idx ? '#4527a0' : 'var(--border)',
          }} />
          {i < STEPS.length - 1 && <div style={{ width: 16, height: 2, background: i < idx ? '#4527a0' : 'var(--border)' }} />}
        </div>
      ))}
      <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: idx === 2 ? '#2e7d32' : '#4527a0' }}>
        {STEPS[idx]?.label ?? status}
      </span>
    </div>
  )
}

const sourceBadge = (src: string) => src === 'PI'
  ? { label: 'PI tự động', bg: '#ede7f6', fg: '#4527a0' }
  : { label: 'Đề xuất', bg: '#fff3e0', fg: '#e65100' }

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 12px', color: 'var(--text)' }

const vnd = (n?: number | null) => (n == null ? '—' : n.toLocaleString('vi-VN') + 'đ')

export default function TongQuanPage() {
  const { isManager } = useAuth()
  const { data: commands, isLoading, refetch } = useFetch<Command[]>(() => api.getPurchaseCommands())
  const { data: purchaseOrders, refetch: refetchPO } = useFetch<PurchaseOrder[]>(
    () => (api as any).getPurchaseOrders(), []
  )
  const list = safeArr(commands)
  const pendingApproval = safeArr(purchaseOrders).filter(o => o.status === 'PENDING_APPROVAL')

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [rejectModal, setRejectModal] = useState<PurchaseOrder | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busyPO, setBusyPO] = useState<number | null>(null)
  // quoteChoice[poId][itemId] = quoteId được GĐ chọn
  const [quoteChoice, setQuoteChoice] = useState<Record<number, Record<number, number>>>({})
  const { ask, confirmModal } = useConfirm()

  const cheapestQuoteId = (it: PurchaseOrder['items'][number]) =>
    [...(it.quotes ?? [])].sort((a, b) => a.unitPrice - b.unitPrice)[0]?.id

  const getChoice = (po: PurchaseOrder, it: PurchaseOrder['items'][number]) =>
    quoteChoice[po.id]?.[it.id] ?? cheapestQuoteId(it)

  const setChoice = (po: PurchaseOrder, itemId: number, quoteId: number) =>
    setQuoteChoice(prev => ({ ...prev, [po.id]: { ...(prev[po.id] ?? {}), [itemId]: quoteId } }))

  const handleApprovePO = (po: PurchaseOrder) => {
    const selections = po.items.map(it => ({ itemId: it.id, quoteId: getChoice(po, it) as number }))
    if (selections.some(s => !s.quoteId)) { alert('Còn vật tư chưa có báo giá NCC nào'); return }
    const total = po.items.reduce((s, it) => {
      const q = (it.quotes ?? []).find(q => q.id === getChoice(po, it))
      return s + (q ? q.unitPrice * it.buyQty : 0)
    }, 0)
    ask(
      { message: `Duyệt đơn mua ${po.code} với NCC đã chọn cho từng vật tư?\nTổng tiền: ${vnd(total || null)}` },
      async () => {
        setBusyPO(po.id)
        try {
          await (api as any).approvePurchaseOrder(po.id, selections)
          refetchPO()
        } catch { alert('Lỗi duyệt đơn') }
        finally { setBusyPO(null) }
      }
    )
  }

  const handleRejectPO = async () => {
    if (!rejectModal) return
    setBusyPO(rejectModal.id)
    try {
      await (api as any).rejectPurchaseOrder(rejectModal.id, rejectReason.trim() || undefined)
      setRejectModal(null)
      setRejectReason('')
      refetchPO()
    } catch { alert('Lỗi từ chối') }
    finally { setBusyPO(null) }
  }

  // Phân loại: "Cần xử lý" = QUOTING có items (itemCount > 0); còn lại xếp sau
  const urgent   = list.filter(c => c.status === 'QUOTING' && c.itemCount > 0)
  const inProgress = list.filter(c => c.status === 'ORDERED')
  const done     = list.filter(c => c.status === 'DONE')
  const noItems  = list.filter(c => c.status === 'QUOTING' && c.itemCount === 0)

  const ordered = [...urgent, ...inProgress, ...noItems, ...done]

  if (selectedId !== null) {
    return (
      <div>
        <button onClick={() => setSelectedId(null)} style={{ marginBottom: 14, fontSize: 13, color: '#4527a0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Quay lại danh sách
        </button>
        <VatTuCanMuaPage commandId={selectedId} />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Mã lệnh mua hàng</h2>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>
            Tự sinh khi tạo PI, hoặc khi thủ kho / Kế hoạch SX gửi đề xuất mua.
          </div>
        </div>
        <RefreshButton onRefresh={refetch} loading={isLoading} />
      </div>

      {/* ── Section duyệt đơn mua KHSX (chỉ GĐ) ── */}
      {isManager && pendingApproval.length > 0 && (
        <div style={{ marginBottom: 24, border: '2px solid #7c3aed', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: '#ede7f6', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} color="#4527a0" />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#4527a0' }}>
              {pendingApproval.length} đơn mua chờ duyệt
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pendingApproval.map((po, i) => {
              const st = PO_STATUS_MAP[po.status]
              return (
                <div key={po.id} style={{ padding: '14px 16px', borderTop: i > 0 ? '1px solid var(--border)' : undefined, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>{po.code}</span>
                    {po.skuName && <span style={{ fontSize: 13, color: 'var(--text2)' }}>{po.skuName}</span>}
                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 12, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {po.items.map(it => {
                      const quotes = [...(it.quotes ?? [])].sort((a, b) => a.unitPrice - b.unitPrice)
                      const cheapest = quotes[0]
                      const chosenId = getChoice(po, it)
                      return (
                        <div key={it.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                          <div style={{ padding: '6px 12px', background: 'var(--surface2)', fontSize: 13, fontWeight: 700, display: 'flex', gap: 10 }}>
                            <span>{it.materialName}</span>
                            <span style={{ color: '#c62828', fontWeight: 600 }}>Cần mua: {it.buyQty} {it.unit}</span>
                          </div>
                          {quotes.length === 0 ? (
                            <div style={{ padding: '8px 12px', fontSize: 12, color: '#e65100' }}>Chưa có báo giá NCC nào</div>
                          ) : (
                            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ color: 'var(--text3)' }}>
                                  <th style={{ padding: '4px 8px', width: 24 }}></th>
                                  <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'left' }}>NCC</th>
                                  <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>Đơn giá</th>
                                  <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'left' }}>Ngày dự kiến</th>
                                  <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'left' }}>Ghi chú</th>
                                  <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>Thành tiền</th>
                                </tr>
                              </thead>
                              <tbody>
                                {quotes.map(q => {
                                  const isChosen = chosenId === q.id
                                  const isCheapest = cheapest && q.id === cheapest.id
                                  return (
                                    <tr
                                      key={q.id}
                                      onClick={() => setChoice(po, it.id, q.id)}
                                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', background: isChosen ? '#f1f8e9' : undefined }}
                                    >
                                      <td style={{ padding: '4px 8px' }}>
                                        <input type="radio" checked={isChosen} onChange={() => setChoice(po, it.id, q.id)} />
                                      </td>
                                      <td style={{ padding: '4px 8px', fontWeight: isChosen ? 700 : 500 }}>
                                        {q.supplierName}
                                        {isCheapest && <span style={{ marginLeft: 6, fontSize: 10, color: '#2e7d32', fontWeight: 700 }}>★ rẻ nhất</span>}
                                      </td>
                                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{vnd(q.unitPrice)}</td>
                                      <td style={{ padding: '4px 8px', color: 'var(--text2)' }}>{q.expectedDate ? new Date(q.expectedDate).toLocaleDateString('vi-VN') : '—'}</td>
                                      <td style={{ padding: '4px 8px', color: 'var(--text2)' }}>{q.note ?? '—'}</td>
                                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: '#4527a0' }}>
                                        {vnd(q.unitPrice * it.buyQty)}
                                      </td>
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

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    {po.items.length > 0 && (
                      <span style={{ marginRight: 'auto', fontSize: 13 }}>
                        Tổng theo lựa chọn:{' '}
                        <strong style={{ color: '#4527a0' }}>
                          {vnd(po.items.reduce((s, it) => {
                            const q = (it.quotes ?? []).find(q => q.id === getChoice(po, it))
                            return s + (q ? q.unitPrice * it.buyQty : 0)
                          }, 0) || null)}
                        </strong>
                      </span>
                    )}
                    <button
                      onClick={() => { setRejectModal(po); setRejectReason('') }}
                      disabled={busyPO === po.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#fce4ec', border: '1px solid #ef9a9a', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#c62828', cursor: 'pointer' }}
                    >
                      <XCircle size={14} /> Từ chối
                    </button>
                    <button
                      onClick={() => handleApprovePO(po)}
                      disabled={busyPO === po.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#2e7d32', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', opacity: busyPO === po.id ? 0.7 : 1 }}
                    >
                      <CheckCircle2 size={14} /> {busyPO === po.id ? 'Đang duyệt...' : 'Duyệt'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Banner cần xử lý */}
      {urgent.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}>
          <AlertCircle size={16} color="#e65100" />
          <span><strong>{urgent.length} lệnh</strong> đang chờ báo giá &amp; chọn nhà cung cấp — xử lý sớm để không chậm tiến độ SX.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Chờ xử lý', count: urgent.length, bg: '#fff3e0', fg: '#e65100' },
          { label: 'Đang mua', count: inProgress.length, bg: '#e3f2fd', fg: '#1565c0' },
          { label: 'Hoàn thành', count: done.length, bg: '#e8f5e9', fg: '#2e7d32' },
        ].map(s => (
          <div key={s.label} style={{ padding: '6px 14px', background: s.bg, borderRadius: 20, fontSize: 12, fontWeight: 700, color: s.fg }}>
            {s.count} · {s.label}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ClipboardList size={14} /> {isLoading ? 'Đang tải…' : `${list.length} mã lệnh`}
      </div>

      {/* Modal từ chối đơn mua */}
      <ReasonModal
        open={!!rejectModal}
        title={`Từ chối đơn mua — ${rejectModal?.code ?? ''}`}
        description="Nhập lý do từ chối (không bắt buộc)"
        reason={rejectReason}
        onReasonChange={setRejectReason}
        placeholder="VD: Giá quá cao, cần báo giá lại..."
        onCancel={() => setRejectModal(null)}
        onConfirm={handleRejectPO}
        busy={!!busyPO}
        confirmColor="#c62828"
      />

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
            <th style={th}>Mã lệnh</th>
            <th style={th}>Nguồn</th>
            <th style={th}>Sản phẩm / PO</th>
            <th style={th}>Vật tư</th>
            <th style={th}>Tiến trình</th>
            <th style={th}>Ngày tạo</th>
            <th style={th} />
          </tr></thead>
          <tbody>
            {ordered.map(c => {
              const sb = sourceBadge(c.source)
              const isUrgent = c.status === 'QUOTING' && c.itemCount > 0
              return (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)', background: isUrgent ? '#fffdf7' : undefined }}>
                  <td style={{ ...td, fontWeight: 700 }}>
                    {isUrgent && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#e65100', marginRight: 6 }} />}
                    {c.code}
                    {c.piCode && <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}> · {c.piCode}</span>}
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: sb.bg, color: sb.fg, fontWeight: 600 }}>{sb.label}</span>
                  </td>
                  <td style={td}>
                    <div>{c.productLabel || '—'}</div>
                    {c.poNumber && <div style={{ fontSize: 11, color: 'var(--text3)' }}>PO: {c.poNumber}</div>}
                  </td>
                  <td style={td}>
                    {c.itemCount > 0
                      ? <span style={{ fontWeight: 600, color: '#4527a0' }}>{c.itemCount} loại</span>
                      : <span style={{ color: 'var(--text3)', fontSize: 12 }}>Chưa có</span>}
                  </td>
                  <td style={td}><Progress status={c.status} /></td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{new Date(c.createdAt).toLocaleDateString('vi-VN')}</td>
                  <td style={td}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      style={{ padding: '4px 12px', background: '#ede7f6', border: 'none', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, color: '#4527a0', cursor: 'pointer' }}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              )
            })}
            {!isLoading && list.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>
                Chưa có mã lệnh nào. Tạo PI ở Sản xuất → mã lệnh sẽ tự xuất hiện.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {confirmModal}
    </div>
  )
}
