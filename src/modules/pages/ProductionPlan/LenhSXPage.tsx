import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { StatusBadge } from '../Sales/StatusBadge'
import type { SalesPOStatus } from '../../../types/sales'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2, X, CalendarClock, Pencil, Play, ChevronRight, ChevronLeft, Search, Clock, XCircle, ThumbsUp, ThumbsDown, Warehouse } from 'lucide-react'
import SearchableSelect from '../../../components/SearchableSelect'
import { isThanhPhamScope } from '../Manufacturing/MfgWarehousesPage'

/**
 * Khi Sếp (boss@demo.com) DUYỆT 1 SKU cụ thể trong PI (sau khi KHSX gửi duyệt), tạo
 * (hoặc tái dùng) 1 PlanForm cho đúng SKU đó — đây là dữ liệu duy nhất mà "Lệnh kiểm
 * tra vật tư" của prodmgr@demo.com đọc (api.getPlanForms(), lọc status !== 'DRAFT').
 * PlanForm cần exportOrderId/mfgProductId trỏ tới bản ghi thật để enrich() ra đúng
 * mã PO/SKU, nên tìm bản ghi đã có theo mã, không có thì tạo mới.
 */
async function ensurePlanFormForConfirmedItem(pi: any, item: any) {
  const factoryCode = item.productVariant?.mfgProduct?.factoryCode
  const productName = item.productVariant?.mfgProduct?.name ?? ''
  const poNumber = pi.exportOrder?.poNumber ?? pi.code
  const deliveryDate = item.deliveryDeadline ?? pi.deadline

  const mfgProducts = (await api.getMfgProducts()) as any[]
  const mfgProduct = mfgProducts.find((p) => p.factoryCode === factoryCode)
    ?? await api.createMfgProduct({ factoryCode, name: productName })

  const exportOrders = (await api.getExportOrders()) as any[]
  const exportOrder = exportOrders.find((o) => o.poNumber === poNumber)
    ?? await api.createExportOrder({ poNumber, deliveryDate, status: 'PLANNED' })

  const created = await api.createPlanForm({
    exportOrderId: exportOrder.id,
    mfgProductId: mfgProduct.id,
    customerName: pi.exportOrder?.customerName,
    origin: 'PRODUCTION_CONFIRM',
    productionInvoiceId: pi.id,
  })

  // Định mức chi tiết (BOM) là thuộc tính của SKU (mfgProduct), không đổi theo
  // từng PO — PlanForm mới tạo mặc định trống, nên tái dùng định mức đã có sẵn
  // của cùng SKU này (nếu có) thay vì để trống, để "kiểm tra vật tư" có dữ liệu.
  const existingPlanForms = (await api.getPlanForms()) as any[]
  const sourceMaterialType = existingPlanForms.find(
    (pf) => pf.id !== created.id && pf.mfgProductId === mfgProduct.id && pf.quotaManagement?.materialType,
  )?.quotaManagement?.materialType
  if (sourceMaterialType) {
    for (const group of ['sat', 'daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as const) {
      const groupItems = sourceMaterialType[group]
      if (Array.isArray(groupItems) && groupItems.length > 0) {
        await api.updatePlanFormDetailQuota(created.id, group, groupItems, 'Hệ thống')
      }
    }
  }
}

export default function LenhSXPage() {
  const { user, isBoss } = useAuth()
  const isQlsx = user?.mfgRole === 'PRODUCTION_MANAGER'
  const [confirmingProdId, setConfirmingProdId] = useState<number | null>(null)
  const [confirmProdTarget, setConfirmProdTarget] = useState<any | null>(null)
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null)
  const [approvingKey, setApprovingKey] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<{ pi: any; idx: number } | null>(null)
  const [rejectTarget, setRejectTarget] = useState<{ pi: any; idx: number } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [qlsxTarget, setQlsxTarget] = useState<{ pi: any; idx: number } | null>(null)
  const [qlsxWarehouseCode, setQlsxWarehouseCode] = useState<string | null>(null)
  const [sendingToBoss, setSendingToBoss] = useState(false)
  const [editingPI, setEditingPI] = useState<any | null>(null)
  const [editValues, setEditValues] = useState<{ deadline: string; items: { materialDeadline: string; deliveryDeadline: string; HAN: string; WEAVING: string; SON: string }[] }>({ deadline: '', items: [] })
  const [savingPI, setSavingPI] = useState(false)
  const [viewingPIId, setViewingPIId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const { data: pis, isLoading, error, refetch } = useFetch(
    () => api.getProductionInvoices(),
    []
  )
  const hasItemWithStatus = (p: any, status: string) => (Array.isArray(p.items) ? p.items : []).some((it: any) => it.prodApproval?.status === status)
  // Boss/QLSX chỉ cần thấy PO có SKU đang chờ mình xử lý — không quan tâm PO chưa gửi/đã xử lý xong.
  const safeList = (Array.isArray(pis) ? pis : []).filter((p: any) => p.status === 'PLANNING' && (
    isBoss ? hasItemWithStatus(p, 'WAITING_BOSS') : isQlsx ? hasItemWithStatus(p, 'WAITING_QLSX') : true
  ))
  const filteredList = search.trim()
    ? safeList.filter((p: any) => (p.code ?? '').toLowerCase().includes(search.trim().toLowerCase()) || (p.exportOrder?.poNumber ?? '').toLowerCase().includes(search.trim().toLowerCase()))
    : safeList
  const viewingPI = viewingPIId ? (Array.isArray(pis) ? pis : []).find((p: any) => p.id === viewingPIId) ?? null : null
  const getDisplayCode = (item: any) => item?.exportOrder?.poNumber || item?.poNumber || item?.code || '—'

  // Boss/QLSX xử lý thẳng theo SKU, không cần chui vào từng PO — gộp phẳng tất cả SKU đang chờ
  // mình xử lý từ mọi PO thành 1 bảng duy nhất.
  const relevantStatus = isBoss ? 'WAITING_BOSS' : 'WAITING_QLSX'
  const flatRows = (isBoss || isQlsx)
    ? filteredList.flatMap((pi: any) => (Array.isArray(pi.items) ? pi.items : [])
        .map((item: any, idx: number) => ({ pi, item, idx }))
        .filter(({ item }: any) => item.prodApproval?.status === relevantStatus))
    : []

  // Kho thành phẩm — QLSX chọn làm điểm cuối trước khi gửi sếp duyệt. Mỗi kho thành phẩm (1, 2, 3...)
  // gắn với 1 tài khoản thủ kho riêng (warehouseScope) — đây mới là danh sách kho thành phẩm thật
  // (có thể tạo thêm ở trang "Tổng hợp kho"), khác với `getMfgWarehouses()` chỉ có đúng 1 bản ghi cố định.
  const { data: warehouseUsers } = useFetch(
    () => (isQlsx ? api.getUsers() : Promise.resolve([])),
    []
  )
  const finishedGoodsWarehouses = (Array.isArray(warehouseUsers) ? warehouseUsers : [])
    // Nhân viên mua hàng (isPurchaser) cũng được gán warehouseScope 'thanh-pham' để theo dõi mua hàng
    // theo phạm vi kho — không phải thủ kho, phải loại ra khỏi danh sách kho thành phẩm thật.
    .filter((u: any) => u.role === 'WAREHOUSE_STAFF' && !u.isPurchaser && isThanhPhamScope(u.warehouseScope))
    .map((u: any) => ({ code: u.warehouseScope as string, name: (u.name as string).replace(/^Thủ kho /, 'Kho ') }))

  // KHSX gửi 1 SKU cho QLSX xử lý — chưa cho sản xuất, QLSX sẽ chọn kho thành phẩm rồi mới trình sếp.
  const handleSendForApproval = async (id: number) => {
    setConfirmingProdId(id)
    try {
      const items: any[] = confirmProdTarget?.items ?? []
      if (selectedItemIdx === null || !items[selectedItemIdx]) return
      await api.sendItemToQlsx(id, selectedItemIdx, user?.name)
      refetch()
      setConfirmProdTarget(null)
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? 'Lỗi gửi QLSX')
    } finally {
      setConfirmingProdId(null)
    }
  }

  // QLSX chọn kho thành phẩm làm điểm cuối rồi gửi sếp duyệt lần cuối.
  const handleQlsxSendToBoss = async () => {
    if (!qlsxTarget || qlsxWarehouseCode === null) return
    const wh = finishedGoodsWarehouses.find((w: any) => w.code === qlsxWarehouseCode)
    if (!wh) return
    setSendingToBoss(true)
    try {
      await api.sendItemToBoss(qlsxTarget.pi.id, qlsxTarget.idx, { code: wh.code, name: wh.name }, user?.name)
      refetch()
      setQlsxTarget(null)
      setQlsxWarehouseCode(null)
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? 'Lỗi gửi sếp duyệt')
    } finally {
      setSendingToBoss(false)
    }
  }

  // Sếp duyệt 1 SKU đang chờ — SKU đó mới thực sự bắt đầu sản xuất (hiện ở "Lệnh kiểm tra vật tư").
  const handleApproveItem = async (pi: any, idx: number) => {
    const items: any[] = pi.items ?? []
    const item = items[idx]
    if (!item) return
    setApprovingKey(`${pi.id}-${idx}`)
    try {
      await ensurePlanFormForConfirmedItem(pi, item)
      await api.approveItemByBoss(pi.id, idx, user?.name)
      refetch()
      setApproveTarget(null)
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? 'Lỗi duyệt sản xuất')
    } finally {
      setApprovingKey(null)
    }
  }

  // Sếp từ chối 1 SKU đang chờ — KHSX sẽ sửa lại thời hạn rồi gửi lại.
  const handleRejectItem = async () => {
    if (!rejectTarget) return
    const reason = rejectReason.trim()
    if (!reason) { alert('Vui lòng nhập lý do từ chối'); return }
    const { pi, idx } = rejectTarget
    setRejecting(true)
    try {
      await api.rejectProdItem(pi.id, idx, reason, user?.name)
      refetch()
      setRejectTarget(null)
      setRejectReason('')
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Lỗi từ chối sản xuất')
    } finally {
      setRejecting(false)
    }
  }

  const openPIEdit = (pi: any) => {
    const piDeadline = new Date(pi.deadline)
    const stgDate = (item: any, type: string) => {
      const s = Array.isArray(item.stages) ? item.stages.find((x: any) => x.stageType === type) : null
      return s?.deadline ? format(new Date(s.deadline), 'yyyy-MM-dd') : ''
    }
    setEditingPI(pi)
    setEditValues({
      deadline: format(piDeadline, 'yyyy-MM-dd'),
      items: (Array.isArray(pi.items) ? pi.items : []).map((item: any) => ({
        materialDeadline: item.materialDeadline ? format(new Date(item.materialDeadline), 'yyyy-MM-dd') : '',
        deliveryDeadline: item.deliveryDeadline  ? format(new Date(item.deliveryDeadline),  'yyyy-MM-dd') : '',
        HAN:     stgDate(item, 'HAN'),
        WEAVING: stgDate(item, 'WEAVING'),
        SON:     stgDate(item, 'SON'),
      })),
    })
  }

  const handleSavePI = async () => {
    if (!editingPI || !editValues.deadline) return
    setSavingPI(true)
    try {
      const updatedItems = (Array.isArray(editingPI.items) ? editingPI.items : []).map((item: any, idx: number) => {
        const vals = editValues.items[idx]
        if (!vals) return item
        const stages: any[] = Array.isArray(item.stages) ? [...item.stages] : []
        for (const field of ['HAN', 'WEAVING', 'SON'] as const) {
          const val = vals[field]
          if (!val) continue
          const iso = new Date(val).toISOString()
          const si = stages.findIndex((s: any) => s.stageType === field)
          if (si >= 0) stages[si] = { ...stages[si], deadline: iso }
          else stages.push({ stageType: field, deadline: iso, progressPercent: 0, status: 'PENDING' })
        }
        return {
          ...item,
          materialDeadline: vals.materialDeadline ? new Date(vals.materialDeadline).toISOString() : item.materialDeadline,
          deliveryDeadline: vals.deliveryDeadline ? new Date(vals.deliveryDeadline).toISOString() : undefined,
          stages,
        }
      })
      const itemDls = editValues.items
        .map(it => it.deliveryDeadline ? new Date(it.deliveryDeadline) : null)
        .filter(Boolean) as Date[]
      const piDeadlineComputed = itemDls.length > 0
        ? itemDls.reduce((max, d) => d > max ? d : max, itemDls[0])
        : new Date(editValues.deadline)
      await api.updateProductionInvoice(editingPI.id, {
        deadline: piDeadlineComputed.toISOString(),
        items: updatedItems,
      })
      refetch()
      setEditingPI(null)
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Lỗi lưu thời hạn')
    } finally {
      setSavingPI(false)
    }
  }

  if (isLoading) return <div style={{ padding:40, color:'var(--text3)' }}>Đang tải...</div>
  if (error) return (
    <div style={{ padding:40, color:'#c62828', display:'flex', alignItems:'center', gap:8 }}>
      <AlertCircle size={18}/> Lỗi tải dữ liệu
    </div>
  )

  return (
    <div>

      {isBoss || isQlsx ? (
        /* ── DUYỆT/XỬ LÝ SKU (bảng phẳng — hiện thẳng SKU của mọi PO, không cần chui vào từng PO) ── */
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>{isBoss ? 'Duyệt lệnh sản xuất' : 'Xử lý lệnh sản xuất'}</h2>
              <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--text3)' }}>{flatRows.length} SKU chờ {isBoss ? 'duyệt' : 'xử lý'}</p>
            </div>
            <div style={{ position:'relative' }}>
              <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm mã PO..."
                style={{ padding:'7px 10px 7px 32px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, background:'var(--surface)', color:'var(--text)', width:200, outline:'none' }}
              />
            </div>
          </div>

          <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 95px 95px 95px 95px 100px 200px', padding:'10px 18px', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px' }}>PO</span>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px' }}>SKU</span>
              {['Mua hàng','Khung CK','Đan','Đóng gói'].map(h => (
                <span key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</span>
              ))}
              <span style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>Hạn giao</span>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>Thao tác</span>
            </div>
            {flatRows.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Không có SKU chờ {isBoss ? 'duyệt' : 'xử lý'}</div>
            ) : flatRows.map(({ pi, item, idx }: any, i: number) => {
              const code = item.productVariant?.mfgProduct?.factoryCode ?? '—'
              const name = item.productVariant?.mfgProduct?.name ?? ''
              const color = item.productVariant?.colorCode
              const qty  = item.quantity
              const isLast = i === flatRows.length - 1
              const piDeadline = new Date(pi.deadline)
              const fb = (days: number) => { const d = new Date(piDeadline); d.setDate(d.getDate() - days); return d }
              const iHan  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'HAN')     : null
              const iWeav = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'WEAVING') : null
              const iSon  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'SON')     : null
              const iMat      = item.materialDeadline ? new Date(item.materialDeadline) : fb(21)
              const iHanDate  = iHan  ? new Date(iHan.deadline)  : fb(14)
              const iWeavDate = iWeav ? new Date(iWeav.deadline) : fb(8)
              const iSonDate  = iSon  ? new Date(iSon.deadline)  : fb(3)
              const dc = (d: Date, own: boolean) => (
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:13, fontWeight: own ? 700 : 400, color: own ? 'var(--text)' : 'var(--text3)' }}>{format(d, 'dd/MM/yy')}</div>
                  {!own && <div style={{ fontSize:10, color:'var(--text3)' }}>ước tính</div>}
                </div>
              )
              const iDelivery = item.deliveryDeadline ? new Date(item.deliveryDeadline) : null
              const busy = approvingKey === `${pi.id}-${idx}`
              return (
                <div key={`${pi.id}-${idx}`} style={{ display:'grid', gridTemplateColumns:'100px 1fr 95px 95px 95px 95px 100px 200px', padding:'12px 18px', alignItems:'center', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                  <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#0369a1' }}>{getDisplayCode(pi)}</span>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{code}</span>
                      {item.status && <StatusBadge status={item.status as SalesPOStatus} />}
                    </div>
                    {name && <div style={{ fontSize:13, color:'var(--text2)', marginTop:3 }}>{name}</div>}
                    <div style={{ display:'flex', gap:6, marginTop:5, flexWrap:'wrap' }}>
                      {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                      {color && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>{color}</span>}
                      {item.prodApproval?.warehouseName && (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, color:'#0369a1', background:'#e0f2fe', padding:'2px 8px', borderRadius:10 }}>
                          <Warehouse size={10}/> {item.prodApproval.warehouseName}
                        </span>
                      )}
                    </div>
                  </div>
                  {dc(iMat,      !!item.materialDeadline)}
                  {dc(iHanDate,  !!iHan)}
                  {dc(iWeavDate, !!iWeav)}
                  {dc(iSonDate,  !!iSon)}
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:13, fontWeight:700, color: iDelivery ? '#1d4ed8' : 'var(--text3)' }}>
                      {format(iDelivery ?? piDeadline, 'dd/MM/yy')}
                    </div>
                    {!iDelivery && <div style={{ fontSize:10, color:'var(--text3)' }}>từ PO</div>}
                  </div>
                  <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                    {isBoss ? (
                      <>
                        <button onClick={() => setApproveTarget({ pi, idx })} disabled={busy}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor: busy ? 'not-allowed' : 'pointer', color:'#fff', opacity: busy ? 0.7 : 1 }}>
                          <ThumbsUp size={12}/> {busy ? 'Đang duyệt...' : 'Duyệt'}
                        </button>
                        <button onClick={() => { setRejectTarget({ pi, idx }); setRejectReason('') }} disabled={busy}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'transparent', border:'1px solid #fca5a5', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', color:'#b91c1c' }}>
                          <ThumbsDown size={12}/> Từ chối
                        </button>
                      </>
                    ) : (
                      <button onClick={() => { setQlsxTarget({ pi, idx }); setQlsxWarehouseCode(null) }}
                        style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', color:'#fff' }}>
                        <Warehouse size={12}/>  Chọn kho sản xuất
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : viewingPI ? (
        /* ── CHI TIẾT PI (KHSX) ─────────────────────────────────────────── */
        (() => {
          const pi = viewingPI
          const items = Array.isArray(pi.items) ? pi.items : []
          // PI deadline = latest delivery deadline among SKUs (fallback to pi.deadline)
          const computedDeadline = items.length > 0
            ? items.reduce((max: Date, item: any) => {
                const d = item.deliveryDeadline ? new Date(item.deliveryDeadline) : new Date(pi.deadline)
                return d > max ? d : max
              }, new Date(0))
            : new Date(pi.deadline)
          const fmt = (d: Date) => format(d, 'dd/MM/yy')
          const canConfirmProd = pi.status !== 'PRODUCING' && pi.status !== 'DONE' && pi.status !== 'CANCELLED'
          // Còn SKU nào chưa gửi duyệt / bị từ chối (có thể gửi lại).
          const hasSendableItems = items.some((it: any) => !it.prodApproval || it.prodApproval.status === 'REJECTED')
          const fb = (days: number) => { const d = new Date(computedDeadline); d.setDate(d.getDate() - days); return d }
          return (
            <div>
              {/* Back + actions */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, flexWrap:'wrap', rowGap:8 }}>
                <button onClick={() => setViewingPIId(null)}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, fontSize:13, cursor:'pointer', color:'var(--text2)', fontWeight:500 }}>
                  <ChevronLeft size={15}/> Danh sách PO
                </button>
                <div style={{ flex:1 }} />
                <button onClick={() => openPIEdit(pi)}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--text2)' }}>
                  <Pencil size={13}/> Sửa thời hạn
                </button>
                {canConfirmProd && hasSendableItems && (
                  <button onClick={() => {
                    setConfirmProdTarget(pi)
                    const piItems: any[] = pi.items ?? []
                    const firstSendable = piItems.findIndex((it: any) => !it.prodApproval || it.prodApproval.status === 'REJECTED')
                    setSelectedItemIdx(firstSendable >= 0 ? firstSendable : null)
                  }}
                    style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 14px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', color:'#fff' }}>
                    <Play size={13}/> Gửi QLSX
                  </button>
                )}
              </div>

              {/* PI header info */}
              <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20, padding:'14px 18px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)' }}>
                <div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:18 }}>{getDisplayCode(pi)}</div>
                </div>
                <div style={{ width:1, height:36, background:'var(--border)' }} />
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <CalendarClock size={14} color="var(--text3)"/>
                  <span style={{ fontSize:13, color:'var(--text3)' }}>Hạn hoàn thành:</span>
                  <span style={{ fontWeight:700, fontSize:15 }}>{format(computedDeadline, 'dd/MM/yyyy')}</span>
                </div>
                <div style={{ marginLeft:'auto', fontSize:12, color:'var(--text3)', background:'var(--surface2)', padding:'4px 12px', borderRadius:12, border:'1px solid var(--border)' }}>
                  {items.length} SKU
                </div>
              </div>

              {/* SKU timeline */}
              <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 105px 105px 105px 105px 110px', padding:'10px 18px', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px' }}>SKU</span>
                  {['Mua hàng','Khung CK','Đan','Đóng gói'].map(h => (
                    <span key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</span>
                  ))}
                  <span style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.5px' }}>Hạn giao</span>
                </div>
                {items.length === 0 ? (
                  <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Không có SKU</div>
                ) : items.map((item: any, idx: number) => {
                  const code = item.productVariant?.mfgProduct?.factoryCode ?? '—'
                  const name = item.productVariant?.mfgProduct?.name ?? ''
                  const color = item.productVariant?.colorCode
                  const qty  = item.quantity
                  const isLast = idx === items.length - 1
                  const iHan  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'HAN')     : null
                  const iWeav = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'WEAVING') : null
                  const iSon  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'SON')     : null
                  const iMat      = item.materialDeadline ? new Date(item.materialDeadline) : fb(21)
                  const iHanDate  = iHan  ? new Date(iHan.deadline)  : fb(14)
                  const iWeavDate = iWeav ? new Date(iWeav.deadline) : fb(8)
                  const iSonDate  = iSon  ? new Date(iSon.deadline)  : fb(3)
                  const dc = (d: Date, own: boolean) => (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:14, fontWeight: own ? 700 : 400, color: own ? 'var(--text)' : 'var(--text3)' }}>{fmt(d)}</div>
                      {!own && <div style={{ fontSize:10, color:'var(--text3)' }}>ước tính</div>}
                    </div>
                  )
                  const iDelivery = item.deliveryDeadline ? new Date(item.deliveryDeadline) : null
                  return (
                    <div key={idx} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 105px 105px 105px 105px 110px', padding:'14px 18px', alignItems:'center' }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                            <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'#0369a1' }}>{code}</span>
                            {item.status && <StatusBadge status={item.status as SalesPOStatus} />}
                            {item.prodApproval?.status === 'APPROVED' && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#2e7d32', background:'#dcfce7', padding:'2px 8px', borderRadius:10 }}>
                                <Play size={10}/> Đang sản xuất
                              </span>
                            )}
                            {item.prodApproval?.status === 'WAITING_QLSX' && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#b45309', background:'#fef3c7', padding:'2px 8px', borderRadius:10 }}>
                                <Clock size={10}/> Chờ QLSX xử lý
                              </span>
                            )}
                            {item.prodApproval?.status === 'WAITING_BOSS' && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#0369a1', background:'#e0f2fe', padding:'2px 8px', borderRadius:10 }}>
                                <Clock size={10}/> Chờ sếp duyệt
                              </span>
                            )}
                            {item.prodApproval?.status === 'REJECTED' && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'#b91c1c', background:'#fee2e2', padding:'2px 8px', borderRadius:10 }}>
                                <XCircle size={10}/> Bị từ chối
                              </span>
                            )}
                          </div>
                          {name && <div style={{ fontSize:13, color:'var(--text2)', marginTop:3 }}>{name}</div>}
                          <div style={{ display:'flex', gap:6, marginTop:5, flexWrap:'wrap' }}>
                            {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                            {color && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>{color}</span>}
                            {item.prodApproval?.warehouseName && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, color:'#0369a1', background:'#e0f2fe', padding:'2px 8px', borderRadius:10 }}>
                                <Warehouse size={10}/> {item.prodApproval.warehouseName}
                              </span>
                            )}
                          </div>
                        </div>
                        {dc(iMat,      !!item.materialDeadline)}
                        {dc(iHanDate,  !!iHan)}
                        {dc(iWeavDate, !!iWeav)}
                        {dc(iSonDate,  !!iSon)}
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:14, fontWeight:700, color: iDelivery ? '#1d4ed8' : 'var(--text3)' }}>
                            {fmt(iDelivery ?? new Date(pi.deadline))}
                          </div>
                          {!iDelivery && <div style={{ fontSize:10, color:'var(--text3)' }}>từ PO</div>}
                        </div>
                      </div>
                      {item.prodApproval?.status === 'REJECTED' && item.prodApproval.reason && (
                        <div style={{ margin:'0 18px 12px', fontSize:12, color:'#b91c1c', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'6px 10px' }}>
                          Lý do từ chối: {item.prodApproval.reason}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()
      ) : (
        /* ── DANH SÁCH PI (KHSX) ────────────────────────────────────────── */
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>Tạo lệnh sản xuất</h2>
              <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--text3)' }}>{safeList.length} lệnh</p>
            </div>
            <div style={{ position:'relative' }}>
              <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm mã PO..."
                style={{ padding:'7px 10px 7px 32px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, background:'var(--surface)', color:'var(--text)', width:200, outline:'none' }}
              />
            </div>
          </div>

          {/* PI List */}
          <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            {filteredList.length === 0 && (
              <div style={{ padding:40, textAlign:'center', color:'var(--text3)', background:'var(--surface)' }}>
                {search.trim() ? `Không tìm thấy lệnh sản xuất "${search.trim()}"` : 'Chưa có lệnh sản xuất nào'}
              </div>
            )}
            {filteredList.map((pi: any, i: number) => {
              const items = Array.isArray(pi.items) ? pi.items : []
              const isLast = i === filteredList.length - 1
              return (
                <button key={pi.id} onClick={() => setViewingPIId(pi.id)}
                  style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 16px', width:'100%', background:'var(--surface)', border:'none', borderBottom: isLast ? 'none' : '1px solid var(--border)', cursor:'pointer', textAlign:'left', transition:'background .12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'var(--text)' }}>{getDisplayCode(pi)}</div>
                  </div>
                  <div style={{ flex:1 }} />
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <CalendarClock size={13} color="var(--text3)"/>
                    <span style={{ fontSize:12, color:'var(--text3)' }}>Hạn hoàn thành</span>
                    <span style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{format(new Date(pi.deadline), 'dd/MM/yy')}</span>
                  </div>
                  <span style={{ fontSize:12, color:'var(--text3)', background:'var(--surface2)', border:'1px solid var(--border)', padding:'3px 10px', borderRadius:12, whiteSpace:'nowrap' }}>
                    {items.length} SKU
                  </span>
                  <ChevronRight size={16} color="var(--text3)"/>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Gửi QLSX xử lý */}
      {confirmProdTarget && (() => {
        const items: any[] = confirmProdTarget.items ?? []
        const selItem = selectedItemIdx !== null ? items[selectedItemIdx] : null
        return (
          <div onClick={() => { if (!confirmingProdId) setConfirmProdTarget(null) }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, width:560, maxWidth:'95vw', maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>

              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexShrink:0 }}>
                <h3 style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                  <Play size={16} color="#2e7d32"/> Gửi QLSX xử lý
                </h3>
                <button onClick={() => setConfirmProdTarget(null)} style={{ padding:4, background:'transparent', border:'none', cursor:'pointer' }}>
                  <X size={18} color="var(--text3)"/>
                </button>
              </div>

              {/* PI info strip */}
              <div style={{ display:'flex', gap:10, marginBottom:14, flexShrink:0 }}>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Mã PO</div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{getDisplayCode(confirmProdTarget)}</div>
                </div>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Hạn hoàn thành</div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{format(new Date(confirmProdTarget.deadline), 'dd/MM/yyyy')}</div>
                </div>
              </div>

              {/* Section label */}
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8, flexShrink:0 }}>
                Chọn SKU để sản xuất — {items.length} SKU trong PO
              </div>

              {/* SKU list — scrollable, radio style */}
              <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                {items.map((item: any, i: number) => {
                  const approvalStatus: 'WAITING_QLSX' | 'WAITING_BOSS' | 'REJECTED' | 'APPROVED' | undefined = item.prodApproval?.status
                  const locked = approvalStatus === 'WAITING_QLSX' || approvalStatus === 'WAITING_BOSS' || approvalStatus === 'APPROVED'
                  const sel  = selectedItemIdx === i
                  const code = item.productVariant?.mfgProduct?.factoryCode ?? '—'
                  const name = item.productVariant?.mfgProduct?.name ?? ''
                  const clr  = item.productVariant?.colorCode
                  const qty  = item.quantity
                  const pDl  = new Date(confirmProdTarget.deadline)
                  const fb   = (days: number) => { const d = new Date(pDl); d.setDate(d.getDate() - days); return d }
                  const iHan  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'HAN')     : null
                  const iWeav = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'WEAVING') : null
                  const iSon  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'SON')     : null
                  const cols = [
                    { label:'Mua hàng', val: item.materialDeadline ? new Date(item.materialDeadline) : fb(21), own: !!item.materialDeadline },
                    { label:'Khung CK', val: iHan  ? new Date(iHan.deadline)  : fb(14), own: !!iHan },
                    { label:'Đan',      val: iWeav ? new Date(iWeav.deadline) : fb(8),  own: !!iWeav },
                    { label:'Đóng gói', val: iSon  ? new Date(iSon.deadline)  : fb(3),  own: !!iSon },
                  ]
                  const iDelivery = item.deliveryDeadline ? new Date(item.deliveryDeadline) : null
                  return (
                    <div key={i} onClick={() => { if (!locked) setSelectedItemIdx(i) }}
                      style={{ border: sel ? '2px solid #2e7d32' : '1px solid var(--border)', borderRadius:8, overflow:'hidden', cursor: locked ? 'default' : 'pointer', background: locked ? 'var(--surface2)' : sel ? '#f0fdf4' : 'var(--surface)', opacity: locked ? 0.6 : 1, transition:'border-color .12s, background .12s', userSelect:'none' }}>
                      {/* SKU info row */}
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px' }}>
                        {/* Radio indicator */}
                        {locked ? (
                          <CheckCircle2 size={18} color={approvalStatus === 'APPROVED' ? '#2e7d32' : approvalStatus === 'WAITING_BOSS' ? '#0369a1' : '#b45309'} style={{ flexShrink:0 }} />
                        ) : (
                          <div style={{ width:18, height:18, borderRadius:'50%', border:'2px solid', borderColor: sel ? '#2e7d32' : '#d1d5db', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'border-color .12s' }}>
                            {sel && <div style={{ width:9, height:9, borderRadius:'50%', background:'#2e7d32' }} />}
                          </div>
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, overflow:'hidden' }}>
                            <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#0369a1', flexShrink:0 }}>{code}</span>
                            {name && <span style={{ fontSize:13, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>}
                          </div>
                          <div style={{ display:'flex', gap:5, marginTop:3 }}>
                            {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'1px 7px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                            {clr && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'1px 7px', borderRadius:10 }}>{clr}</span>}
                            {approvalStatus === 'APPROVED' && <span style={{ fontSize:11, color:'#2e7d32', fontWeight:600, background:'#dcfce7', padding:'1px 7px', borderRadius:10 }}>Đang sản xuất</span>}
                            {approvalStatus === 'WAITING_QLSX' && <span style={{ fontSize:11, color:'#b45309', fontWeight:600, background:'#fef3c7', padding:'1px 7px', borderRadius:10 }}>Chờ QLSX xử lý</span>}
                            {approvalStatus === 'WAITING_BOSS' && <span style={{ fontSize:11, color:'#0369a1', fontWeight:600, background:'#e0f2fe', padding:'1px 7px', borderRadius:10 }}>Chờ sếp duyệt</span>}
                            {approvalStatus === 'REJECTED' && <span style={{ fontSize:11, color:'#b91c1c', fontWeight:600, background:'#fee2e2', padding:'1px 7px', borderRadius:10 }}>Bị từ chối - Cập nhật thông tin để gửi lại</span>}
                          </div>
                        </div>
                        {iDelivery && (
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:10, color:'#1d4ed8', fontWeight:600 }}>Hạn giao</div>
                            <div style={{ fontSize:12, fontWeight:700, color:'#1d4ed8' }}>{format(iDelivery, 'dd/MM/yy')}</div>
                          </div>
                        )}
                      </div>
                      {/* Timeline dates row */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'1px solid', borderColor: sel ? '#bbf7d0' : 'var(--border)', background: sel ? '#dcfce7' : 'var(--surface2)' }}>
                        {cols.map(({ label, val, own }, ci) => (
                          <div key={label} style={{ padding:'5px 10px', borderRight: ci < 3 ? '1px solid' : undefined, borderRightColor: sel ? '#bbf7d0' : 'var(--border)', textAlign:'center' }}>
                            <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:1 }}>{label}</div>
                            <div style={{ fontSize:11, fontWeight: own ? 600 : 400, color: own ? 'var(--text)' : 'var(--text3)' }}>
                              {format(val, 'dd/MM/yy')}
                              {!own && <span style={{ display:'block', fontSize:9 }}>ước tính</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)', flexShrink:0 }}>
                <div style={{ fontSize:13, minWidth:0, overflow:'hidden' }}>
                  {selItem ? (
                    <span style={{ color:'var(--text2)' }}>
                      Đã chọn: <strong style={{ color:'#0369a1', fontFamily:'monospace' }}>{selItem.productVariant?.mfgProduct?.factoryCode ?? '—'}</strong>
                      {selItem.productVariant?.mfgProduct?.name && <span style={{ marginLeft:6 }}>{selItem.productVariant.mfgProduct.name}</span>}
                    </span>
                  ) : (
                    <span style={{ color:'#d97706', fontSize:12 }}>Chưa chọn SKU</span>
                  )}
                </div>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <button onClick={() => setConfirmProdTarget(null)} disabled={!!confirmingProdId}
                    style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer', color:'var(--text2)' }}>
                    Hủy
                  </button>
                  <button
                    onClick={() => handleSendForApproval(confirmProdTarget.id)}
                    disabled={!!confirmingProdId || selectedItemIdx === null}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background: selectedItemIdx !== null ? '#2e7d32' : '#e5e7eb', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: (confirmingProdId || selectedItemIdx === null) ? 'not-allowed' : 'pointer', color: selectedItemIdx !== null ? '#fff' : '#9ca3af', opacity: confirmingProdId ? 0.7 : 1 }}>
                    <CheckCircle2 size={15}/>
                    {confirmingProdId ? 'Đang gửi...' : 'Gửi QLSX'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* QLSX chọn kho thành phẩm & gửi sếp duyệt */}
      {qlsxTarget && (() => {
        const { pi, idx } = qlsxTarget
        const items: any[] = pi.items ?? []
        const item = items[idx]
        if (!item) return null
        const code  = item.productVariant?.mfgProduct?.factoryCode ?? '—'
        const name  = item.productVariant?.mfgProduct?.name ?? ''
        const color = item.productVariant?.colorCode
        const qty   = item.quantity
        const iDelivery = item.deliveryDeadline ? new Date(item.deliveryDeadline) : null
        const selectedWh = finishedGoodsWarehouses.find((w: any) => w.code === qlsxWarehouseCode) ?? null
        const closeModal = () => { setQlsxTarget(null); setQlsxWarehouseCode(null) }
        return (
          <div onClick={() => { if (!sendingToBoss) closeModal() }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
            <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="qlsx-send-boss-title"
              style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, width:460, maxWidth:'95vw', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>

              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <h3 id="qlsx-send-boss-title" style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                  <Warehouse size={16} color="#2e7d32"/> Chọn kho thành phẩm
                </h3>
                <button onClick={closeModal} disabled={sendingToBoss} aria-label="Đóng"
                  style={{ padding:4, background:'transparent', border:'none', cursor: sendingToBoss ? 'not-allowed' : 'pointer' }}>
                  <X size={18} color="var(--text3)"/>
                </button>
              </div>

              {/* PO + hạn giao */}
              <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Mã PO</div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{getDisplayCode(pi)}</div>
                </div>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Hạn giao</div>
                  <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8' }}>{format(iDelivery ?? new Date(pi.deadline), 'dd/MM/yyyy')}</div>
                </div>
              </div>

              {/* SKU info */}
              <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'#0369a1' }}>{code}</span>
                  {name && <span style={{ fontSize:13, color:'var(--text2)' }}>{name}</span>}
                </div>
                <div style={{ display:'flex', gap:6, marginTop:5 }}>
                  {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                  {color && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>{color}</span>}
                </div>
              </div>

              {/* Chọn kho thành phẩm */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>
                  Kho thành phẩm — điểm cuối sau khi hoàn thành
                </div>
                <SearchableSelect
                  displayValue={selectedWh?.name ?? ''}
                  options={finishedGoodsWarehouses}
                  getKey={(w: any) => w.code}
                  getSearchText={(w: any) => `${w.name} ${w.code ?? ''}`}
                  renderOption={(w: any) => <span>{w.name}</span>}
                  onSelect={(w: any) => setQlsxWarehouseCode(w.code)}
                  placeholder="Chọn kho thành phẩm..."
                  emptyText="Không có kho thành phẩm"
                />
              </div>

              {/* Actions */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
                <button onClick={closeModal} disabled={sendingToBoss}
                  style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor: sendingToBoss ? 'not-allowed' : 'pointer', color:'var(--text2)' }}>
                  Hủy
                </button>
                <button onClick={handleQlsxSendToBoss} disabled={sendingToBoss || qlsxWarehouseCode === null}
                  style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', background: qlsxWarehouseCode !== null ? '#2e7d32' : '#e5e7eb', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: (sendingToBoss || qlsxWarehouseCode === null) ? 'not-allowed' : 'pointer', color: qlsxWarehouseCode !== null ? '#fff' : '#9ca3af', opacity: sendingToBoss ? 0.7 : 1 }}>
                  <CheckCircle2 size={15}/> {sendingToBoss ? 'Đang gửi...' : 'Gửi sếp duyệt'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Duyệt SKU — xác nhận trước khi tạo lệnh sản xuất (PI) */}
      {approveTarget && (() => {
        const { pi, idx } = approveTarget
        const items: any[] = pi.items ?? []
        const item = items[idx]
        if (!item) return null
        const code  = item.productVariant?.mfgProduct?.factoryCode ?? '—'
        const name  = item.productVariant?.mfgProduct?.name ?? ''
        const color = item.productVariant?.colorCode
        const qty   = item.quantity
        const piDeadline = new Date(pi.deadline)
        const fb = (days: number) => { const d = new Date(piDeadline); d.setDate(d.getDate() - days); return d }
        const iHan  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'HAN')     : null
        const iWeav = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'WEAVING') : null
        const iSon  = Array.isArray(item.stages) ? item.stages.find((s: any) => s.stageType === 'SON')     : null
        const cols = [
          { label:'Mua hàng', val: item.materialDeadline ? new Date(item.materialDeadline) : fb(21), own: !!item.materialDeadline },
          { label:'Khung CK', val: iHan  ? new Date(iHan.deadline)  : fb(14), own: !!iHan },
          { label:'Đan',      val: iWeav ? new Date(iWeav.deadline) : fb(8),  own: !!iWeav },
          { label:'Đóng gói', val: iSon  ? new Date(iSon.deadline)  : fb(3),  own: !!iSon },
        ]
        const iDelivery = item.deliveryDeadline ? new Date(item.deliveryDeadline) : null
        const busy = approvingKey === `${pi.id}-${idx}`
        // Boss cần biết trước nếu đây là SKU cuối — duyệt xong PO sẽ tự chuyển "Đang sản xuất" (đúng logic allApproved ở handleApproveItem).
        const willCompletePI = items.every((it: any, i: number) => i === idx || it.prodApproval?.status === 'APPROVED')

        return (
          <div onClick={() => { if (!busy) setApproveTarget(null) }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
            <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="approve-sku-title"
              style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, width:480, maxWidth:'95vw', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>

              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <h3 id="approve-sku-title" style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                  <ThumbsUp size={16} color="#2e7d32"/> Duyệt sản xuất — Tạo lệnh sản xuất
                </h3>
                <button onClick={() => setApproveTarget(null)} disabled={busy} aria-label="Đóng"
                  style={{ padding:4, background:'transparent', border:'none', cursor: busy ? 'not-allowed' : 'pointer' }}>
                  <X size={18} color="var(--text3)"/>
                </button>
              </div>

              {/* PO + hạn giao */}
              <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Mã PO</div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14 }}>{getDisplayCode(pi)}</div>
                </div>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'8px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Hạn giao</div>
                  <div style={{ fontWeight:700, fontSize:14, color:'#1d4ed8' }}>{format(iDelivery ?? piDeadline, 'dd/MM/yyyy')}</div>
                </div>
              </div>

              {/* SKU + timeline */}
              <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:14 }}>
                <div style={{ padding:'10px 12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'#0369a1' }}>{code}</span>
                    {name && <span style={{ fontSize:13, color:'var(--text2)' }}>{name}</span>}
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:5 }}>
                    {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                    {color && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>{color}</span>}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'1px solid var(--border)', background:'var(--surface2)' }}>
                  {cols.map(({ label, val, own }, ci) => (
                    <div key={label} style={{ padding:'6px 10px', borderRight: ci < 3 ? '1px solid var(--border)' : undefined, textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:1 }}>{label}</div>
                      <div style={{ fontSize:11, fontWeight: own ? 600 : 400, color: own ? 'var(--text)' : 'var(--text3)' }}>
                        {format(val, 'dd/MM/yy')}
                        {!own && <span style={{ display:'block', fontSize:9 }}>ước tính</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hệ quả của hành động */}
              <div style={{ display:'flex', gap:8, alignItems:'flex-start', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#166534' }}>
                <CheckCircle2 size={14} style={{ flexShrink:0, marginTop:1 }}/>
                <span>
                  Duyệt sẽ tạo lệnh sản xuất (PI) cho SKU này và bắt đầu sản xuất ngay — không thể hoàn tác.
                  {willCompletePI && ' Đây là SKU cuối cùng của PO — PO sẽ chuyển sang trạng thái "Đang sản xuất".'}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
                <button onClick={() => setApproveTarget(null)} disabled={busy}
                  style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor: busy ? 'not-allowed' : 'pointer', color:'var(--text2)' }}>
                  Hủy
                </button>
                <button onClick={() => handleApproveItem(pi, idx)} disabled={busy}
                  style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#2e7d32', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: busy ? 'not-allowed' : 'pointer', color:'#fff', opacity: busy ? 0.7 : 1 }}>
                  <ThumbsUp size={15}/> {busy ? 'Đang duyệt...' : 'Xác nhận duyệt'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Từ chối SKU */}
      {rejectTarget && (
        <div onClick={() => { if (!rejecting) { setRejectTarget(null); setRejectReason('') } }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, width:420, maxWidth:'95vw', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                <ThumbsDown size={16} color="#b91c1c"/> Từ chối sản xuất
              </h3>
              <button onClick={() => { setRejectTarget(null); setRejectReason('') }} disabled={rejecting}
                style={{ padding:4, background:'transparent', border:'none', cursor:'pointer' }}>
                <X size={18} color="var(--text3)"/>
              </button>
            </div>
            <div style={{ fontSize:13, color:'var(--text2)', marginBottom:10 }}>
              SKU <strong style={{ fontFamily:'monospace', color:'#0369a1' }}>
                {rejectTarget.pi.items?.[rejectTarget.idx]?.productVariant?.mfgProduct?.factoryCode ?? '—'}
              </strong> sẽ được gửi lại cho KHSX sửa thời hạn.
            </div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              rows={3}
              autoFocus
              style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, background:'var(--surface)', color:'var(--text)', boxSizing:'border-box', resize:'vertical' }}
            />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
              <button onClick={() => { setRejectTarget(null); setRejectReason('') }} disabled={rejecting}
                style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer', color:'var(--text2)' }}>
                Hủy
              </button>
              <button onClick={handleRejectItem} disabled={rejecting || !rejectReason.trim()}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#b91c1c', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: (rejecting || !rejectReason.trim()) ? 'not-allowed' : 'pointer', color:'#fff', opacity: (rejecting || !rejectReason.trim()) ? 0.6 : 1 }}>
                <ThumbsDown size={15}/> {rejecting ? 'Đang gửi...' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sửa timeline PI */}
      {editingPI && (
        <div onClick={() => { if (!savingPI) setEditingPI(null) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:28, width:560, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                <CalendarClock size={16} color="#1976d2"/> Sửa thời hạn — <span style={{ fontFamily:'monospace' }}>{getDisplayCode(editingPI)}</span>
              </h3>
              <button onClick={() => setEditingPI(null)} disabled={savingPI}
                style={{ padding:4, background:'transparent', border:'none', cursor:'pointer' }}>
                <X size={18} color="var(--text3)"/>
              </button>
            </div>

            {/* SKU timelines */}
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:24 }}>
              {(Array.isArray(editingPI.items) ? editingPI.items : []).map((item: any, idx: number) => {
                const code = item.productVariant?.mfgProduct?.factoryCode ?? '—'
                const name = item.productVariant?.mfgProduct?.name ?? ''
                const qty  = item.quantity
                const vals = editValues.items[idx] ?? { materialDeadline:'', deliveryDeadline:'', HAN:'', WEAVING:'', SON:'' }
                const setField = (field: string, val: string) =>
                  setEditValues(prev => ({
                    ...prev,
                    items: prev.items.map((it, i) => i === idx ? { ...it, [field]: val } : it),
                  }))
                const dateInput = (label: string, field: string) => (
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:4 }}>{label}</div>
                    <input type="date" value={vals[field as keyof typeof vals] ?? ''}
                      onChange={e => setField(field, e.target.value)}
                      style={{ width:'100%', padding:'5px 6px', border:'1px solid var(--border)', borderRadius:5, fontSize:12, background:'var(--surface)', color:'var(--text)', boxSizing:'border-box' }}
                    />
                  </div>
                )
                return (
                  <div key={idx} style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                    <div style={{ background:'var(--surface2)', padding:'7px 12px', display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#0369a1' }}>{code}</span>
                      {name && <span style={{ fontSize:12, color:'var(--text2)' }}>{name}</span>}
                      {qty != null && <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)', background:'var(--surface)', padding:'1px 8px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                    </div>
                    <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:10 }}>
                      {/* Hạn giao hàng riêng cho SKU này */}
                      <div>
                        <div style={{ fontSize:10, color:'#1d4ed8', fontWeight:700, marginBottom:4 }}>Hạn giao hàng</div>
                        <input type="date" value={vals.deliveryDeadline ?? ''}
                          onChange={e => setField('deliveryDeadline', e.target.value)}
                          style={{ width:'100%', padding:'5px 8px', border:'1px solid #1d4ed8', borderRadius:5, fontSize:12, background:'var(--surface)', color:'var(--text)', boxSizing:'border-box' }}
                        />
                      </div>
                      {/* Các công đoạn sản xuất */}
                      <div style={{ display:'flex', gap:8 }}>
                        {dateInput('Mua hàng',    'materialDeadline')}
                        {dateInput('Khung cơ khí', 'HAN')}
                        {dateInput('Đan',          'WEAVING')}
                        {dateInput('Đóng gói',     'SON')}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={() => setEditingPI(null)} disabled={savingPI}
                style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor: savingPI ? 'not-allowed' : 'pointer', color:'var(--text2)' }}>
                Hủy
              </button>
              <button onClick={handleSavePI} disabled={savingPI}
                style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#1976d2', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: savingPI ? 'not-allowed' : 'pointer', color:'#fff', opacity: savingPI ? 0.7 : 1 }}>
                {savingPI ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
