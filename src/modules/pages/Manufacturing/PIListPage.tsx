import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import ExportOrderDetailModal from './ExportOrderDetailModal'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2, FileText, Eye, X, CalendarClock, Pencil, Package, Play } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Mới', PLANNING: 'Lên kế hoạch', PURCHASING: 'Mua hàng',
  PRODUCING: 'Đang SX', QC_STAGE: 'QC', DONE: 'Hoàn thành', CANCELLED: 'Đã hủy'
}
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  NEW:       { bg:'#e3f2fd', color:'#1565c0' },
  PLANNING:  { bg:'#ede7f6', color:'#4527a0' },
  PURCHASING:{ bg:'#fff3e0', color:'#e65100' },
  PRODUCING: { bg:'#e8f5e9', color:'#2e7d32' },
  QC_STAGE:  { bg:'#fce4ec', color:'#880e4f' },
  DONE:      { bg:'#f1f8e9', color:'#33691e' },
  CANCELLED: { bg:'#fafafa', color:'#757575' },
}

export default function PIListPage() {
  const { user } = useAuth()
  const [viewOrderId, setViewOrderId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [editingCell, setEditingCell] = useState<{ piId: number; field: string } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingCell, setSavingCell] = useState(false)
  const [confirmingProdId, setConfirmingProdId] = useState<number | null>(null)
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
  const safeList = Array.isArray(pis) ? pis : []

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

  const startCellEdit = (piId: number, field: string, date: Date) => {
    setEditingCell({ piId, field })
    setEditingValue(format(date, 'yyyy-MM-dd'))
  }

  const handleCellSave = async () => {
    if (!editingCell || !editingValue) { setEditingCell(null); return }
    const { piId, field } = editingCell
    setSavingCell(true)
    try {
      const iso = new Date(editingValue).toISOString()
      if (field === 'deadline' || field === 'materialDeadline') {
        await api.updateProductionInvoice(piId, { [field]: iso })
      } else {
        const pi = safeList.find((p: any) => p.id === piId)
        const stages: any[] = Array.isArray(pi?.stages) ? [...pi.stages] : []
        const idx = stages.findIndex((s: any) => s.stageType === field)
        if (idx >= 0) stages[idx] = { ...stages[idx], deadline: iso }
        else stages.push({ stageType: field, deadline: iso, progressPercent: 0, status: 'PENDING' })
        await api.updateProductionInvoice(piId, { stages })
      }
      refetch()
      setEditingCell(null)
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Lỗi lưu')
    } finally {
      setSavingCell(false)
    }
  }

  const handleConfirmProduction = async (id: number) => {
    setConfirmingProdId(id)
    try {
      await api.updateProductionInvoice(id, { status: 'PRODUCING' })
      refetch()
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
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
              {['Mã PI','SKU','Hạn giao','Mua hàng','Khung cơ khí','Đan','Đóng gói','Trạng thái','Thao tác'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'var(--text2)', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {safeList.map((pi: any) => {
              const status = STATUS_COLOR[pi.status] ?? { bg:'#f5f5f5', color:'#616161' }
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
              const editCell = (field: string, date: Date, fromStage: boolean, extra?: React.ReactNode) => {
                const isEditing = editingCell?.piId === pi.id && editingCell?.field === field
                if (isEditing) return (
                  <td style={{ padding:'6px 14px', whiteSpace:'nowrap' }}>
                    <input
                      type="date"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={e => { if (e.key === 'Enter') handleCellSave(); if (e.key === 'Escape') setEditingCell(null) }}
                      autoFocus
                      disabled={savingCell}
                      style={{ padding:'4px 6px', border:'2px solid #1976d2', borderRadius:4, fontSize:12, width:110, background:'var(--surface)', color:'var(--text)' }}
                    />
                  </td>
                )
                return (
                  <td
                    onClick={() => startCellEdit(pi.id, field, date)}
                    title="Nhấn để sửa"
                    style={{ padding:'12px 14px', fontSize:12, whiteSpace:'nowrap', cursor:'pointer', color: fromStage ? 'var(--text)' : 'var(--text3)', userSelect:'none' }}
                    onMouseEnter={e => { (e.currentTarget.querySelector('.edit-hint') as HTMLElement | null)?.style && ((e.currentTarget.querySelector('.edit-hint') as HTMLElement).style.opacity = '1') }}
                    onMouseLeave={e => { (e.currentTarget.querySelector('.edit-hint') as HTMLElement | null)?.style && ((e.currentTarget.querySelector('.edit-hint') as HTMLElement).style.opacity = '0') }}
                  >
                    {fmt(date)}{extra}
                    <Pencil size={10} className="edit-hint" style={{ marginLeft:4, opacity:0, transition:'opacity .1s', verticalAlign:'middle' }} />
                  </td>
                )
              }
              return (
                <tr key={pi.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'12px 14px', fontWeight:600, fontFamily:'monospace' }}>{pi.code}</td>
                  <td style={{ padding:'12px 14px' }}>
                    <span style={{ fontWeight:600, fontFamily:'monospace', fontSize:12 }}>{skuCode}</span>
                    {skuName && <span style={{ marginLeft:6, color:'var(--text3)', fontSize:12 }}>{skuName}</span>}
                  </td>
                  {editCell('deadline', deadline, true,
                    isOverdue ? <span style={{ marginLeft:6, fontSize:11, background:'#ffebee', color:'#c62828', padding:'1px 6px', borderRadius:20 }}>Trễ</span> : null
                  )}
                  {editCell('materialDeadline', pi.materialDeadline ? new Date(pi.materialDeadline) : getStageDate('MATERIAL', 21), !!pi.materialDeadline)}
                  {editCell('HAN',     getStageDate('HAN',     14), !!hanStage)}
                  {editCell('WEAVING', getStageDate('WEAVING',  8), !!weavStage)}
                  {editCell('SON',     getStageDate('SON',       3), !!sonStage)}
                  <td style={{ padding:'12px 14px' }}>
                    <span style={{ background:status.bg, color:status.color, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>
                      {STATUS_LABEL[pi.status] ?? pi.status}
                    </span>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    {canConfirmProd && (
                      <button
                        onClick={() => handleConfirmProduction(pi.id)}
                        disabled={confirmingProdId === pi.id}
                        title="Xác nhận đưa vào sản xuất"
                        style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 10px', background:'#2e7d32', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor: confirmingProdId === pi.id ? 'not-allowed' : 'pointer', color:'#fff', opacity: confirmingProdId === pi.id ? 0.7 : 1, whiteSpace:'nowrap' }}
                      >
                        <Play size={12}/> {confirmingProdId === pi.id ? '...' : 'Xác nhận SX'}
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
