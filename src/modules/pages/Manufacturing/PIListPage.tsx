import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import ExportOrderDetailModal from './ExportOrderDetailModal'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2, FileText, Eye, X, CalendarClock, Pencil, Package, Play } from 'lucide-react'

export default function PIListPage() {
  const { user } = useAuth()
  const [viewOrderId, setViewOrderId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [editingRowId, setEditingRowId] = useState<number | null>(null)
  const [editingRowValues, setEditingRowValues] = useState<Record<string, string>>({})
  const [savingRow, setSavingRow] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [confirmingProdId, setConfirmingProdId] = useState<number | null>(null)
  const [confirmProdTarget, setConfirmProdTarget] = useState<any | null>(null)
  const [timeline, setTimeline] = useState<any | null>(null)
  const [timelineOrderId, setTimelineOrderId] = useState<number | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  // Chỉnh sửa timeline trước khi tạo PI
  const [editMode, setEditMode] = useState(false)
  const [editSteps, setEditSteps] = useState<{ key: string; label: string; startDate: string | null; deadline: string }[]>([])
  const [savingTimeline, setSavingTimeline] = useState(false)

  const { data: pis, isLoading, error, refetch } = useFetch(
    () => api.getProductionInvoices(),
    []
  )
  const safeList = (Array.isArray(pis) ? pis : []).filter((p: any) => p.status === 'PLANNING')

  // Giám đốc (MANAGER không mfgRole) chỉ XEM — không xác nhận đơn/tạo PI (đồng bộ backend).
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
      alert(e?.response?.data?.error ?? 'Lỗi lưu timeline')
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

  const startRowEdit = (pi: any) => {
    const piDeadline = new Date(pi.deadline)
    const fallback = (daysBack: number) => {
      const d = new Date(piDeadline); d.setDate(d.getDate() - daysBack); return format(d, 'yyyy-MM-dd')
    }
    const stageDate = (type: string) => {
      const s = Array.isArray(pi.stages) ? pi.stages.find((s: any) => s.stageType === type) : null
      return s?.deadline ? format(new Date(s.deadline), 'yyyy-MM-dd') : null
    }
    setEditingRowId(pi.id)
    setEditingRowValues({
      deadline:        format(piDeadline, 'yyyy-MM-dd'),
      materialDeadline: pi.materialDeadline ? format(new Date(pi.materialDeadline), 'yyyy-MM-dd') : fallback(21),
      HAN:     stageDate('HAN')     ?? fallback(14),
      WEAVING: stageDate('WEAVING') ?? fallback(8),
      SON:     stageDate('SON')     ?? fallback(3),
    })
  }

  const handleSaveRow = async () => {
    if (!editingRowId) return
    setSavingRow(true)
    try {
      const pi = safeList.find((p: any) => p.id === editingRowId)
      const stages: any[] = Array.isArray(pi?.stages) ? [...pi.stages] : []
      for (const field of ['HAN', 'WEAVING', 'SON']) {
        const val = editingRowValues[field]
        if (!val) continue
        const iso = new Date(val).toISOString()
        const idx = stages.findIndex((s: any) => s.stageType === field)
        if (idx >= 0) stages[idx] = { ...stages[idx], deadline: iso }
        else stages.push({ stageType: field, deadline: iso, progressPercent: 0, status: 'PENDING' })
      }
      await api.updateProductionInvoice(editingRowId, {
        deadline: new Date(editingRowValues.deadline).toISOString(),
        materialDeadline: new Date(editingRowValues.materialDeadline).toISOString(),
        stages,
      })
      refetch()
      setEditingRowId(null)
      setShowSaveConfirm(false)
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Lỗi lưu')
    } finally {
      setSavingRow(false)
    }
  }

  const handleConfirmProduction = async (id: number) => {
    setConfirmingProdId(id)
    try {
      await api.updateProductionInvoice(id, { status: 'PRODUCING' })
      refetch()
      setConfirmProdTarget(null)
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Lỗi xác nhận sản xuất')
    } finally {
      setConfirmingProdId(null)
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
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>Lệnh sản xuất (PI)</h2>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--text3)' }}>{safeList.length} lệnh</p>
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
                  title="Xem chi tiết đơn hàng của Sales"
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text2)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  <Package size={14}/> Xem đơn hàng
                </button>
                <button onClick={() => handleViewTimeline(o.id)} disabled={timelineLoading}
                  title="Xem timeline dự kiến trước khi xác nhận"
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text2)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  <Eye size={14}/> Timeline
                </button>
                <button onClick={() => handleConfirm(o.id)} disabled={confirmingId === o.id}
                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#2e7d32', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  <CheckCircle2 size={14}/> {confirmingId === o.id ? 'Đang tạo...' : 'Xác nhận → tạo PI'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width:110 }} />
            <col />
            <col style={{ width:98 }} />
            <col style={{ width:98 }} />
            <col style={{ width:98 }} />
            <col style={{ width:98 }} />
            <col style={{ width:98 }} />
            <col style={{ width:124 }} />
            <col style={{ width:112 }} />
          </colgroup>
          <thead>
            <tr style={{ background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
              <th style={{ padding:'10px 12px', textAlign:'left',   fontWeight:600, color:'var(--text2)', fontSize:12 }}>Mã PI</th>
              <th style={{ padding:'10px 12px', textAlign:'left',   fontWeight:600, color:'var(--text2)', fontSize:12 }}>SKU</th>
              <th style={{ padding:'10px 6px',  textAlign:'center', fontWeight:600, color:'var(--text2)', fontSize:12 }}>Hạn giao</th>
              <th style={{ padding:'10px 6px',  textAlign:'center', fontWeight:600, color:'var(--text2)', fontSize:12 }}>Mua hàng</th>
              <th style={{ padding:'10px 6px',  textAlign:'center', fontWeight:600, color:'var(--text2)', fontSize:12 }}>Khung cơ khí</th>
              <th style={{ padding:'10px 6px',  textAlign:'center', fontWeight:600, color:'var(--text2)', fontSize:12 }}>Đan</th>
              <th style={{ padding:'10px 6px',  textAlign:'center', fontWeight:600, color:'var(--text2)', fontSize:12 }}>Đóng gói</th>
              <th style={{ padding:'10px 6px',  textAlign:'center', fontWeight:600, color:'var(--text2)', fontSize:12 }}>Cập nhật thời hạn</th>
              <th style={{ padding:'10px 6px',  textAlign:'center', fontWeight:600, color:'var(--text2)', fontSize:12 }}>Xác nhận</th>
            </tr>
          </thead>
          <tbody>
            {safeList.map((pi: any) => {
              const isOverdue = new Date(pi.deadline) < new Date() && pi.status !== 'DONE' && pi.status !== 'CANCELLED'
              const deadline = new Date(pi.deadline)
              const getStageDate = (type: string, fallbackDaysBack: number) => {
                const s = Array.isArray(pi.stages) ? pi.stages.find((s: any) => s.stageType === type) : null
                if (s?.deadline) return new Date(s.deadline)
                const d = new Date(deadline)
                d.setDate(d.getDate() - fallbackDaysBack)
                return d
              }
              const fmt = (d: Date) => format(d, 'dd/MM/yy')
              const hanStage   = Array.isArray(pi.stages) ? pi.stages.find((s: any) => s.stageType === 'HAN')     : null
              const weavStage  = Array.isArray(pi.stages) ? pi.stages.find((s: any) => s.stageType === 'WEAVING') : null
              const sonStage   = Array.isArray(pi.stages) ? pi.stages.find((s: any) => s.stageType === 'SON')     : null
              const skuItem = Array.isArray(pi.items) ? pi.items[0] : null
              const skuCode = skuItem?.productVariant?.mfgProduct?.factoryCode ?? '—'
              const skuName = skuItem?.productVariant?.mfgProduct?.name ?? ''
              const canConfirmProd = pi.status !== 'PRODUCING' && pi.status !== 'DONE' && pi.status !== 'CANCELLED'
              const isEditingThis = editingRowId === pi.id
              const dateInput = (field: string) => (
                <td style={{ padding:'5px 4px', textAlign:'center' }}>
                  <input
                    type="date"
                    value={editingRowValues[field] ?? ''}
                    onChange={e => setEditingRowValues(prev => ({ ...prev, [field]: e.target.value }))}
                    style={{ padding:'3px 4px', border:'1px solid #1976d2', borderRadius:4, fontSize:11, width:'100%', boxSizing:'border-box', background:'var(--surface)', color:'var(--text)' }}
                  />
                </td>
              )
              const dateDisplay = (date: Date, fromStage: boolean, extra?: React.ReactNode) => (
                <td style={{ padding:'12px 6px', fontSize:12, whiteSpace:'nowrap', textAlign:'center', color: fromStage ? 'var(--text)' : 'var(--text3)' }}>
                  {fmt(date)}{extra}
                </td>
              )
              return (
                <tr key={pi.id} style={{ borderBottom:'1px solid var(--border)', background: isEditingThis ? '#f0f7ff' : 'transparent' }}>
                  <td style={{ padding:'12px 14px', fontWeight:600, fontFamily:'monospace' }}>{pi.code}</td>
                  <td style={{ padding:'12px 14px' }}>
                    <span style={{ fontWeight:600, fontFamily:'monospace', fontSize:12 }}>{skuCode}</span>
                    {skuName && <span style={{ marginLeft:6, color:'var(--text3)', fontSize:12 }}>{skuName}</span>}
                  </td>
                  {isEditingThis ? dateInput('deadline') : dateDisplay(deadline, true,
                    isOverdue ? <span style={{ marginLeft:6, fontSize:11, background:'#ffebee', color:'#c62828', padding:'1px 6px', borderRadius:20 }}>Trễ</span> : null
                  )}
                  {isEditingThis ? dateInput('materialDeadline') : dateDisplay(pi.materialDeadline ? new Date(pi.materialDeadline) : getStageDate('MATERIAL', 21), !!pi.materialDeadline)}
                  {isEditingThis ? dateInput('HAN')     : dateDisplay(getStageDate('HAN',     14), !!hanStage)}
                  {isEditingThis ? dateInput('WEAVING') : dateDisplay(getStageDate('WEAVING',  8), !!weavStage)}
                  {isEditingThis ? dateInput('SON')     : dateDisplay(getStageDate('SON',       3), !!sonStage)}
                  <td style={{ padding:'12px 14px' }}>
                    {isEditingThis ? (
                      <div style={{ display:'flex', gap:6 }}>
                        <button
                          onClick={() => setShowSaveConfirm(true)}
                          style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 12px', background:'#1976d2', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', color:'#fff', whiteSpace:'nowrap' }}
                        >
                          <CheckCircle2 size={13}/> Lưu
                        </button>
                        <button
                          onClick={() => setEditingRowId(null)}
                          style={{ padding:'5px 10px', background:'transparent', border:'1px solid var(--border)', borderRadius:6, fontSize:12, cursor:'pointer', color:'var(--text2)' }}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startRowEdit(pi)}
                        style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', color:'var(--text2)', whiteSpace:'nowrap' }}
                      >
                        Sửa
                      </button>
                    )}
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    {!isEditingThis && canConfirmProd && (
                      <button
                        onClick={() => setConfirmProdTarget(pi)}
                        disabled={confirmingProdId === pi.id}
                        style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor: confirmingProdId === pi.id ? 'not-allowed' : 'pointer', color:'#fff', opacity: confirmingProdId === pi.id ? 0.7 : 1, whiteSpace:'nowrap' }}
                      >
                      {confirmingProdId === pi.id ? '...' : 'Xác nhận'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {safeList.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding:'40px', textAlign:'center', color:'var(--text3)' }}>
                  Chưa có lệnh sản xuất nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewOrderId !== null && (
        <ExportOrderDetailModal orderId={viewOrderId} onClose={() => setViewOrderId(null)} />
      )}

      {/* Xác nhận sản xuất */}
      {confirmProdTarget && (
        <div onClick={() => { if (!confirmingProdId) setConfirmProdTarget(null) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:28, width:460, maxWidth:'92vw', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
                <Play size={16} color="#2e7d32"/> Xác nhận sản xuất
              </h3>
              <button onClick={() => setConfirmProdTarget(null)} style={{ padding:4, background:'transparent', border:'none', cursor:'pointer' }}>
                <X size={18} color="var(--text3)"/>
              </button>
            </div>

            {/* PI & SKU */}
            <div style={{ display:'flex', gap:12, marginBottom:16 }}>
              <div style={{ flex:1, background:'var(--surface2)', borderRadius:8, padding:'10px 14px' }}>
                <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:3 }}>Mã lệnh</div>
                <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:15 }}>{confirmProdTarget.code}</div>
              </div>
              <div style={{ flex:2, background:'var(--surface2)', borderRadius:8, padding:'10px 14px' }}>
                <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:3 }}>SKU</div>
                <div style={{ fontWeight:700, fontSize:13 }}>
                  {confirmProdTarget.items?.[0]?.productVariant?.mfgProduct?.factoryCode ?? '—'}
                  <span style={{ fontWeight:400, color:'var(--text2)', marginLeft:6 }}>
                    {confirmProdTarget.items?.[0]?.productVariant?.mfgProduct?.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Chi tiết sản phẩm */}
            {(confirmProdTarget.items ?? []).length > 0 && (
              <div style={{ marginBottom:16, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                <div style={{ background:'var(--surface2)', padding:'7px 14px', fontSize:11, fontWeight:700, color:'var(--text3)' }}>
                  SẢN PHẨM
                </div>
                {(confirmProdTarget.items ?? []).map((item: any, i: number) => (
                  <div key={i} style={{ padding:'10px 14px', borderTop: i > 0 ? '1px solid var(--border)' : undefined, display:'flex', gap:16, fontSize:13 }}>
                    <div style={{ flex:2 }}>
                      <span style={{ fontFamily:'monospace', fontWeight:600, fontSize:12 }}>{item.productVariant?.mfgProduct?.factoryCode}</span>
                      <span style={{ color:'var(--text2)', marginLeft:6 }}>{item.productVariant?.mfgProduct?.name}</span>
                    </div>
                    {item.productVariant?.colorCode && (
                      <div style={{ color:'var(--text3)', fontSize:12 }}>Màu: <strong>{item.productVariant.colorCode}</strong></div>
                    )}
                    <div style={{ color:'var(--text3)', fontSize:12 }}>SL: <strong>{item.quantity?.toLocaleString()}</strong></div>
                  </div>
                ))}
              </div>
            )}

            {/* Thời gian */}
            {(() => {
              const pDl = new Date(confirmProdTarget.deadline)
              const fb = (days: number) => { const d = new Date(pDl); d.setDate(d.getDate() - days); return d.toISOString() }
              const stg = (type: string) => confirmProdTarget.stages?.find((s: any) => s.stageType === type)?.deadline ?? null
              const rows = [
                { label:'Hạn giao',     val: confirmProdTarget.deadline,                   explicit: true },
                { label:'Mua hàng',     val: confirmProdTarget.materialDeadline ?? fb(21), explicit: !!confirmProdTarget.materialDeadline },
                { label:'Khung cơ khí', val: stg('HAN')     ?? fb(14),                    explicit: !!stg('HAN') },
                { label:'Đan',          val: stg('WEAVING')  ?? fb(8),                     explicit: !!stg('WEAVING') },
                { label:'Đóng gói',     val: stg('SON')      ?? fb(3),                     explicit: !!stg('SON') },
              ]
              return (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
                  {rows.map(({ label, val, explicit }) => (
                    <div key={label} style={{ background:'var(--surface2)', borderRadius:8, padding:'8px 12px' }}>
                      <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>{label}</div>
                      <div style={{ fontSize:13, fontWeight: explicit ? 600 : 400, color: explicit ? 'var(--text)' : 'var(--text3)' }}>
                        {format(new Date(val), 'dd/MM/yyyy')}
                        {!explicit && <span style={{ fontSize:10, marginLeft:4 }}>(ước tính)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={() => setConfirmProdTarget(null)} disabled={!!confirmingProdId}
                style={{ padding:'9px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer', color:'var(--text2)' }}>
                Hủy
              </button>
              <button onClick={() => handleConfirmProduction(confirmProdTarget.id)} disabled={!!confirmingProdId}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#2e7d32', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor: confirmingProdId ? 'not-allowed' : 'pointer', color:'#fff', opacity: confirmingProdId ? 0.7 : 1 }}>
                <CheckCircle2 size={15}/> {confirmingProdId ? 'Đang xử lý...' : 'Xác nhận sản xuất'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Xác nhận lưu deadline */}
      {showSaveConfirm && editingRowId !== null && (
        <div onClick={() => setShowSaveConfirm(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, width:380, boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin:'0 0 8px', fontSize:15, fontWeight:700 }}>Xác nhận lưu thay đổi</h3>
            <p style={{ margin:'0 0 16px', fontSize:13, color:'var(--text2)' }}>
              Lưu tất cả thời hạn mới cho mã <strong style={{ fontFamily:'monospace' }}>{safeList.find((p: any) => p.id === editingRowId)?.code}</strong>?
            </p>
            <div style={{ display:'grid', gap:6, fontSize:12, color:'var(--text2)', marginBottom:20, padding:'10px 12px', background:'var(--surface2)', borderRadius:8 }}>
              {[
                ['Hạn giao',    'deadline'],
                ['Hạn mua hàng',    'materialDeadline'],
                ['Hạn khung cơ khí','HAN'],
                ['Hạn đan',         'WEAVING'],
                ['Hạn đóng gói',    'SON'],
              ].map(([label, field]) => (
                <div key={field} style={{ display:'flex', justifyContent:'space-between' }}>
                  <span>{label}</span>
                  <strong style={{ fontFamily:'monospace' }}>
                    {editingRowValues[field] ? format(new Date(editingRowValues[field]), 'dd/MM/yyyy') : '—'}
                  </strong>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={() => setShowSaveConfirm(false)} disabled={savingRow}
                style={{ padding:'8px 16px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer', color:'var(--text2)' }}>
                Hủy
              </button>
              <button onClick={handleSaveRow} disabled={savingRow}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', background:'#1976d2', border:'none', borderRadius:'var(--radius)', fontSize:13, fontWeight:600, cursor: savingRow ? 'not-allowed' : 'pointer', color:'#fff', opacity: savingRow ? 0.7 : 1 }}>
                <CheckCircle2 size={14}/> {savingRow ? 'Đang lưu...' : 'Xác nhận lưu'}
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
                <CalendarClock size={18} color="#e65100"/> {editMode ? 'Chỉnh sửa timeline' : 'Timeline dự kiến'}
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
                      <Pencil size={14}/> Chỉnh sửa timeline
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
                    <CheckCircle2 size={14}/> {savingTimeline ? 'Đang lưu...' : 'Lưu & tạo PI'}
                  </button>
                </>
              )}
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:10 }}>
              {editMode
                ? '* Sửa hạn từng công đoạn rồi bấm "Lưu & tạo PI" — Lệnh SX sẽ dùng đúng hạn này. Ngày giao cố định theo đơn.'
                : '* Timeline mẫu tính lùi từ ngày giao. Bấm "Chỉnh sửa timeline" để đặt hạn riêng trước khi tạo PI; hoặc tạo PI luôn ở nút "Xác nhận" ngoài danh sách.'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
