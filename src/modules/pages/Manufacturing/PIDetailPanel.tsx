import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { X, AlertCircle, FileText, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { format } from 'date-fns'
import MfgPhoiPage from './MfgPhoiPage'
import ExportOrderDetailModal from './ExportOrderDetailModal'

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Mới', PLANNING: 'Lên kế hoạch', PURCHASING: 'Mua hàng',
  PRODUCING: 'Đang SX', QC_STAGE: 'QC', DONE: 'Hoàn thành', CANCELLED: 'Đã hủy'
}

const STAGE_LABEL: Record<string, string> = {
  PHOI: 'Phôi', HAN: 'Hàn', SON: 'Sơn', WEAVING: 'Đan', QC: 'QC'
}

interface Props {
  piId: number
  onClose: () => void
  onUpdate: () => void
}

export default function PIDetailPanel({ piId, onClose }: Props) {
  const [showPhoi, setShowPhoi] = useState(false)
  const [viewOrder, setViewOrder] = useState(false)
  const { data: pi, isLoading, error } = useFetch(
    () => api.getProductionInvoice(piId),
    [piId]
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'flex-start', justifyContent:'flex-end', zIndex:1000 }}>
      <div style={{ background:'var(--surface)', width:560, height:'100%', overflowY:'auto', boxShadow:'-4px 0 16px rgba(0,0,0,0.15)', padding:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>Chi tiết lệnh SX</h3>
          <button onClick={onClose} style={{ padding:4, background:'transparent', border:'none', cursor:'pointer' }}>
            <X size={18} color="var(--text3)" />
          </button>
        </div>

        {isLoading && <div style={{ color:'var(--text3)' }}>Đang tải...</div>}
        {error && <div style={{ color:'#c62828', display:'flex', gap:6 }}><AlertCircle size={16}/>Lỗi</div>}

        {pi && (
          <>
            {/* Header info */}
            <div style={{ background:'var(--surface2)', borderRadius:'var(--radius)', padding:16, marginBottom:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:13 }}>
                <div><span style={{ color:'var(--text3)' }}>Mã PI: </span><strong style={{ fontFamily:'monospace' }}>{pi.code}</strong></div>
                <div><span style={{ color:'var(--text3)' }}>Trạng thái: </span><strong>{STATUS_LABEL[pi.status] ?? pi.status}</strong></div>
                <div><span style={{ color:'var(--text3)' }}>Deadline: </span><strong>{format(new Date(pi.deadline), 'dd/MM/yyyy')}</strong></div>
                <div><span style={{ color:'var(--text3)' }}>Hạn vật tư: </span><strong>{format(new Date(pi.materialDeadline), 'dd/MM/yyyy')}</strong></div>
                <div><span style={{ color:'var(--text3)' }}>Tạo bởi: </span><strong>{pi.createdBy?.name}</strong></div>
              </div>
              {pi.exportOrder && (
                <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)', fontSize:13, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <span><span style={{ color:'var(--text3)' }}>PO: </span><strong style={{ fontFamily:'monospace' }}>{pi.exportOrder.poNumber}</strong></span>
                  {pi.exportOrder.contractFileUrl
                    ? <a href={pi.exportOrder.contractFileUrl} target="_blank" rel="noreferrer" style={{ color:'#1565c0', display:'inline-flex', alignItems:'center', gap:4 }}><FileText size={14}/> Hợp đồng</a>
                    : <span style={{ color:'var(--text3)' }}>(chưa có hợp đồng)</span>}
                  {pi.exportOrderId && (
                    <button onClick={() => setViewOrder(true)}
                      title="Xem chi tiết đơn hàng gốc của Sales"
                      style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text2)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      <Package size={13}/> Xem đơn hàng
                    </button>
                  )}
                </div>
              )}
              {pi.note && <div style={{ marginTop:8, fontSize:13, color:'var(--text2)' }}>Ghi chú: {pi.note}</div>}
            </div>

            {/* Items */}
            <div style={{ marginBottom:16 }}>
              <h4 style={{ fontSize:13, fontWeight:600, margin:'0 0 8px' }}>Sản phẩm ({pi.items?.length ?? 0})</h4>
              {(pi.items ?? []).map((item: any) => (
                <div key={item.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                  <span>{item.productVariant?.mfgProduct?.name} {item.productVariant?.colorCode && `— ${item.productVariant.colorCode}`}</span>
                  <strong>×{item.quantity}</strong>
                </div>
              ))}
            </div>

            {/* Stages */}
            <div style={{ marginBottom:16 }}>
              <h4 style={{ fontSize:13, fontWeight:600, margin:'0 0 8px' }}>Tiến độ sản xuất</h4>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {(pi.stages ?? []).filter((s: any) => s.stageType !== 'QC').map((stage: any) => {
                  const isPhoi = stage.stageType === 'PHOI'
                  return (
                    <button
                      key={stage.id}
                      onClick={isPhoi ? () => setShowPhoi(v => !v) : undefined}
                      style={{
                        padding:'8px 12px', borderRadius:'var(--radius)', fontSize:12, textAlign:'center', minWidth:70,
                        background: stage.status === 'DONE' ? '#e8f5e9' : stage.status === 'IN_PROGRESS' ? '#fff3e0' : 'var(--surface2)',
                        color: stage.status === 'DONE' ? '#2e7d32' : stage.status === 'IN_PROGRESS' ? '#e65100' : 'var(--text3)',
                        border: isPhoi && showPhoi ? '1px solid #e65100' : '1px solid var(--border)',
                        cursor: isPhoi ? 'pointer' : 'default',
                      }}
                      title={isPhoi ? 'Xem chi tiết công đoạn phôi' : undefined}
                    >
                      <div style={{ fontWeight:700, display:'flex', alignItems:'center', gap:3, justifyContent:'center' }}>
                        {STAGE_LABEL[stage.stageType] ?? stage.stageType}
                        {isPhoi && (showPhoi ? <ChevronUp size={11}/> : <ChevronDown size={11}/>)}
                      </div>
                      <div style={{ fontSize:11, marginTop:2 }}>{stage.progressPercent}%</div>
                    </button>
                  )
                })}
              </div>

              {/* Drill-down chi tiết Phôi (read-only cho quản lý) */}
              {showPhoi && (() => {
                const phoiStage = (pi.stages ?? []).find((s: any) => s.stageType === 'PHOI')
                return (
                  <div style={{ marginTop:14, paddingTop:14, borderTop:'1px dashed var(--border)' }}>
                    <MfgPhoiPage
                      piId={piId}
                      readOnly
                      stageProgress={phoiStage?.progressPercent}
                      stageStatus={phoiStage?.status}
                    />
                  </div>
                )
              })()}
            </div>
          </>
        )}
      </div>

      {viewOrder && pi?.exportOrderId && (
        <ExportOrderDetailModal orderId={pi.exportOrderId} onClose={() => setViewOrder(false)} />
      )}
    </div>
  )
}
