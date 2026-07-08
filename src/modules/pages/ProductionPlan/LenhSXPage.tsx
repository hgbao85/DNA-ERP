import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import ExportOrderDetailModal from '../Manufacturing/ExportOrderDetailModal'
import { StatusBadge } from '../Sales/StatusBadge'
import type { SalesPOStatus } from '../../../types/sales'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2, FileText, Eye, X, CalendarClock, Pencil, Package, Play, ChevronRight, ChevronLeft, Search } from 'lucide-react'

/**
 * Khi PM xác nhận sản xuất 1 SKU cụ thể trong PI, tạo (hoặc tái dùng) 1 PlanForm
 * cho đúng SKU đó — đây là dữ liệu duy nhất mà "Lệnh kiểm tra vật tư" của
 * prodmgr@demo.com đọc (api.getPlanForms(), lọc status !== 'DRAFT'). PlanForm
 * cần exportOrderId/mfgProductId trỏ tới bản ghi thật để enrich() ra đúng
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
  const { user } = useAuth()
  const [viewOrderId, setViewOrderId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [confirmingProdId, setConfirmingProdId] = useState<number | null>(null)
  const [confirmProdTarget, setConfirmProdTarget] = useState<any | null>(null)
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null)
  const [timeline, setTimeline] = useState<any | null>(null)
  const [timelineOrderId, setTimelineOrderId] = useState<number | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editSteps, setEditSteps] = useState<{ key: string; label: string; startDate: string | null; deadline: string }[]>([])
  const [savingTimeline, setSavingTimeline] = useState(false)
  const [editingPI, setEditingPI] = useState<any | null>(null)
  const [editValues, setEditValues] = useState<{ deadline: string; items: { materialDeadline: string; deliveryDeadline: string; HAN: string; WEAVING: string; SON: string }[] }>({ deadline: '', items: [] })
  const [savingPI, setSavingPI] = useState(false)
  const [viewingPIId, setViewingPIId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const { data: pis, isLoading, error, refetch } = useFetch(
    () => api.getProductionInvoices(),
    []
  )
  const safeList = (Array.isArray(pis) ? pis : []).filter((p: any) => p.status === 'PLANNING')
  const filteredList = search.trim()
    ? safeList.filter((p: any) => (p.code ?? '').toLowerCase().includes(search.trim().toLowerCase()) || (p.exportOrder?.poNumber ?? '').toLowerCase().includes(search.trim().toLowerCase()))
    : safeList
  const viewingPI = viewingPIId ? (Array.isArray(pis) ? pis : []).find((p: any) => p.id === viewingPIId) ?? null : null
  const getDisplayCode = (item: any) => item?.exportOrder?.poNumber || item?.poNumber || item?.code || '—'

  // Giám đốc (BOSS không mfgRole) chỉ XEM — không xác nhận đơn/tạo PI (đồng bộ backend).
  const isPlanner = user?.mfgRole === 'PRODUCTION_MANAGER'

  // Đơn hàng chờ lên kế hoạch (chỉ planner thấy)
  const { data: orders, refetch: refetchOrders } = useFetch(
    () => (isPlanner ? api.getExportOrders() : Promise.resolve([])),
    []
  )
  const pendingOrders = (Array.isArray(orders) ? orders : []).filter((o: any) => o.status === 'DRAFT')

  const handleViewTimeline = async (id: number) => {
    try {
      setTimelineLoading(true)
      const data = await api.getExportOrderTimeline(id)
      setTimeline(data)
      setTimelineOrderId(id)
      setEditMode(false)
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Lỗi tải timeline')
    } finally {
      setTimelineLoading(false)
    }
  }

  const closeTimeline = () => {
    setTimeline(null); setTimelineOrderId(null); setEditMode(false); setEditSteps([])
  }

  const PROD_STAGES = ['PHOI', 'HAN', 'SON', 'WEAVING']

  const startEditTimeline = () => {
    const steps = (timeline?.steps ?? []).map((s: any) => ({
      key: s.key,
      label: s.label,
      startDate: s.startDate ? format(new Date(s.startDate), 'yyyy-MM-dd') : null,
      deadline: format(new Date(s.deadline), 'yyyy-MM-dd'),
    }))
    setEditSteps(steps)
    setEditMode(true)
  }

  const patchEditStep = (key: string, field: 'startDate' | 'deadline', value: string) => {
    setEditSteps(prev => prev.map(s => s.key === key ? { ...s, [field]: value } : s))
  }

  const handleSaveTimeline = async () => {
    if (timelineOrderId === null) return
    // Validate: với công đoạn SX, ngày bắt đầu không được sau hạn xong
    for (const s of editSteps) {
      if (PROD_STAGES.includes(s.key) && s.startDate && s.startDate > s.deadline) {
        alert(`Công đoạn "${s.label}": ngày bắt đầu không được sau ngày xong`)
        return
      }
    }
    const material = editSteps.find(s => s.key === 'MATERIAL')
    const stages = editSteps
      .filter(s => PROD_STAGES.includes(s.key))
      .map(s => ({
        stageType: s.key,
        startDate: new Date(s.startDate as string).toISOString(),
        deadline: new Date(s.deadline).toISOString(),
      }))
    try {
      setSavingTimeline(true)
      await api.confirmExportOrder(timelineOrderId, {
        materialDeadline: material ? new Date(material.deadline).toISOString() : undefined,
        stages,
      })
      closeTimeline()
      refetchOrders(); refetch()
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Lỗi lưu thời hạn')
    } finally {
      setSavingTimeline(false)
    }
  }

  const handleConfirm = async (id: number) => {
    try {
      setConfirmingId(id)
      await api.confirmExportOrder(id)
      refetchOrders(); refetch()
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Lỗi xác nhận đơn')
    } finally {
      setConfirmingId(null)
    }
  }

  const handleConfirmProduction = async (id: number) => {
    setConfirmingProdId(id)
    try {
      if (selectedItemIdx !== null && confirmProdTarget) {
        const item = (confirmProdTarget.items ?? [])[selectedItemIdx]
        if (item) await ensurePlanFormForConfirmedItem(confirmProdTarget, item)
      }
      await api.updateProductionInvoice(id, { status: 'PRODUCING' })
      refetch()
      setConfirmProdTarget(null)
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Lỗi xác nhận sản xuất')
    } finally {
      setConfirmingProdId(null)
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

      {viewingPI ? (
        /* ── CHI TIẾT PI ─────────────────────────────────────────────────── */
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
                {canConfirmProd && (
                  <button onClick={() => { setConfirmProdTarget(pi); setSelectedItemIdx((pi.items ?? []).length > 0 ? 0 : null) }}
                    style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 14px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', color:'#fff' }}>
                    <Play size={13}/> Xác nhận SX
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
                    <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 105px 105px 105px 105px 110px', padding:'14px 18px', borderBottom: isLast ? 'none' : '1px solid var(--border)', alignItems:'center' }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:'#0369a1' }}>{code}</span>
                          {item.status && <StatusBadge status={item.status as SalesPOStatus} />}
                        </div>
                        {name && <div style={{ fontSize:13, color:'var(--text2)', marginTop:3 }}>{name}</div>}
                        <div style={{ display:'flex', gap:6, marginTop:5, flexWrap:'wrap' }}>
                          {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                          {color && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'2px 8px', borderRadius:10 }}>{color}</span>}
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
                  )
                })}
              </div>
            </div>
          )
        })()
      ) : (
        /* ── DANH SÁCH PI ────────────────────────────────────────────────── */
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

          {/* Đơn hàng chờ lên kế hoạch */}
          {isPlanner && pendingOrders.length > 0 && (
            <div style={{ marginBottom:20, background:'#fff8e1', border:'1px solid #ffe082', borderRadius:'var(--radius-lg)', padding:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#e65100', marginBottom:10 }}>
                📋 Đơn hàng chờ lên kế hoạch ({pendingOrders.length})
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {pendingOrders.map((o: any) => (
                  <div key={o.id} style={{ display:'flex', alignItems:'center', gap:12, background:'var(--surface)', borderRadius:'var(--radius)', padding:'10px 14px', border:'1px solid var(--border)' }}>
                    <div style={{ fontWeight:600, fontFamily:'monospace', minWidth:90 }}>{o.poNumber}</div>
                    <div style={{ flex:1, fontSize:13 }}>
                      <div>Giao {format(new Date(o.deliveryDate), 'dd/MM/yyyy')}</div>
                      <div style={{ color:'var(--text3)', fontSize:12 }}>
                        {(o.items ?? []).map((i: any) => `${i.productVariant?.mfgProduct?.name} ×${i.quantity}`).join(', ')}
                      </div>
                    </div>
                    {o.contractFileUrl && (
                      <a href={o.contractFileUrl} target="_blank" rel="noreferrer" style={{ color:'#1565c0', display:'inline-flex', alignItems:'center', gap:4, fontSize:13 }}>
                        <FileText size={14}/> HĐ
                      </a>
                    )}
                    <button onClick={() => setViewOrderId(o.id)}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text2)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      <Package size={14}/> Xem đơn hàng
                    </button>
                    <button onClick={() => handleViewTimeline(o.id)} disabled={timelineLoading}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text2)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      <Eye size={14}/> Timeline
                    </button>
                    <button onClick={() => handleConfirm(o.id)} disabled={confirmingId === o.id}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#2e7d32', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      <CheckCircle2 size={14}/> {confirmingId === o.id ? 'Đang tạo...' : 'Xác nhận → tạo PO'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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

      {viewOrderId !== null && (
        <ExportOrderDetailModal orderId={viewOrderId} onClose={() => setViewOrderId(null)} />
      )}

      {/* Xác nhận sản xuất */}
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
                  <Play size={16} color="#2e7d32"/> Xác nhận sản xuất
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
                    <div key={i} onClick={() => setSelectedItemIdx(i)}
                      style={{ border: sel ? '2px solid #2e7d32' : '1px solid var(--border)', borderRadius:8, overflow:'hidden', cursor:'pointer', background: sel ? '#f0fdf4' : 'var(--surface)', transition:'border-color .12s, background .12s', userSelect:'none' }}>
                      {/* SKU info row */}
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px' }}>
                        {/* Radio indicator */}
                        <div style={{ width:18, height:18, borderRadius:'50%', border:'2px solid', borderColor: sel ? '#2e7d32' : '#d1d5db', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'border-color .12s' }}>
                          {sel && <div style={{ width:9, height:9, borderRadius:'50%', background:'#2e7d32' }} />}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, overflow:'hidden' }}>
                            <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#0369a1', flexShrink:0 }}>{code}</span>
                            {name && <span style={{ fontSize:13, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>}
                          </div>
                          <div style={{ display:'flex', gap:5, marginTop:3 }}>
                            {qty != null && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'1px 7px', borderRadius:10 }}>×{qty.toLocaleString()}</span>}
                            {clr && <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'1px 7px', borderRadius:10 }}>{clr}</span>}
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
                    onClick={() => handleConfirmProduction(confirmProdTarget.id)}
                    disabled={!!confirmingProdId || selectedItemIdx === null}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background: selectedItemIdx !== null ? '#2e7d32' : '#e5e7eb', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: (confirmingProdId || selectedItemIdx === null) ? 'not-allowed' : 'pointer', color: selectedItemIdx !== null ? '#fff' : '#9ca3af', opacity: confirmingProdId ? 0.7 : 1 }}>
                    <CheckCircle2 size={15}/>
                    {confirmingProdId ? 'Đang xử lý...' : 'Xác nhận sản xuất'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

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

      {/* Modal timeline dự kiến */}
      {timeline && (
        <div onClick={closeTimeline}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, width:480, maxWidth:'92vw', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                <CalendarClock size={18} color="#e65100"/> {editMode ? 'Chỉnh sửa thời hạn' : 'Thời hạn dự kiến'}
              </h3>
              <button onClick={closeTimeline} style={{ padding:4, background:'transparent', border:'none', cursor:'pointer' }}>
                <X size={18} color="var(--text3)"/>
              </button>
            </div>
            <div style={{ fontSize:13, color:'var(--text3)', marginBottom:16 }}>
              <strong style={{ fontFamily:'monospace', color:'var(--text)' }}>{timeline.poNumber}</strong>
              {' · '}Giao: <strong style={{ color:'var(--text)' }}>{format(new Date(timeline.deliveryDate), 'dd/MM/yyyy')}</strong>
            </div>

            {!editMode ? (
              <div style={{ position:'relative' }}>
                {(timeline.steps ?? []).map((s: any, i: number) => {
                  const isEnd = s.key === 'DELIVERY'
                  const isMat = s.key === 'MATERIAL'
                  const color = isEnd ? '#2e7d32' : isMat ? '#1565c0' : '#e65100'
                  return (
                    <div key={s.key} style={{ display:'flex', gap:12, paddingBottom: i < timeline.steps.length-1 ? 16 : 0 }}>
                      {/* cột mốc + đường nối */}
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                        <div style={{ width:12, height:12, borderRadius:'50%', background:color, flexShrink:0, marginTop:3 }} />
                        {i < timeline.steps.length-1 && <div style={{ flex:1, width:2, background:'var(--border)', marginTop:2 }} />}
                      </div>
                      {/* nội dung */}
                      <div style={{ flex:1, paddingBottom:4 }}>
                        <div style={{ fontWeight:600, fontSize:14, color }}>{s.label}</div>
                        <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>
                          {s.startDate
                            ? <>Từ {format(new Date(s.startDate), 'dd/MM')} → <strong>xong {format(new Date(s.deadline), 'dd/MM/yyyy')}</strong></>
                            : <>{isEnd ? 'Ngày giao: ' : 'Xong trước: '}<strong>{format(new Date(s.deadline), 'dd/MM/yyyy')}</strong></>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {editSteps.map((s) => {
                  const isEnd = s.key === 'DELIVERY'
                  const isMat = s.key === 'MATERIAL'
                  const color = isEnd ? '#2e7d32' : isMat ? '#1565c0' : '#e65100'
                  const isProd = PROD_STAGES.includes(s.key)
                  return (
                    <div key={s.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background: isEnd ? 'var(--surface2)' : 'var(--surface)' }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }} />
                      <div style={{ fontWeight:600, fontSize:13, color, minWidth:110 }}>{s.label}</div>
                      {isEnd ? (
                        <div style={{ flex:1, fontSize:12, color:'var(--text3)', textAlign:'right' }}>
                          Ngày giao: <strong>{format(new Date(s.deadline), 'dd/MM/yyyy')}</strong> (cố định)
                        </div>
                      ) : (
                        <div style={{ flex:1, display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end', flexWrap:'wrap' }}>
                          {isProd && (
                            <>
                              <span style={{ fontSize:11, color:'var(--text3)' }}>Từ</span>
                              <input type="date" value={s.startDate ?? ''}
                                onChange={e => patchEditStep(s.key, 'startDate', e.target.value)}
                                style={{ padding:'4px 6px', border:'1px solid var(--border)', borderRadius:6, fontSize:12, background:'var(--surface)', color:'var(--text)' }} />
                              <span style={{ fontSize:11, color:'var(--text3)' }}>→ xong</span>
                            </>
                          )}
                          {isMat && <span style={{ fontSize:11, color:'var(--text3)' }}>Xong trước</span>}
                          <input type="date" value={s.deadline}
                            onChange={e => patchEditStep(s.key, 'deadline', e.target.value)}
                            style={{ padding:'4px 6px', border:'1px solid var(--border)', borderRadius:6, fontSize:12, background:'var(--surface)', color:'var(--text)' }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ marginTop:18, paddingTop:14, borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              {!editMode ? (
                <>
                  <button onClick={closeTimeline}
                    style={{ padding:'8px 16px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer', color:'var(--text2)' }}>
                    Đóng
                  </button>
                  {isPlanner && (
                    <button onClick={startEditTimeline}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#e65100', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:600, cursor:'pointer', color:'#fff' }}>
                      <Pencil size={14}/> Chỉnh sửa thời hạn
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button onClick={() => setEditMode(false)} disabled={savingTimeline}
                    style={{ padding:'8px 16px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer', color:'var(--text2)' }}>
                    Hủy
                  </button>
                  <button onClick={handleSaveTimeline} disabled={savingTimeline}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#2e7d32', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:600, cursor:'pointer', color:'#fff' }}>
                    <CheckCircle2 size={14}/> {savingTimeline ? 'Đang lưu...' : 'Lưu & tạo PO'}
                  </button>
                </>
              )}
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:10 }}>
              {editMode
                ? '* Sửa hạn từng công đoạn rồi bấm "Lưu & tạo PO" — Lệnh SX sẽ dùng đúng hạn này. Ngày giao cố định theo đơn.'
                : '* Timeline mẫu tính lùi từ ngày giao. Bấm "Chỉnh sửa timeline" để đặt hạn riêng trước khi tạo PO; hoặc tạo PO luôn ở nút "Xác nhận" ngoài danh sách.'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
