import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import { ChevronDown, ChevronUp, ChevronLeft, Send, Award, PackageCheck, Truck, Plus, X, ClipboardList, CheckCircle2 } from 'lucide-react'
import type { PurchaseOrder, PurchaseOrderItem, WarehouseReceipt } from '../../../types/purchase-order'
import { PO_STATUS_MAP } from '../../../types/purchase-order'
import { useInspection, type PurchaseProposal, type ProposalQuote } from '../../../context/InspectionContext'
import { format } from 'date-fns'

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])
const errMsg = (e: unknown) => (e as any)?.response?.data?.error ?? 'Lỗi xử lý'
const vnd = (n?: number | null) => (n == null ? '—' : n.toLocaleString('vi-VN') + 'đ')

interface Supplier { id: number; name: string }
interface SupplierLink { id: number; price?: number | null; leadTimeDays?: number | null; supplier?: Supplier | null }

// 1 dòng báo giá NCC cho 1 vật tư (NV mua hàng nhập nhiều dòng để GĐ so sánh)
interface QuoteDraft {
  supplierId: string
  supplierName: string
  unitPrice: string
  expectedDate: string
  note: string
}

function emptyQuote(): QuoteDraft {
  return { supplierId: '', supplierName: '', unitPrice: '', expectedDate: '', note: '' }
}

function seedQuotes(it: PurchaseOrderItem): QuoteDraft[] {
  if (it.quotes && it.quotes.length > 0) {
    return it.quotes.map(q => ({
      supplierId: q.supplierId ? String(q.supplierId) : '',
      supplierName: q.supplierId ? '' : (q.supplierName ?? ''),
      unitPrice: String(q.unitPrice ?? ''),
      expectedDate: q.expectedDate ? q.expectedDate.slice(0, 10) : '',
      note: q.note ?? '',
    }))
  }
  return [emptyQuote()]
}

