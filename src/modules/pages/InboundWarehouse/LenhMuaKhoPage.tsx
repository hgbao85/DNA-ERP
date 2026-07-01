import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import { CheckCircle2, ChevronDown, ChevronUp, PackageSearch, XCircle } from 'lucide-react'
import type { PurchaseOrder } from '../../../types/purchase-order'
import { PO_STATUS_MAP } from '../../../types/purchase-order'
import type { PlanForm } from '../../../types/plan-form'
import { safeArr } from '../../../utils/array'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'
import EmptyState from '../../../components/EmptyState'
import ReasonModal from '../../../components/ReasonModal'
import Modal from '../../../components/Modal'
import { th, td } from '../../../styles/table'
import { btnSecondary } from '../../../styles/buttons'

export default function LenhMuaKhoPage() {
  const { data, isLoading, refetch } = useFetch<PurchaseOrder[]>(() => (api as any).getPurchaseOrders(), [])
  const orders = safeArr(data).filter(o => o.status === 'PENDING_WAREHOUSE')
  const { data: warehouseItemsData } = useFetch<any[]>(() => (api as any).getAllMfgWarehouseItems(), [])
  const { data: reservationsData, refetch: refetchReservations } = useFetch<any[]>(() => (api as any).getWarehouseReservations(), [])
  const { data: planForms } = useFetch<PlanForm[]>(() => api.getPlanForms(), [])

  const [expandedId, setExpandedId] = useState<number | null>(null)
  // stockActual edits keyed by item id
  const [stockEdits, setStockEdits] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [rejectModal, setRejectModal] = useState<PurchaseOrder | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const { ask, confirmModal } = useConfirm()

  // ── Kiểm vật tư theo SKU (chuyển từ Kế hoạch SX sang, dùng để chủ động tạo lệnh mua khi phát hiện thiếu) ──
  const [selectedSkuId, setSelectedSkuId] = useState<number | ''>('')
  const selectedSku = safeArr(planForms).find(pf => pf.id === selectedSkuId) ?? null
  type SkuCheckState = 'idle' | 'checking' | 'ok' | 'missing'
  const [skuCheckState, setSkuCheckState] = useState<SkuCheckState>('idle')
  const [missingMats, setMissingMats] = useState<{ name: string; required: number; unit: string; available: number }[]>([])
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [submittingBuy, setSubmittingBuy] = useState(false)
  const [buyDone, setBuyDone] = useState<PurchaseOrder | null>(null)

  const resetSkuCheck = () => { setSkuCheckState('idle'); setMissingMats([]); setBuyDone(null) }

  const handleCheckSku = () => {
    if (!selectedSku) return
    setSkuCheckState('checking')
    const mt = selectedSku.quotaManagement?.materialType
    const required: { name: string; required: number; unit: string }[] = []
    ;(Array.isArray(mt?.sat) ? mt!.sat : []).forEach((i: any) => {
      if (i.name) required.push({ name: i.name, required: i.quantity ?? 1, unit: i.unit ?? '' })
    })
    ;(Array.isArray(mt?.daySon) ? mt!.daySon : []).forEach((i: any) => {
      if (i.name) required.push({ name: i.name, required: i.kg ?? i.quantity ?? 1, unit: i.unit ?? 'kg' })
    })
    ;(Array.isArray(mt?.vatTuPhuKien) ? mt!.vatTuPhuKien : []).forEach((i: any) => {
      if (i.name) required.push({ name: i.name, required: i.quantity ?? 1, unit: i.unit ?? 'cái' })
    })
    ;(Array.isArray(mt?.baoBiDongGoi) ? mt!.baoBiDongGoi : []).forEach((i: any) => {
      if (i.name) required.push({ name: i.name, required: i.quantity ?? 1, unit: i.unit ?? 'thùng' })
    })
    // Tồn khả dụng = tồn thực tế - phần đã bị các lệnh mua khác (không phải của chính SKU này) giữ chỗ (ACTIVE)
    const ownPOIds = new Set(
      safeArr(data).filter(po => po.source === 'KHSX' && po.sourceRef === String(selectedSku.id)).map(po => po.id)
    )
    const missing = required.flatMap(req => {
      const norm = req.name.toLowerCase().trim()
      const onHand = safeArr(warehouseItemsData)
        .filter((w: any) => w.name?.toLowerCase().trim() === norm)
        .reduce((sum: number, w: any) => sum + (w.quantity ?? 0), 0)
      const reserved = safeArr(reservationsData)
        .filter((r: any) => r.status === 'ACTIVE' && !ownPOIds.has(r.sourcePOId) && r.materialName?.toLowerCase().trim() === norm)
        .reduce((sum: number, r: any) => sum + (r.quantity ?? 0), 0)
      const avail = Math.max(0, onHand - reserved)
      return avail < req.required ? [{ ...req, available: avail }] : []
    })
    setMissingMats(missing)
    setSkuCheckState(missing.length === 0 ? 'ok' : 'missing')
  }

  const handleCreatePOFromSku = async () => {
    if (!selectedSku) return
    setSubmittingBuy(true)
    try {
      const po = await (api as any).createPurchaseOrder({
        source: 'KHSX',
        sourceRef: String(selectedSku.id),
        skuName: selectedSku.mfgProduct?.name ?? undefined,
        note: `Từ SKU ${selectedSku.mfgProduct?.factoryCode ?? selectedSku.id}`,
        items: missingMats.map(m => ({
          materialName: m.name,
          unit: m.unit,
          requiredQty: m.required,
          buyQty: m.required - m.available,
        })),
      })
      setBuyDone(po)
      setShowBuyModal(false)
      refetch()
      refetchReservations()
    } catch (e) {
      alert(errMsg(e, 'Không thể tạo lệnh mua hàng'))
    } finally {
      setSubmittingBuy(false)
    }
  }

  // Tồn khả dụng = tồn thực tế trong kho - phần đã bị các lệnh mua KHÁC giữ chỗ (ACTIVE)
  // Bỏ qua chỗ mà chính lệnh đang xét (poId) đã giữ — vì đó là giữ chỗ tạm từ lúc tạo lệnh, không phải nhu cầu cạnh tranh
  const getActualStock = (materialName: string, poId: number) => {
    const norm = materialName.toLowerCase().trim()
    const onHand = safeArr(warehouseItemsData)
      .filter((w: any) => w.name?.toLowerCase().trim() === norm)
      .reduce((sum: number, w: any) => sum + (w.quantity ?? 0), 0)
    const reserved = safeArr(reservationsData)
      .filter((r: any) => r.status === 'ACTIVE' && r.sourcePOId !== poId && r.materialName?.toLowerCase().trim() === norm)
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
              if (upd[it.id] === undefined) upd[it.id] = String(getActualStock(it.materialName, po.id))
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

  const handleRejectPO = async () => {
    if (!rejectModal) return
    setRejecting(true)
    try {
      await (api as any).rejectPurchaseOrder(rejectModal.id, rejectReason.trim() || undefined)
      setRejectModal(null)
      setRejectReason('')
      setExpandedId(null)
      refetch()
      refetchReservations()
    } catch (e) {
      alert(errMsg(e))
    } finally {
      setRejecting(false)
    }
  }

  if (isLoading) return <LoadingState variant="block" />

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Lệnh mua — chờ kho xác nhận</h2>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Kiểm lại tồn kho thực tế, điều chỉnh số lượng cần mua rồi xác nhận để chuyển sang bộ phận mua hàng.
      </div>

      {/* Kiểm vật tư theo SKU */}
      <div style={{ marginBottom: 24, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
        <div style={{ padding: '12px 16px', background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Kiểm vật tư theo SKU</span>
          <select
            value={selectedSkuId}
            onChange={e => { setSelectedSkuId(e.target.value ? Number(e.target.value) : ''); resetSkuCheck() }}
            style={{ padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', minWidth: 260 }}
          >
            <option value="">— Chọn SKU —</option>
            {safeArr(planForms).map(pf => (
              <option key={pf.id} value={pf.id}>{pf.mfgProduct?.factoryCode ?? pf.id} — {pf.mfgProduct?.name ?? ''}</option>
            ))}
          </select>
          <button
            onClick={handleCheckSku}
            disabled={!selectedSku || skuCheckState === 'checking'}
            style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', cursor: selectedSku ? 'pointer' : 'not-allowed', opacity: selectedSku ? 1 : 0.5 }}
          >
            {skuCheckState === 'checking' ? 'Đang kiểm...' : 'Kiểm tra tồn kho'}
          </button>
        </div>

        {skuCheckState === 'missing' && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div style={{ background: '#fee2e2', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#dc2626' }}>⚠ Thiếu {missingMats.length} loại vật tư</span>
              <button
                onClick={() => setShowBuyModal(true)}
                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#e65100', color: '#fff' }}
              >Mua hàng</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fff5f5' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>Tên vật tư</th>
                  <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>Cần</th>
                  <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>Tồn kho</th>
                  <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>Thiếu</th>
                </tr>
              </thead>
              <tbody>
                {missingMats.map((m, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #fee2e2' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 500 }}>{m.name}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--text2)' }}>{m.required} {m.unit}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', color: '#dc2626' }}>{m.available} {m.unit}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>+{m.required - m.available} {m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {skuCheckState === 'ok' && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
            ✓ Đủ vật tư trong kho cho SKU này
          </div>
        )}
        {buyDone && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', fontSize: 12, color: '#e65100', fontWeight: 600, background: '#fff3e0' }}>
            ✓ Đã tạo lệnh mua <strong>{(buyDone as any).code}</strong> — xem trong danh sách bên dưới
          </div>
        )}
      </div>

      {orders.length === 0 && (
        <EmptyState
          icon={<PackageSearch size={32} style={{ opacity: 0.3, marginBottom: 8 }} />}
          message="Không có lệnh mua nào đang chờ xác nhận"
        />
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
                      onClick={() => { setRejectModal(po); setRejectReason('') }}
                      disabled={busy === po.id || isDone}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 16px', background: '#fce4ec', border: '1px solid #ef9a9a', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#c62828', cursor: 'pointer' }}
                    >
                      <XCircle size={14} /> Từ chối
                    </button>
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

      {/* Modal từ chối lệnh mua */}
      <ReasonModal
        open={!!rejectModal}
        title={`Từ chối lệnh mua — ${rejectModal?.code ?? ''}`}
        description="Lệnh sẽ chuyển sang trạng thái từ chối và phần tồn kho đã giữ chỗ cho lệnh này sẽ được giải phóng. Nhập lý do (không bắt buộc)."
        reason={rejectReason}
        onReasonChange={setRejectReason}
        placeholder="VD: Sai thông tin vật tư, lệnh trùng lặp..."
        onCancel={() => setRejectModal(null)}
        onConfirm={handleRejectPO}
        busy={rejecting}
        confirmColor="#c62828"
      />

      {/* Modal mua hàng */}
      <Modal open={showBuyModal} onClose={() => setShowBuyModal(false)} maxWidth={560} zIndex={2000}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Xác nhận tạo đề xuất mua hàng</h3>
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>SKU cần mua vật tư</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', fontSize: 13 }}>
            <span><span style={{ color: '#92400e' }}>Mã nhà máy: </span><strong>{selectedSku?.mfgProduct?.factoryCode ?? '—'}</strong></span>
            <span><span style={{ color: '#92400e' }}>Sản phẩm: </span><strong>{selectedSku?.mfgProduct?.name ?? '—'}</strong></span>
            {selectedSku?.customerName && <span><span style={{ color: '#92400e' }}>Khách hàng: </span><strong>{selectedSku.customerName}</strong></span>}
          </div>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text3)', fontSize: 12 }}>Tên vật tư</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: 12 }}>Cần</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: 12 }}>Tồn kho</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text3)', fontSize: 12 }}>Cần mua thêm</th>
              </tr>
            </thead>
            <tbody>
              {missingMats.map((m, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 500 }}>{m.name}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text2)' }}>{m.required} {m.unit}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#dc2626' }}>{m.available} {m.unit}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#e65100' }}>+{m.required - m.available} {m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setShowBuyModal(false)} style={btnSecondary}>Hủy</button>
          <button
            onClick={handleCreatePOFromSku}
            disabled={submittingBuy}
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: submittingBuy ? 'not-allowed' : 'pointer', background: '#e65100', color: '#fff', opacity: submittingBuy ? 0.7 : 1 }}
          >{submittingBuy ? 'Đang gửi...' : 'Xác nhận'}</button>
        </div>
      </Modal>
    </div>
  )
}
