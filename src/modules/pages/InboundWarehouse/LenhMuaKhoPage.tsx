import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import { CheckCircle2, ChevronDown, ChevronUp, PackageSearch } from 'lucide-react'
import type { PurchaseOrder } from '../../../types/purchase-order'
import { PO_STATUS_MAP } from '../../../types/purchase-order'

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])
const errMsg = (e: unknown) => (e as any)?.response?.data?.error ?? 'Lỗi xử lý'

export default function LenhMuaKhoPage() {
  const { data, isLoading, refetch } = useFetch<PurchaseOrder[]>(() => (api as any).getPurchaseOrders(), [])
  const orders = safeArr(data).filter(o => o.status === 'PENDING_WAREHOUSE')
  const { data: warehouseItemsData } = useFetch<any[]>(() => (api as any).getAllMfgWarehouseItems(), [])
  const { data: reservationsData, refetch: refetchReservations } = useFetch<any[]>(() => (api as any).getWarehouseReservations(), [])

  const [expandedId, setExpandedId] = useState<number | null>(null)
  // stockActual edits keyed by item id
  const [stockEdits, setStockEdits] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [done, setDone] = useState<Set<number>>(new Set())
  const { ask, confirmModal } = useConfirm()

  // Tồn khả dụng = tồn thực tế trong kho - phần đã bị các lệnh mua khác giữ chỗ (ACTIVE)
  const getActualStock = (materialName: string) => {
    const norm = materialName.toLowerCase().trim()
    const onHand = safeArr(warehouseItemsData)
      .filter((w: any) => w.name?.toLowerCase().trim() === norm)
      .reduce((sum: number, w: any) => sum + (w.quantity ?? 0), 0)
    const reserved = safeArr(reservationsData)
      .filter((r: any) => r.status === 'ACTIVE' && r.materialName?.toLowerCase().trim() === norm)
      .reduce((sum: number, r: any) => sum + (r.quantity ?? 0), 0)
    return Math.max(0, onHand - reserved)
  }

  const toggle = (id: number) => {
    setExpandedId(prev => {
      const next = prev === id ? null : id
      if (next === id) {
        const po = orders.find(o => o.id === id)
        if (po) {
          setStockEdits(se => {
            const upd = { ...se }
            po.items.forEach(it => {
              if (upd[it.id] === undefined) upd[it.id] = String(getActualStock(it.materialName))
            })
            return upd
          })
        }
      }
      return next
    })
  }

  const setStock = (itemId: number, val: string) =>
    setStockEdits(prev => ({ ...prev, [itemId]: val }))

  const handleConfirm = (po: PurchaseOrder) => {
    const items = po.items.map(it => {
      const raw = Number(stockEdits[it.id] ?? 0)
      const stockActual = Number.isFinite(raw) ? Math.max(0, raw) : 0
      const buyQty = Math.max(0, it.requiredQty - stockActual)
      return { id: it.id, stockActual, buyQty }
    })
    const toBuy = items.filter(it => it.buyQty > 0).length
    ask(
      { message: `Xác nhận tồn kho thực tế và chuyển đơn ${po.code} (${toBuy} vật tư cần mua) sang bộ phận mua hàng? Sau khi xác nhận sẽ không sửa lại được.` },
      async () => {
        setBusy(po.id)
        try {
          const result = await (api as any).confirmPurchaseOrderByWarehouse(po.id, items)
          const adjusted = items.filter(sent => {
            const saved = result?.items?.find((i: any) => i.id === sent.id)
            return saved && saved.stockActual !== sent.stockActual
          })
          setDone(prev => new Set([...prev, po.id]))
          setExpandedId(null)
          refetch()
          refetchReservations()
          if (adjusted.length > 0) {
            alert(`Hệ thống đã tự điều chỉnh tồn thực tế cho ${adjusted.length} vật tư do vượt quá tồn khả dụng hiện có (đã có lệnh khác giữ chỗ). Số cần mua đã được tính lại tương ứng — vui lòng kiểm tra lại đơn ${po.code}.`)
          }
        } catch (e) {
          alert(errMsg(e))
        } finally {
          setBusy(null)
        }
      }
    )
  }

  if (isLoading) return <div style={{ padding: 32, color: 'var(--text3)' }}>Đang tải...</div>

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Lệnh mua — chờ kho xác nhận</h2>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Kiểm lại tồn kho thực tế, điều chỉnh số lượng cần mua rồi xác nhận để chuyển sang bộ phận mua hàng.
      </div>

      {orders.length === 0 && (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
          <PackageSearch size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div>Không có lệnh mua nào đang chờ xác nhận</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orders.map(po => {
          const isExpanded = expandedId === po.id
          const isDone = done.has(po.id)
          const st = PO_STATUS_MAP[po.status]
          return (
            <div key={po.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
              {/* Header row */}
              <div
                onClick={() => toggle(po.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isExpanded ? '#fffde7' : 'var(--surface)' }}
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

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                          <th style={th}>Tên vật tư</th>
                          <th style={{ ...th, textAlign: 'right' }}>KHSX yêu cầu</th>
                          <th style={{ ...th, textAlign: 'right', color: '#1565c0' }}>Tồn thực tế (kho)</th>
                          <th style={{ ...th, textAlign: 'right', color: '#c62828' }}>Cần mua</th>
                          <th style={th}>ĐVT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {po.items.map(it => {
                          const stockVal = stockEdits[it.id] ?? ''
                          const stockNum = stockVal !== '' ? Number(stockVal) : null
                          const buyQty = stockNum !== null ? Math.max(0, it.requiredQty - stockNum) : it.buyQty
                          return (
                            <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ ...td, fontWeight: 600 }}>{it.materialName}</td>
                              <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{it.requiredQty}</td>
                              <td style={{ ...td, textAlign: 'right' }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={stockVal}
                                  onChange={e => setStock(it.id, e.target.value)}
                                  placeholder="0"
                                  style={{ width: 80, padding: '4px 8px', border: '1px solid #90caf9', borderRadius: 6, fontSize: 13, textAlign: 'right', background: '#e3f2fd', color: '#1565c0', fontWeight: 600 }}
                                />
                              </td>
                              <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: buyQty > 0 ? '#c62828' : '#2e7d32' }}>
                                {buyQty}
                              </td>
                              <td style={{ ...td, color: 'var(--text3)' }}>{it.unit}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {po.note && (
                    <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text2)', borderTop: '1px solid var(--border)', background: '#fffde7' }}>
                      Ghi chú: {po.note}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                    <span style={{ fontSize: 12, color: '#1565c0' }}>
                      Tồn thực tế đã lấy tự động từ kho — có thể chỉnh lại nếu cần, hệ thống tự tính số lượng cần mua
                    </span>
                    <button
                      onClick={() => handleConfirm(po)}
                      disabled={busy === po.id || isDone}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                        background: isDone ? '#2e7d32' : '#e65100', color: '#fff',
                        cursor: busy === po.id ? 'not-allowed' : 'pointer',
                        opacity: busy === po.id ? 0.7 : 1,
                      }}
                    >
                      <CheckCircle2 size={15} />
                      {busy === po.id ? 'Đang xử lý...' : isDone ? 'Đã xác nhận' : 'Xác nhận & chuyển mua hàng'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {confirmModal}
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 14px' }