export default function LenhMuaNCCPage() {
  const { proposals, acknowledgeProposal, submitProposalToDirector } = useInspection()
  const { data, isLoading, refetch } = useFetch<PurchaseOrder[]>(() => (api as any).getPurchaseOrders(), [])
  const { data: suppliers } = useFetch<Supplier[]>(() => api.getSuppliers(), [])
  const { data: receiptsData, refetch: refetchReceipts } = useFetch<WarehouseReceipt[]>(() => (api as any).getWarehouseReceipts(), [])
  const orders = safeArr(data).filter(o =>
    o.status === 'WAREHOUSE_CONFIRMED' || o.status === 'REJECTED' || o.status === 'PURCHASING' || o.status === 'PURCHASED'
  )
  const receipts = safeArr(receiptsData)

  const [expandedId, setExpandedId] = useState<number | null>(null)
  // quoteEdits[poId][itemId] = danh sách dòng báo giá NCC đang nhập
  const [quoteEdits, setQuoteEdits] = useState<Record<number, Record<number, QuoteDraft[]>>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [compareItem, setCompareItem] = useState<{ poId: number; item: PurchaseOrderItem } | null>(null)
  const { ask, confirmModal } = useConfirm()

  const toggle = (id: number) => setExpandedId(prev => prev === id ? null : id)

  const getQuotes = (poId: number, it: PurchaseOrderItem): QuoteDraft[] =>
    quoteEdits[poId]?.[it.id] ?? seedQuotes(it)

  const setQuotes = (poId: number, itemId: number, rows: QuoteDraft[]) =>
    setQuoteEdits(prev => ({ ...prev, [poId]: { ...(prev[poId] ?? {}), [itemId]: rows } }))

  const addQuoteRow = (po: PurchaseOrder, it: PurchaseOrderItem) =>
    setQuotes(po.id, it.id, [...getQuotes(po.id, it), emptyQuote()])

  const removeQuoteRow = (po: PurchaseOrder, it: PurchaseOrderItem, idx: number) =>
    setQuotes(po.id, it.id, getQuotes(po.id, it).filter((_, i) => i !== idx))

  const updateQuoteRow = (po: PurchaseOrder, it: PurchaseOrderItem, idx: number, patch: Partial<QuoteDraft>) =>
    setQuotes(po.id, it.id, getQuotes(po.id, it).map((r, i) => i === idx ? { ...r, ...patch } : r))

  const handleSubmit = (po: PurchaseOrder) => {
    const items = po.items.map(it => {
      const rows = getQuotes(po.id, it).filter(q => (q.supplierId || q.supplierName) && q.unitPrice)
      const quotes = rows.map(q => {
        const suppId = q.supplierId ? Number(q.supplierId) : undefined
        const suppName = suppId
          ? (safeArr(suppliers).find(s => s.id === suppId)?.name ?? q.supplierName)
          : q.supplierName
        return {
          supplierId: suppId,
          supplierName: suppName || 'NCC',
          unitPrice: Number(q.unitPrice),
          expectedDate: q.expectedDate ? new Date(q.expectedDate).toISOString() : undefined,
          note: q.note || undefined,
        }
      })
      return { id: it.id, quotes }
    })
    ask(
      { message: `Gửi đơn ${po.code} cho Giám đốc duyệt? Sau khi gửi sẽ không thể chỉnh sửa báo giá nữa.` },
      async () => {
        setBusy(po.id)
        try {
          await (api as any).submitPurchaseOrderForApproval(po.id, items)
          setExpandedId(null)
          refetch()
        } catch (e) {
          alert(errMsg(e))
        } finally {
          setBusy(null)
        }
      }
    )
  }

  const handleUpdateStatus = (po: PurchaseOrder, status: 'PURCHASING' | 'PURCHASED') => {
    const label = status === 'PURCHASED' ? 'Đã mua hàng' : 'Đang mua hàng'
    const extra = status === 'PURCHASED' ? ' Sau đó có thể tạo phiếu nhập kho.' : ''
    ask(
      { message: `Đánh dấu đơn ${po.code} là "${label}"?${extra}` },
      async () => {
        setBusy(po.id)
        try {
          await (api as any).updatePurchaseOrderPurchaseStatus(po.id, status)
          refetch()
        } catch (e) {
          alert(errMsg(e))
        } finally {
          setBusy(null)
        }
      }
    )
  }

  const handleCreateReceipt = (po: PurchaseOrder) => {
    ask(
      { message: `Tạo phiếu nhập kho cho đơn ${po.code}? Phiếu sẽ được gửi tới bộ phận kho để xác nhận nhận hàng.` },
      async () => {
        setBusy(po.id)
        try {
          await (api as any).createWarehouseReceiptForPO(po.id)
          refetch()
          refetchReceipts()
        } catch (e) {
          alert(errMsg(e))
        } finally {
          setBusy(null)
        }
      }
    )
  }

  const allFilled = (po: PurchaseOrder) =>
    po.items.every(it =>
      getQuotes(po.id, it).some(q => (q.supplierId || q.supplierName) && q.unitPrice)
    )

  if (isLoading) return <div style={{ padding: 32, color: 'var(--text3)' }}>Đang tải...</div>

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Lệnh mua — chọn NCC & báo giá</h2>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Nhập báo giá của nhiều nhà cung cấp cho từng vật tư (tối thiểu 1 NCC/vật tư), sau đó gửi Giám đốc so sánh và chọn duyệt.
      </div>

      {/* ── Đề xuất mua từ Quản lý SX ─────────────────────────────────────────── */}
      {proposals.length > 0 && (
        <ProposalSection
          proposals={proposals}
          onAcknowledge={acknowledgeProposal}
          onSubmitToDirector={submitProposalToDirector}
        />
      )}

      {orders.length === 0 && proposals.length === 0 && (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
          Không có lệnh mua nào cần xử lý
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orders.map(po => {
          const isExpanded = expandedId === po.id
          const st = PO_STATUS_MAP[po.status]
          const canSubmit = allFilled(po)
          return (
            <div key={po.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
              {/* Header */}
              <div
                onClick={() => toggle(po.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isExpanded ? '#ede7f6' : 'var(--surface)' }}
              >
                <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>{po.code}</span>
                {po.skuName && <span style={{ fontSize: 13, color: 'var(--text2)' }}>{po.skuName}</span>}
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: st.bg, color: st.color, fontWeight: 600 }}>
                  {st.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{po.items.length} vật tư</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {new Date(po.createdAt).toLocaleDateString('vi-VN')}
                </span>
                {isExpanded ? <ChevronUp size={16} color="var(--text3)" /> : <ChevronDown size={16} color="var(--text3)" />}
              </div>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {(po.status === 'WAREHOUSE_CONFIRMED' || po.status === 'REJECTED') && (<>
                  {po.status === 'REJECTED' && (
                    <div style={{ margin: '12px 16px 0', padding: '10px 14px', background: '#fce4ec', border: '1px solid #f48fb1', borderRadius: 8, fontSize: 13, color: '#c62828' }}>
                      <strong>Giám đốc từ chối:</strong> {po.rejectionReason || 'Không có lý do'}
                      <span style={{ marginLeft: 12, color: '#555', fontWeight: 400 }}>— Vui lòng chỉnh sửa NCC/giá và gửi lại.</span>
                    </div>
                  )}
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {po.items.map(it => {
                      const rows = getQuotes(po.id, it)
                      return (
                        <div key={it.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)' }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{it.materialName}</span>
                            <span style={{ fontSize: 12, color: '#c62828', fontWeight: 600 }}>Cần mua: {it.buyQty} {it.unit}</span>
                            <div style={{ flex: 1 }} />
                            <button
                              onClick={() => setCompareItem({ poId: po.id, item: it })}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', fontSize: 11, cursor: 'pointer', color: 'var(--text2)', whiteSpace: 'nowrap' }}
                            >
                              <Award size={11} /> Gợi ý NCC
                            </button>
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead>
                                <tr style={{ textAlign: 'left' }}>
                                  <th style={th}>Nhà cung cấp</th>
                                  <th style={{ ...th, minWidth: 130 }}>Đơn giá (đ)</th>
                                  <th style={{ ...th, minWidth: 140 }}>Ngày dự kiến về</th>
                                  <th style={th}>Ghi chú</th>
                                  <th style={{ ...th, textAlign: 'right' }}>Thành tiền</th>
                                  <th style={th}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((q, idx) => {
                                  const price = q.unitPrice ? Number(q.unitPrice) : null
                                  const total = price ? price * it.buyQty : null
                                  return (
                                    <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                                      <td style={td}>
                                        <select
                                          value={q.supplierId}
                                          onChange={ev => updateQuoteRow(po, it, idx, { supplierId: ev.target.value })}
                                          style={inp}
                                        >
                                          <option value="">— chọn NCC —</option>
                                          {safeArr(suppliers).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td style={td}>
                                        <input
                                          type="number"
                                          min={0}
                                          value={q.unitPrice}
                                          onChange={ev => updateQuoteRow(po, it, idx, { unitPrice: ev.target.value })}
                                          placeholder="VD: 85000"
                                          style={{ ...inp, width: 120 }}
                                        />
                                      </td>
                                      <td style={td}>
                                        <input
                                          type="date"
                                          value={q.expectedDate}
                                          onChange={ev => updateQuoteRow(po, it, idx, { expectedDate: ev.target.value })}
                                          style={{ ...inp, width: 130 }}
                                        />
                                      </td>
                                      <td style={td}>
                                        <input
                                          type="text"
                                          value={q.note}
                                          onChange={ev => updateQuoteRow(po, it, idx, { note: ev.target.value })}
                                          placeholder="VD: bảo hành, giao tận nơi..."
                                          style={inp}
                                        />
                                      </td>
                                      <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: total ? '#4527a0' : 'var(--text3)' }}>
                                        {vnd(total)}
                                      </td>
                                      <td style={td}>
                                        {rows.length > 1 && (
                                          <button
                                            onClick={() => removeQuoteRow(po, it, idx)}
                                            title="Xóa dòng báo giá"
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
                          <div style={{ padding: '6px 12px', background: 'var(--surface)' }}>
                            <button
                              onClick={() => addQuoteRow(po, it)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px dashed var(--border)', borderRadius: 6, background: 'none', fontSize: 12, cursor: 'pointer', color: '#4527a0', fontWeight: 600 }}
                            >
                              <Plus size={12} /> Thêm báo giá NCC
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                    {!canSubmit && (
                      <span style={{ fontSize: 12, color: '#e65100' }}>Cần chọn NCC và nhập đơn giá cho tất cả vật tư</span>
                    )}
                    <button
                      onClick={() => handleSubmit(po)}
                      disabled={!canSubmit || busy === po.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                        background: canSubmit ? '#4527a0' : '#e5e7eb',
                        color: canSubmit ? '#fff' : '#9ca3af',
                        cursor: canSubmit && busy !== po.id ? 'pointer' : 'not-allowed',
                        opacity: busy === po.id ? 0.7 : 1,
                      }}
                    >
                      <Send size={14} />
                      {busy === po.id ? 'Đang gửi...' : 'Gửi Giám đốc duyệt'}
                    </button>
                  </div>
                  </>)}

                  {(po.status === 'PURCHASING' || po.status === 'PURCHASED') && (
                    <PurchasingStatusPanel
                      po={po}
                      receipt={receipts.find(r => r.purchaseOrderId === po.id) ?? null}
                      busy={busy === po.id}
                      onUpdateStatus={s => handleUpdateStatus(po, s)}
                      onCreateReceipt={() => handleCreateReceipt(po)}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {compareItem && (
        <CompareModal
          item={compareItem.item}
          suppliers={safeArr(suppliers)}
          onClose={() => setCompareItem(null)}
          onChoose={(suppId, suppName, price, days) => {
            const { poId, item } = compareItem
            const expected = days
              ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
              : ''
            const newRow: QuoteDraft = {
              supplierId: String(suppId),
              supplierName: suppName,
              unitPrice: String(price ?? ''),
              expectedDate: expected,
              note: '',
            }
            const existing = getQuotes(poId, item)
            const isBlankFirst = existing.length === 1 && !existing[0].supplierId && !existing[0].supplierName && !existing[0].unitPrice
            setQuotes(poId, item.id, isBlankFirst ? [newRow] : [...existing, newRow])
            setCompareItem(null)
          }}
        />
      )}
      {confirmModal}
    </div>
  )
}

// ─── Panel: trạng thái mua hàng + tạo phiếu nhập ────────────────────────────

function PurchasingStatusPanel({ po, receipt, busy, onUpdateStatus, onCreateReceipt }: {
  po: PurchaseOrder
  receipt: WarehouseReceipt | null
  busy: boolean
  onUpdateStatus: (status: 'PURCHASING' | 'PURCHASED') => void
  onCreateReceipt: () => void
}) {
  const isPurchased = po.status === 'PURCHASED'

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ overflowX: 'auto', marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>Tên vật tư</th>
              <th style={{ ...th, textAlign: 'right' }}>SL mua</th>
              <th style={th}>ĐVT</th>
              <th style={th}>Nhà cung cấp</th>
              <th style={{ ...th, textAlign: 'right' }}>Đơn giá (đ)</th>
              <th style={th}>Ngày dự kiến về</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map(it => (
              <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 600 }}>{it.materialName}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{it.buyQty}</td>
                <td style={{ ...td, color: 'var(--text3)' }}>{it.unit}</td>
                <td style={td}>{it.supplierName ?? '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{vnd(it.unitPrice)}</td>
                <td style={td}>{it.expectedDate ? new Date(it.expectedDate).toLocaleDateString('vi-VN') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Trạng thái mua hàng:</span>
        {([
          ['PURCHASING', 'Đang mua hàng'],
          ['PURCHASED', 'Đã mua hàng'],
        ] as const).map(([val, label]) => {
          const active = po.status === val
          return (
            <button
              key={val}
              onClick={() => onUpdateStatus(val)}
              disabled={busy || active}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 20,
                border: active ? 'none' : '1px solid var(--border)',
                background: active ? (val === 'PURCHASED' ? '#2e7d32' : '#f57f17') : 'var(--surface)',
                color: active ? '#fff' : 'var(--text2)',
                cursor: busy || active ? 'default' : 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {receipt ? (
        <div style={{ padding: '10px 14px', background: receipt.status === 'RECEIVED' ? '#e0f2f1' : '#e3f2fd', border: `1px solid ${receipt.status === 'RECEIVED' ? '#80cbc4' : '#90caf9'}`, borderRadius: 8, fontSize: 13, color: receipt.status === 'RECEIVED' ? '#00695c' : '#1565c0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={15} />
          Đã tạo phiếu nhập <strong>{receipt.code}</strong> — {receipt.status === 'RECEIVED' ? 'Kho đã nhập kho xong' : 'Chờ kho xác nhận'}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onCreateReceipt}
            disabled={!isPurchased || busy}
            title={!isPurchased ? 'Chỉ tạo được phiếu nhập khi đã đánh dấu "Đã mua hàng"' : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: isPurchased ? '#4527a0' : '#e5e7eb',
              color: isPurchased ? '#fff' : '#9ca3af',
              cursor: isPurchased && !busy ? 'pointer' : 'not-allowed',
              opacity: busy ? 0.7 : 1,
            }}
          >
            <PackageCheck size={14} /> {busy ? 'Đang tạo...' : 'Tạo phiếu nhập'}
          </button>
          {!isPurchased && (
            <span style={{ fontSize: 12, color: '#e65100' }}>Cần đánh dấu "Đã mua hàng" trước khi tạo phiếu nhập</span>
          )}
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
            Vật tư này chưa gắn NCC nào. Vào "Vật tư – NCC" để thêm.
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

function ProposalSection({ proposals, onAcknowledge, onSubmitToDirector }: {
  proposals: PurchaseProposal[]
  onAcknowledge: (id: string) => void
  onSubmitToDirector: (id: string, quotes: Record<string, ProposalQuote[]>) => void
}) {
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

  const statusTag = (p: PurchaseProposal) => {
    if (p.status === 'new')       return <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 8px' }}>Chưa tiếp nhận</span>
    if (p.status === 'quoting')   return <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 6, padding: '2px 8px' }}>Đang báo giá</span>
    if (p.status === 'submitted') return <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, padding: '2px 8px' }}>Đã gửi GĐ</span>
    if (p.status === 'approved')  return <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#bbf7d0', border: '1px solid #4ade80', borderRadius: 6, padding: '2px 8px' }}>Đã duyệt</span>
    return <span style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '2px 8px' }}>Từ chối</span>
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const p = selected
    return (
      <div style={{ marginBottom: 24 }}>
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

          {/* ── SUBMITTED / APPROVED / REJECTED ── */}
          {(p.status === 'submitted' || p.status === 'approved' || p.status === 'rejected') && (<>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid #86efac', background: '#f0fdf4', fontSize: 13, color: '#166534' }}>
              <CheckCircle2 size={15} />
              <span>Đã gửi Giám đốc duyệt lúc {p.submittedAt ? format(new Date(p.submittedAt), 'HH:mm dd/MM/yyyy') : '—'}</span>
            </div>
          </>)}

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
