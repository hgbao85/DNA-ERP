// Phần A – Đợt 9 (YC2): hộp "Lịch sử đổi mốc" của 1 dòng SKU - lúc nào, ai, loại (sửa thẳng / gửi Sếp / Sếp duyệt / từ chối / huỷ), nguồn, mốc cũ → mới.
import { History, X } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { getDeadlineHistory } from '../../../services/deadline-changes-api'
import { HISTORY_KIND_LABEL, HISTORY_KIND_TONE, TONE_STYLE, fmtChange, fmtDateTime, historySourceLabel } from './deadlineChange'

export default function DeadlineHistoryModal({ itemId, title, onClose }: { itemId: string; title: string; onClose: () => void }) {
  const isMobile = useIsMobile()
  const { data, isLoading, error, refetch } = useFetch(() => getDeadlineHistory(itemId), [itemId])
  const rows = Array.isArray(data) ? data : []

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Lịch sử đổi mốc"
        style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding: isMobile ? 16 : 24, width:600, maxWidth:'100%', maxHeight:'85dvh', display:'flex', flexDirection:'column', boxShadow:'0 8px 32px rgba(0,0,0,0.22)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:14, flexShrink:0 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <History size={16} color="var(--fg-1976d2)"/> Lịch sử đổi mốc — <span style={{ fontFamily:'monospace' }}>{title}</span>
          </h3>
          <button onClick={onClose} aria-label="Đóng" style={{ padding:4, background:'transparent', border:'none', cursor:'pointer' }}>
            <X size={18} color="var(--text3)"/>
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
          {isLoading ? <LoadingState /> : error ? (
            <LoadErrorState error={error} onRetry={refetch} />
          ) : rows.length === 0 ? (
            <div style={{ padding:32, textAlign:'center', color:'var(--text3)', fontSize:13 }}>Dòng này chưa đổi mốc lần nào.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {rows.map((h, i) => {
                const tone = TONE_STYLE[HISTORY_KIND_TONE[h.kind] ?? 'gray']
                return (
                  <div key={`${h.at}-${i}`} style={{ border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:10, color:tone.color, background:tone.background, whiteSpace:'nowrap' }}>
                        {HISTORY_KIND_LABEL[h.kind] ?? h.kind}
                      </span>
                      <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{fmtDateTime(h.at)}</span>
                      <span style={{ fontSize:12, color:'var(--text3)' }}>{h.by?.name ?? 'Hệ thống'}</span>
                      <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'1px 8px', borderRadius:10 }}>
                        {historySourceLabel(h.source)}
                      </span>
                    </div>
                    {h.changes.length > 0 && (
                      <ul style={{ margin:'8px 0 0', paddingLeft:18, fontSize:12.5, color:'var(--text2)', lineHeight:1.55 }}>
                        {h.changes.map((c) => <li key={c.key}>{fmtChange(c)}</li>)}
                      </ul>
                    )}
                    {h.note && (
                      <div style={{ marginTop:6, fontSize:12, color: h.kind === 'REJECTED' ? 'var(--fg-b91c1c)' : 'var(--text3)', overflowWrap:'anywhere' }}>
                        {h.kind === 'REJECTED' ? `Lý do từ chối: ${h.note}` : h.note}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14, flexShrink:0 }}>
          <button onClick={onClose}
            style={{ padding:'8px 18px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer', color:'var(--text2)' }}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
